'use server';

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { readFileSync } from 'fs';
import { resolve, join } from 'path';
import { A11yViolation, ScanResult } from '@/types';

export async function scanWebsite(url: string): Promise<ScanResult> {
  let browser;
  
  try {
    // Bestimme den Pfad zu den Chromium-Binaries
    // Auf Vercel müssen wir den korrekten Pfad finden
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

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Load axe-core from node_modules
    const axeCorePath = resolve(process.cwd(), 'node_modules/axe-core/axe.min.js');
    const axeCoreSource = readFileSync(axeCorePath, 'utf-8');

    // Inject axe-core
    await page.addScriptTag({
      content: axeCoreSource,
    });

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
      timestamp: new Date().toISOString(),
      violations,
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      inapplicable: results.inapplicable.length,
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
