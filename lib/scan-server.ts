import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { readFileSync } from 'fs';
import { resolve, join } from 'path';
import { A11yViolation, ScanResult, ComplianceStatus, PageResult } from '@/types';

// Maximum pages for deep scan (Vercel timeout: 300s)
const MAX_DEEP_SCAN_PAGES = 15;

// WCAG tags mapping
const WCAG21_TAGS = ['wcag21a', 'wcag21aa', 'wcag2a', 'wcag2aa'];
const WCAG22_TAGS = ['wcag22aa'];
const SECTION508_TAGS = ['section508', 'section508.22.a'];

export async function calculateCompliance(violations: A11yViolation[]): Promise<ComplianceStatus> {
  const tags = new Set(violations.flatMap(v => v.tags));
  
  // Check WCAG 2.1 compliance
  const wcag21A = !tags.has('wcag21a') && !tags.has('wcag2a');
  const wcag21AA = wcag21A && !tags.has('wcag21aa') && !tags.has('wcag2aa');
  const wcag21AAA = wcag21AA; // AAA is rarely fully testable automatically
  
  // Check WCAG 2.2 compliance
  const wcag22A = wcag21A;
  const wcag22AA = wcag21AA && !tags.has('wcag22aa');
  const wcag22AAA = wcag22AA;
  
  // Check Section 508 compliance
  const hasSection508Violation = violations.some(v => 
    v.tags.some(tag => SECTION508_TAGS.some(st => tag.includes(st)))
  );
  
  return {
    wcag21: {
      A: wcag21A,
      AA: wcag21AA,
      AAA: wcag21AAA,
    },
    wcag22: {
      A: wcag22A,
      AA: wcag22AA,
      AAA: wcag22AAA,
    },
    section508: !hasSection508Violation,
  };
}

async function scanSinglePage(
  browser: any,
  url: string,
  axeCoreSource: string
): Promise<PageResult> {
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Inject axe-core
    await page.addScriptTag({ content: axeCoreSource });

    // Run axe analysis
    const results = await page.evaluate(async () => {
      // @ts-ignore
      return await axe.run();
    });

    const violations: A11yViolation[] = results.violations.map((v: any, index: number) => ({
      id: `${v.id}-${index}`,
      impact: v.impact as A11yViolation['impact'],
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      tags: v.tags,
      nodes: v.nodes.map((n: any) => ({
        html: n.html,
        target: n.target,
        failureSummary: n.failureSummary,
      })),
    }));

    return {
      url,
      violations,
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      inapplicable: results.inapplicable.length,
    };
  } finally {
    await page.close();
  }
}

async function extractInternalLinks(browser: any, url: string): Promise<string[]> {
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    const baseUrl = new URL(url);
    const links = await page.evaluate((baseOrigin: string) => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors
        .map(a => (a as HTMLAnchorElement).href)
        .filter(href => {
          try {
            const url = new URL(href);
            return url.origin === baseOrigin && 
                   !href.includes('#') && 
                   !href.includes('mailto:') &&
                   !href.includes('tel:');
          } catch {
            return false;
          }
        });
    }, baseUrl.origin);
    
    // Deduplicate and limit
    const uniqueLinks = Array.from(new Set(links as string[])).slice(0, MAX_DEEP_SCAN_PAGES);
    return uniqueLinks;
  } finally {
    await page.close();
  }
}

export async function scanWebsite(
  url: string, 
  mode: 'quick' | 'deep' = 'quick'
): Promise<ScanResult> {
  let browser;
  
  try {
    // Bestimme den Pfad zu den Chromium-Binaries
    const possiblePaths = [
      join(process.cwd(), 'node_modules', '@sparticuz', 'chromium', 'bin'),
      join('/var/task', 'node_modules', '@sparticuz', 'chromium', 'bin'),
      join('/tmp', 'chromium'),
    ];
    
    let chromiumBinPath: string | undefined;
    for (const path of possiblePaths) {
      try {
        const { existsSync } = await import('fs');
        if (existsSync(path)) {
          chromiumBinPath = path;
          console.log('Found chromium binaries at:', path);
          break;
        }
      } catch {
        // Continue to next path
      }
    }

    // Chrome-Args für Serverless (Vercel)
    const chromeArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      '--single-process',
      '--no-zygote',
    ];

    // Hole den Chromium-Executable-Pfad
    const executablePath = await chromium.executablePath(chromiumBinPath);
    
    browser = await puppeteer.launch({
      args: chromeArgs,
      executablePath,
      headless: true,
    });

    // Load axe-core from node_modules
    const axeCorePath = resolve(process.cwd(), 'node_modules/axe-core/axe.min.js');
    const axeCoreSource = readFileSync(axeCorePath, 'utf-8');

    let pages: PageResult[] = [];
    
    if (mode === 'deep') {
      // Extract internal links
      console.log('Extracting internal links...');
      const links = await extractInternalLinks(browser, url);
      console.log(`Found ${links.length} internal links`);
      
      // Scan start URL first
      pages.push(await scanSinglePage(browser, url, axeCoreSource));
      
      // Scan additional pages
      for (const link of links.slice(1, MAX_DEEP_SCAN_PAGES)) {
        console.log(`Scanning: ${link}`);
        try {
          const pageResult = await scanSinglePage(browser, link, axeCoreSource);
          pages.push(pageResult);
        } catch (err) {
          console.error(`Failed to scan ${link}:`, err);
        }
      }
    } else {
      // Quick scan - just the start URL
      pages.push(await scanSinglePage(browser, url, axeCoreSource));
    }

    // Aggregate violations from all pages
    const allViolations = pages.flatMap(p => p.violations);
    
    // Deduplicate violations by ID
    const violationMap = new Map<string, A11yViolation>();
    allViolations.forEach(v => {
      if (!violationMap.has(v.id)) {
        violationMap.set(v.id, v);
      }
    });
    const uniqueViolations = Array.from(violationMap.values());
    
    // Calculate compliance
    const compliance = await calculateCompliance(uniqueViolations);
    
    // Aggregate stats
    const totalPasses = pages.reduce((sum, p) => sum + p.passes, 0);
    const totalIncomplete = pages.reduce((sum, p) => sum + p.incomplete, 0);
    const totalInapplicable = pages.reduce((sum, p) => sum + p.inapplicable, 0);

    return {
      url,
      timestamp: new Date().toISOString(),
      violations: uniqueViolations,
      passes: totalPasses,
      incomplete: totalIncomplete,
      inapplicable: totalInapplicable,
      compliance,
      pages,
      scanMode: mode,
      pagesScanned: pages.length,
    };
  } catch (error) {
    console.error('Scan error:', error);
    throw new Error(`Fehler beim Scannen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
