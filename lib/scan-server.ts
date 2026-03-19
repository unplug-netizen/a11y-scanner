'use server';

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { A11yViolation, ScanResult, ComplianceStatus, PageResult } from '@/types';
import { getBrowserPool, closeBrowserPool } from './browser-pool';
import { logger, withErrorHandling } from './logger';
import { getCachedScan, cacheScanResult } from './cache';

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

export const scanWebsite = withErrorHandling(async (
  url: string,
  mode: 'quick' | 'deep' = 'quick',
  options: { skipCache?: boolean } = {}
): Promise<ScanResult> => {
  const pool = getBrowserPool();
  const startTime = Date.now();

  logger.scanStarted(url, mode);

  // Check cache first (unless skipCache is true)
  if (!options.skipCache) {
    const cached = await getCachedScan(url, mode);
    if (cached) {
      logger.info('[Scanner] Returning cached result', { url, mode, cachedAt: cached.cachedAt });
      return {
        ...cached.result,
        cached: true,
        cachedAt: cached.cachedAt,
      } as ScanResult;
    }
  }

  let pages: PageResult[] = [];

  if (mode === 'deep') {
    // Extract internal links
    logger.debug('[Scanner] Extracting internal links');
    const allLinks = await pool.extractLinks(url);
    const links = allLinks.slice(0, MAX_DEEP_SCAN_PAGES);
    logger.debug('[Scanner] Links extracted', { count: links.length, limitedTo: MAX_DEEP_SCAN_PAGES });

    // Scan start URL first
    pages.push(await pool.scanPage(url));

    // Scan additional pages
    for (const link of links.slice(1)) {
      logger.debug('[Scanner] Scanning page', { url: link });
      try {
        const pageResult = await pool.scanPage(link);
        pages.push(pageResult);
      } catch (err) {
        logger.warn('[Scanner] Failed to scan page', { url: link, error: err });
      }
    }
  } else {
    // Quick scan - just the start URL
    pages.push(await pool.scanPage(url));
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
  const totalScanTime = pages.reduce((sum, p) => sum + (p.scanTimeMs || 0), 0);

  const result: ScanResult = {
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

  // Cache the result
  await cacheScanResult(url, mode, result);

  logger.scanCompleted(url, Date.now() - startTime, uniqueViolations.length);
  logger.debug('[Scanner] Pool stats', pool.getStats());

  return result;
}, 'scanWebsite');

/**
 * Legacy scan function for backwards compatibility
 * Creates a fresh browser instance (slower, but isolated)
 */
export async function scanWebsiteLegacy(
  url: string,
  mode: 'quick' | 'deep' = 'quick'
): Promise<ScanResult> {
  // Import puppeteer dynamically for legacy mode
  const puppeteer = (await import('puppeteer-core')).default;
  const chromium = (await import('@sparticuz/chromium')).default;

  let browser;

  try {
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

    // Bestimme den Pfad zu den Chromium-Binaries
    const possiblePaths = [
      resolve(process.cwd(), 'node_modules', '@sparticuz', 'chromium', 'bin'),
      '/var/task/node_modules/@sparticuz/chromium/bin',
      '/tmp/chromium',
    ];

    let chromiumBinPath: string | undefined;
    for (const path of possiblePaths) {
      try {
        const { existsSync } = await import('fs');
        if (existsSync(path)) {
          chromiumBinPath = path;
          break;
        }
      } catch {
        // Continue to next path
      }
    }

    const executablePath = await chromium.executablePath(chromiumBinPath);

    browser = await puppeteer.launch({
      args: chromeArgs,
      executablePath,
      headless: true,
    });

    // Load axe-core from node_modules
    const axeCorePath = resolve(process.cwd(), 'node_modules/axe-core/axe.min.js');
    const axeCoreSource = readFileSync(axeCorePath, 'utf-8');

    // Single page scan for legacy mode
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    await page.addScriptTag({ content: axeCoreSource });

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

    await page.close();

    const compliance = await calculateCompliance(violations);

    return {
      url,
      timestamp: new Date().toISOString(),
      violations,
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      inapplicable: results.inapplicable.length,
      compliance,
      scanMode: mode,
      pagesScanned: 1,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
