import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { join } from 'path';
import { A11yViolation, A11yNode } from '@/types';

// Types for visual overlay
export interface ViolationHighlight {
  id: string;
  violationId: string;
  type: 'critical' | 'serious' | 'moderate' | 'minor';
  x: number;
  y: number;
  width: number;
  height: number;
  elementHtml: string;
  message: string;
  helpUrl: string;
  selector: string;
}

export interface VisualOverlayResult {
  url: string;
  timestamp: string;
  viewport: {
    width: number;
    height: number;
  };
  screenshotBase64: string;
  highlights: ViolationHighlight[];
  summary: {
    totalHighlights: number;
    criticalCount: number;
    seriousCount: number;
    moderateCount: number;
    minorCount: number;
  };
}

// Color scheme for different impact levels
const IMPACT_COLORS = {
  critical: {
    fill: 'rgba(220, 38, 38, 0.3)',     // Red with opacity
    stroke: '#dc2626',
    label: '#dc2626'
  },
  serious: {
    fill: 'rgba(234, 88, 12, 0.3)',     // Orange with opacity
    stroke: '#ea580c',
    label: '#ea580c'
  },
  moderate: {
    fill: 'rgba(234, 179, 8, 0.3)',     // Yellow with opacity
    stroke: '#eab308',
    label: '#b45309'
  },
  minor: {
    fill: 'rgba(59, 130, 246, 0.3)',    // Blue with opacity
    stroke: '#3b82f6',
    label: '#1d4ed8'
  }
};

/**
 * Generate visual overlay screenshot with highlighted violations
 */
