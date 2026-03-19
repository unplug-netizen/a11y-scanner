import puppeteer, { Browser, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { A11yViolation, PageResult } from '@/types';
import { checkContrastOnPage, DetailedContrastCheck, convertContrastToAxeViolation } from './contrast-check';
import { logger } from './logger';
import { analyzeFocusOrder, focusIssuesToViolations, FocusOrderResult } from './focus-order';

interface PoolConfig {
  maxPages: number;
  idleTimeoutMs: number;
}

interface PooledPage {
  page: Page;
  inUse: boolean;
  lastUsed: number;
}

/**
 * Browser Pool für wiederverwendbare Browser-Instanzen
 * Reduziert Overhead durch Browser-Recycling um 30-50%
 */
export class BrowserPool {
  private browser: Browser | null = null;
  private pages: PooledPage[] = [];
  private config: PoolConfig;
  private axeCoreSource: string | null = null;
  private initializationPromise: Promise<void> | null = null;

  constructor(config: Partial<PoolConfig> = {}) {
    this.config = {
      maxPages: config.maxPages ?? 5,
      idleTimeoutMs: config.idleTimeoutMs ?? 300000, // 5 minutes
    };
  }

  /**
   * Initialisiert den Browser-Pool (lazy)
   */
  async initialize(): Promise<void> {
    if (this.browser) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      // Load axe-core once
      const axeCorePath = resolve(process.cwd(), 'node_modules/axe-core/axe.min.js');
      this.axeCoreSource = readFileSync(axeCorePath, 'utf-8');

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
            logger.debug('[BrowserPool] Found chromium at', { path });
            break;
          }
        } catch {
          // Continue to next path
        }
      }

      const executablePath = await chromium.executablePath(chromiumBinPath);
      
      this.browser = await puppeteer.launch({
        args: chromeArgs,
        executablePath,
        headless: true,
      });

      // Pre-warm pages
      const pagesToCreate = Math.min(this.config.maxPages, 3);
      for (let i = 0; i < pagesToCreate; i++) {
        const page = await this.browser.newPage();
        this.pages.push({
          page,
          inUse: false,
          lastUsed: Date.now(),
        });
      }

      logger.info('[BrowserPool] Initialized', { pageCount: this.pages.length });
    } catch (error) {
      logger.error('[BrowserPool] Initialization failed', error as Error);
      throw error;
    }
  }

  /**
   * Holt eine verfügbare Page aus dem Pool
   */
  async acquirePage(): Promise<Page> {
    await this.initialize();

    // Suche nach freier Page
    const availablePage = this.pages.find(p => !p.inUse);
    if (availablePage) {
      availablePage.inUse = true;
      availablePage.lastUsed = Date.now();
      return availablePage.page;
    }

    // Erstelle neue Page wenn unter Limit
    if (this.pages.length < this.config.maxPages && this.browser) {
      const page = await this.browser.newPage();
      this.pages.push({
        page,
        inUse: true,
        lastUsed: Date.now(),
      });
      return page;
    }

    // Warte auf freie Page
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const freePage = this.pages.find(p => !p.inUse);
        if (freePage) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          freePage.inUse = true;
          freePage.lastUsed = Date.now();
          resolve(freePage.page);
        }
      }, 100);

      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for available page'));
      }, 30000);
    });
  }

  /**
   * Gibt eine Page zurück in den Pool
   */
  releasePage(page: Page): void {
    const pooledPage = this.pages.find(p => p.page === page);
    if (pooledPage) {
      pooledPage.inUse = false;
      pooledPage.lastUsed = Date.now();
    }
  }

  /**
   * Scannt eine einzelne Seite mit axe-core
   */
  async scanPage(url: string, options: { includeContrast?: boolean; includeFocusOrder?: boolean } = {}): Promise<PageResult> {
    const page = await this.acquirePage();
    const startTime = Date.now();

    try {
      // Navigate
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Inject axe-core (nur wenn nicht bereits injiziert)
      const hasAxe = await page.evaluate(() => {
        return typeof (window as any).axe !== 'undefined';
      });

      if (!hasAxe && this.axeCoreSource) {
        await page.addScriptTag({ content: this.axeCoreSource });
      }

      // Run axe analysis with WCAG 2.2 tags
      const results = await page.evaluate(async () => {
        // @ts-ignore
        return await axe.run({
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']
          }
        });
      });

      let violations: A11yViolation[] = results.violations.map((v: any, index: number) => ({
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

      // Additional contrast check (WCAG 1.4.3, 1.4.6, 1.4.11)
      let contrastCheck: DetailedContrastCheck | undefined;
      if (options.includeContrast !== false) {
        try {
          contrastCheck = await checkContrastOnPage(page);
          // Add contrast violations that axe might have missed
          const contrastViolations = contrastCheck.violations.map(v => 
            convertContrastToAxeViolation(v) as A11yViolation
          );
          // Filter out duplicates (axe already finds many contrast issues)
          const existingIds = new Set(violations.filter(v => v.id.includes('color-contrast')).map(v => v.id));
          const newContrastViolations = contrastViolations.filter(v => !existingIds.has(v.id));
          violations = [...violations, ...newContrastViolations];
        } catch (e) {
          logger.warn('[BrowserPool] Contrast check failed', { error: e });
        }
      }

      // Focus order analysis (WCAG 2.1.1, 2.4.3, 2.4.7)
      let focusOrderResult: FocusOrderResult | undefined;
      if (options.includeFocusOrder !== false) {
        try {
          focusOrderResult = await analyzeFocusOrder(page);
          // Convert focus issues to violations
          const focusViolations = focusIssuesToViolations(focusOrderResult);
          violations = [...violations, ...focusViolations];
        } catch (e) {
          logger.warn('[BrowserPool] Focus order check failed', { error: e });
        }
      }

      return {
        url,
        violations,
        passes: results.passes.length,
        incomplete: results.incomplete.length,
        inapplicable: results.inapplicable.length,
        scanTimeMs: Date.now() - startTime,
      };
    } finally {
      // Cleanup: clear cookies and storage for next use
      try {
        await page.deleteCookie();
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
      } catch (e) {
        // Ignore cleanup errors
      }
      this.releasePage(page);
    }
  }

  /**
   * Extrahiert interne Links von einer Seite
   */
  async extractLinks(url: string): Promise<string[]> {
    const page = await this.acquirePage();

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

      return Array.from(new Set(links as string[]));
    } finally {
      this.releasePage(page);
    }
  }

  /**
   * Gibt Pool-Statistiken zurück
   */
  getStats(): { totalPages: number; inUse: number; idle: number } {
    return {
      totalPages: this.pages.length,
      inUse: this.pages.filter(p => p.inUse).length,
      idle: this.pages.filter(p => !p.inUse).length,
    };
  }

  /**
   * Schließt den Pool und alle Browser-Instanzen
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.pages = [];
      this.initializationPromise = null;
      logger.info('[BrowserPool] Closed');
    }
  }
}

// Singleton-Instanz für Serverless-Umgebung
let globalPool: BrowserPool | null = null;

export function getBrowserPool(): BrowserPool {
  if (!globalPool) {
    globalPool = new BrowserPool({
      maxPages: parseInt(process.env.BROWSER_POOL_MAX_PAGES || '5', 10),
      idleTimeoutMs: parseInt(process.env.BROWSER_POOL_IDLE_TIMEOUT || '300000', 10),
    });
  }
  return globalPool;
}

export async function closeBrowserPool(): Promise<void> {
  if (globalPool) {
    await globalPool.close();
    globalPool = null;
  }
}