export async function generateVisualOverlay(
  url: string,
  violations: A11yViolation[]
): Promise<VisualOverlayResult> {
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

    const executablePath = await chromium.executablePath(chromiumBinPath);
    
    browser = await puppeteer.launch({
      args: chromeArgs,
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    
    // Set desktop viewport for consistent screenshots
    await page.setViewport({
      width: 1280,
      height: 800,
      deviceScaleFactor: 1
    });
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait a bit for any animations to settle
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Collect highlight positions
    const highlights: ViolationHighlight[] = [];
    let idCounter = 0;

    for (const violation of violations) {
      for (const node of violation.nodes) {
        try {
          // Try to find the element using the target selector
          const selector = node.target.join(' ');
          
          const elementInfo = await page.evaluate((targetSelector) => {
            try {
              // Try to find element using the target
              let element: Element | null = null;
              
              // Try CSS selector first
              try {
                element = document.querySelector(targetSelector);
              } catch {
                // If CSS selector fails, try other methods
              }
              
              // If not found, try to find by partial HTML match
              if (!element) {
                const allElements = document.querySelectorAll('*');
                for (const el of allElements) {
                  if (el.outerHTML.includes(targetSelector.slice(0, 50))) {
                    element = el;
                    break;
                  }
                }
              }
              
              if (!element) return null;
              
              const rect = element.getBoundingClientRect();
              const computedStyle = window.getComputedStyle(element);
              
              // Skip hidden elements
              if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
                return null;
              }
              
              return {
                x: rect.x + window.scrollX,
                y: rect.y + window.scrollY,
                width: rect.width,
                height: rect.height,
                visible: rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth
              };
            } catch {
              return null;
            }
          }, selector);

          if (elementInfo && elementInfo.visible) {
            highlights.push({
              id: `highlight-${idCounter++}`,
              violationId: violation.id,
              type: violation.impact || 'moderate',
              x: Math.max(0, elementInfo.x),
              y: Math.max(0, elementInfo.y),
              width: Math.max(20, elementInfo.width), // Minimum width for visibility
              height: Math.max(20, elementInfo.height), // Minimum height for visibility
              elementHtml: node.html.slice(0, 200),
              message: violation.help,
              helpUrl: violation.helpUrl,
              selector: selector
            });
          }
        } catch (e) {
          // Skip elements that can't be highlighted
          console.log(`Could not highlight element for ${violation.id}:`, e);
        }
      }
    }

    // Draw highlights on the page
    await page.evaluate((highlightsData, colors) => {
      // Remove any existing overlay
      const existingOverlay = document.getElementById('a11y-highlight-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }

      // Create overlay container
      const overlay = document.createElement('div');
      overlay.id = 'a11y-highlight-overlay';
      overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: ${document.documentElement.scrollWidth}px;
        height: ${document.documentElement.scrollHeight}px;
        pointer-events: none;
        z-index: 999999;
      `;

      // Add each highlight
      highlightsData.forEach((highlight, index) => {
        const color = colors[highlight.type] || colors.moderate;
        
        // Create highlight box
        const box = document.createElement('div');
        box.style.cssText = `
          position: absolute;
          left: ${highlight.x}px;
          top: ${highlight.y}px;
          width: ${highlight.width}px;
          height: ${highlight.height}px;
          background-color: ${color.fill};
          border: 3px solid ${color.stroke};
          box-sizing: border-box;
          pointer-events: none;
        `;
        
        // Add label
        const label = document.createElement('div');
        label.textContent = `${index + 1}`;
        label.style.cssText = `
          position: absolute;
          top: -24px;
          left: -3px;
          background-color: ${color.label};
          color: white;
          padding: 2px 8px;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 12px;
          font-weight: bold;
          border-radius: 3px 3px 0 0;
          white-space: nowrap;
          pointer-events: none;
        `;
        
        box.appendChild(label);
        overlay.appendChild(box);
      });

      // Add legend
      const legend = document.createElement('div');
      legend.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: white;
        border: 2px solid #333;
        padding: 15px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13px;
        z-index: 1000000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        border-radius: 4px;
        max-width: 250px;
      `;
      
      legend.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px; font-size: 14px;">🚨 Accessibility Issues</div>
        <div style="margin-bottom: 5px;">
          <span style="display: inline-block; width: 12px; height: 12px; background: ${colors.critical.stroke}; margin-right: 8px; vertical-align: middle;"></span>
          Critical (${highlightsData.filter(h => h.type === 'critical').length})
        </div>
        <div style="margin-bottom: 5px;">
          <span style="display: inline-block; width: 12px; height: 12px; background: ${colors.serious.stroke}; margin-right: 8px; vertical-align: middle;"></span>
          Serious (${highlightsData.filter(h => h.type === 'serious').length})
        </div>
        <div style="margin-bottom: 5px;">
          <span style="display: inline-block; width: 12px; height: 12px; background: ${colors.moderate.stroke}; margin-right: 8px; vertical-align: middle;"></span>
          Moderate (${highlightsData.filter(h => h.type === 'moderate').length})
        </div>
        <div>
          <span style="display: inline-block; width: 12px; height: 12px; background: ${colors.minor.stroke}; margin-right: 8px; vertical-align: middle;"></span>
          Minor (${highlightsData.filter(h => h.type === 'minor').length})
        </div>
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 11px; color: #666;">
          Total: ${highlightsData.length} issues highlighted
        </div>
      `;
      
      overlay.appendChild(legend);
      document.body.appendChild(overlay);
    }, highlights, IMPACT_COLORS);

    // Take screenshot
    const screenshotBuffer = await page.screenshot({
      fullPage: true,
      encoding: 'base64'
    });

    // Clean up overlay
    await page.evaluate(() => {
      const overlay = document.getElementById('a11y-highlight-overlay');
      if (overlay) overlay.remove();
    });

    const viewport = await page.viewport();

    // Calculate summary
    const summary = {
      totalHighlights: highlights.length,
      criticalCount: highlights.filter(h => h.type === 'critical').length,
      seriousCount: highlights.filter(h => h.type === 'serious').length,
      moderateCount: highlights.filter(h => h.type === 'moderate').length,
      minorCount: highlights.filter(h => h.type === 'minor').length
    };

    return {
      url,
      timestamp: new Date().toISOString(),
      viewport: {
        width: viewport?.width || 1280,
        height: viewport?.height || 800
      },
      screenshotBase64: screenshotBuffer as string,
      highlights,
      summary
    };

  } catch (error) {
    console.error('Visual overlay generation error:', error);
    throw new Error(`Fehler bei der Generierung des Visual Overlays: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate overlay for a specific viewport size
 */
export async function generateVisualOverlayForViewport(
  url: string,
  violations: A11yViolation[],
  viewport: { width: number; height: number }
): Promise<VisualOverlayResult> {
  let browser;
  
  try {
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
          break;
        }
      } catch {
        // Continue to next path
      }
    }

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

    const executablePath = await chromium.executablePath(chromiumBinPath);
    
    browser = await puppeteer.launch({
      args: chromeArgs,
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Similar highlight collection and drawing logic as above
    // (simplified for brevity)
    const highlights: ViolationHighlight[] = [];
    let idCounter = 0;

    for (const violation of violations.slice(0, 20)) { // Limit to 20 for performance
      for (const node of violation.nodes.slice(0, 3)) { // Max 3 nodes per violation
        try {
          const selector = node.target.join(' ');
          
          const elementInfo = await page.evaluate((targetSelector) => {
            try {
              let element: Element | null = document.querySelector(targetSelector);
              
              if (!element) {
                const allElements = document.querySelectorAll('*');
                for (const el of allElements) {
                  if (el.outerHTML.includes(targetSelector.slice(0, 50))) {
                    element = el;
                    break;
                  }
                }
              }
              
              if (!element) return null;
              
              const rect = element.getBoundingClientRect();
              const computedStyle = window.getComputedStyle(element);
              
              if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
                return null;
              }
              
              return {
                x: rect.x + window.scrollX,
                y: rect.y + window.scrollY,
                width: rect.width,
                height: rect.height,
                visible: rect.width > 0 && rect.height > 0
              };
            } catch {
              return null;
            }
          }, selector);

          if (elementInfo && elementInfo.visible) {
            highlights.push({
              id: `highlight-${idCounter++}`,
              violationId: violation.id,
              type: violation.impact || 'moderate',
              x: Math.max(0, elementInfo.x),
              y: Math.max(0, elementInfo.y),
              width: Math.max(20, elementInfo.width),
              height: Math.max(20, elementInfo.height),
              elementHtml: node.html.slice(0, 200),
              message: violation.help,
              helpUrl: violation.helpUrl,
              selector
            });
          }
        } catch {
          // Skip
        }
      }
    }

    // Draw highlights
    await page.evaluate((highlightsData, colors) => {
      const existingOverlay = document.getElementById('a11y-highlight-overlay');
      if (existingOverlay) existingOverlay.remove();

      const overlay = document.createElement('div');
      overlay.id = 'a11y-highlight-overlay';
      overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: ${document.documentElement.scrollWidth}px;
        height: ${document.documentElement.scrollHeight}px;
        pointer-events: none;
        z-index: 999999;
      `;

      highlightsData.forEach((highlight, index) => {
        const color = colors[highlight.type] || colors.moderate;
        
        const box = document.createElement('div');
        box.style.cssText = `
          position: absolute;
          left: ${highlight.x}px;
          top: ${highlight.y}px;
          width: ${highlight.width}px;
          height: ${highlight.height}px;
          background-color: ${color.fill};
          border: 3px solid ${color.stroke};
          box-sizing: border-box;
          pointer-events: none;
        `;
        
        const label = document.createElement('div');
        label.textContent = `${index + 1}`;
        label.style.cssText = `
          position: absolute;
          top: -24px;
          left: -3px;
          background-color: ${color.label};
          color: white;
          padding: 2px 8px;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 12px;
          font-weight: bold;
          border-radius: 3px 3px 0 0;
          white-space: nowrap;
          pointer-events: none;
        `;
        
        box.appendChild(label);
        overlay.appendChild(box);
      });

      // Compact legend for mobile
      const legend = document.createElement('div');
      legend.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: white;
        border: 2px solid #333;
        padding: 10px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 11px;
        z-index: 1000000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        border-radius: 4px;
      `;
      
      legend.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">🚨 A11y Issues</div>
        <div>C: ${highlightsData.filter(h => h.type === 'critical').length} | 
             S: ${highlightsData.filter(h => h.type === 'serious').length} | 
             M: ${highlightsData.filter(h => h.type === 'moderate').length}</div>
      `;
      
      overlay.appendChild(legend);
      document.body.appendChild(overlay);
    }, highlights, IMPACT_COLORS);

    const screenshotBuffer = await page.screenshot({
      fullPage: true,
      encoding: 'base64'
    });

    await page.evaluate(() => {
      const overlay = document.getElementById('a11y-highlight-overlay');
      if (overlay) overlay.remove();
    });

    const summary = {
      totalHighlights: highlights.length,
      criticalCount: highlights.filter(h => h.type === 'critical').length,
      seriousCount: highlights.filter(h => h.type === 'serious').length,
      moderateCount: highlights.filter(h => h.type === 'moderate').length,
      minorCount: highlights.filter(h => h.type === 'minor').length
    };

    return {
      url,
      timestamp: new Date().toISOString(),
      viewport,
      screenshotBase64: screenshotBuffer as string,
      highlights,
      summary
    };

  } catch (error) {
    console.error('Visual overlay generation error:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate overlay data for client-side rendering
 */
export function generateOverlayData(
  violations: A11yViolation[]
): Array<{
  id: string;
  type: string;
  selector: string;
  message: string;
  helpUrl: string;
}> {
  const overlayData: Array<{
    id: string;
    type: string;
    selector: string;
    message: string;
    helpUrl: string;
  }> = [];

  let idCounter = 0;

  for (const violation of violations) {
    for (const node of violation.nodes) {
      overlayData.push({
        id: `violation-${idCounter++}`,
        type: violation.impact || 'moderate',
        selector: node.target.join(' '),
        message: violation.help,
        helpUrl: violation.helpUrl
      });
    }
  }

  return overlayData;
}
