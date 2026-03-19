import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { readFileSync } from 'fs';
import { resolve, join } from 'path';

// Types for screen reader simulation results
export interface ScreenReaderIssue {
  element: string;
  html: string;
  issue: string;
  severity: 'critical' | 'warning' | 'info';
  suggestion: string;
}

export interface MissingLabel {
  element: string;
  html: string;
  context: string;
}

export interface EmptyHeading {
  level: number;
  html: string;
  text: string;
}

export interface HeadingStructureIssue {
  issue: string;
  details: string;
}

export interface FormIssue {
  element: string;
  issue: string;
  suggestion: string;
}

export interface LinkIssue {
  html: string;
  issue: 'empty' | 'generic' | 'context';
  text: string;
}

export interface LandmarkIssue {
  issue: string;
  suggestion: string;
}

export interface ARIAIssue {
  element: string;
  issue: string;
  severity: 'critical' | 'warning' | 'info';
  suggestion: string;
}

export interface ScreenReaderResult {
  url: string;
  timestamp: string;
  
  // ARIA Analysis
  ariaIssues: ARIAIssue[];
  
  // Missing Labels
  missingLabels: MissingLabel[];
  
  // Empty Headings
  emptyHeadings: EmptyHeading[];
  
  // Heading Structure Issues
  headingStructureIssues: HeadingStructureIssue[];
  
  // Form Accessibility
  formIssues: FormIssue[];
  
  // Link Issues
  linkIssues: LinkIssue[];
  
  // Landmark Issues
  landmarkIssues: LandmarkIssue[];
  
  // Overall Score (0-100)
  screenReaderScore: number;
  
  // Summary
  summary: {
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    totalIssues: number;
  };
}

// Generic link texts that don't provide context
const GENERIC_LINK_TEXTS = [
  'click here', 'here', 'read more', 'more', 'link', 'click', 'learn more',
  'details', 'mehr', 'hier', 'weiter', 'mehr erfahren', 'details anzeigen',
  'klicken', 'link', 'weiterlesen'
];

/**
 * Simulate screen reader analysis on a webpage
 */
export async function simulateScreenReader(url: string): Promise<ScreenReaderResult> {
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
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Run screen reader simulation analysis
    const results = await page.evaluate(() => {
      const ariaIssues: ARIAIssue[] = [];
      const missingLabels: MissingLabel[] = [];
      const emptyHeadings: EmptyHeading[] = [];
      const headingStructureIssues: HeadingStructureIssue[] = [];
      const formIssues: FormIssue[] = [];
      const linkIssues: LinkIssue[] = [];
      const landmarkIssues: LandmarkIssue[] = [];

      // Helper to get element XPath
      function getXPath(element: Element): string {
        if (element.id) return `//*[@id="${element.id}"]`;
        if (element === document.body) return '/html/body';
        
        const ix = Array.from(element.parentNode?.children || [])
          .filter(n => n.nodeName === element.nodeName)
          .indexOf(element) + 1;
        
        const parentXPath = element.parentElement ? getXPath(element.parentElement) : '';
        return `${parentXPath}/${element.nodeName.toLowerCase()}[${ix}]`;
      }

      // ===== ARIA ANALYSIS =====
      
      // Check for role="presentation" on focusable elements
      const presentationElements = document.querySelectorAll('[role="presentation"], [role="none"]');
      presentationElements.forEach(el => {
        const isFocusable = el.matches('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (isFocusable) {
          ariaIssues.push({
            element: getXPath(el),
            html: el.outerHTML.slice(0, 200),
            issue: 'Fokussierbares Element mit role="presentation"',
            severity: 'critical',
            suggestion: 'Entfernen Sie role="presentation" oder verwenden Sie role="button" / role="link" mit entsprechenden ARIA-Attributen'
          });
        }
      });

      // Check for aria-hidden on important content
      const ariaHiddenElements = document.querySelectorAll('[aria-hidden="true"]');
      ariaHiddenElements.forEach(el => {
        const hasInteractive = el.querySelector('a, button, input, [tabindex]');
        if (hasInteractive) {
          ariaIssues.push({
            element: getXPath(el),
            html: el.outerHTML.slice(0, 200),
            issue: 'aria-hidden="true" enthält interaktive Elemente',
            severity: 'critical',
            suggestion: 'Entfernen Sie aria-hidden oder verschieben Sie interaktive Elemente außerhalb'
          });
        }
      });

      // Check for invalid aria-describedby references
      const describedByElements = document.querySelectorAll('[aria-describedby]');
      describedByElements.forEach(el => {
        const ids = el.getAttribute('aria-describedby')?.split(' ') || [];
        ids.forEach(id => {
          if (!document.getElementById(id)) {
            ariaIssues.push({
              element: getXPath(el),
              html: el.outerHTML.slice(0, 200),
              issue: `aria-describedby referenziert nicht existierende ID: "${id}"`,
              severity: 'warning',
              suggestion: `Erstellen Sie ein Element mit id="${id}" oder entfernen Sie die Referenz`
            });
          }
        });
      });

      // Check for aria-labelledby references
      const labelledByElements = document.querySelectorAll('[aria-labelledby]');
      labelledByElements.forEach(el => {
        const ids = el.getAttribute('aria-labelledby')?.split(' ') || [];
        ids.forEach(id => {
          if (!document.getElementById(id)) {
            ariaIssues.push({
              element: getXPath(el),
              html: el.outerHTML.slice(0, 200),
              issue: `aria-labelledby referenziert nicht existierende ID: "${id}"`,
              severity: 'warning',
              suggestion: `Erstellen Sie ein Element mit id="${id}" oder verwenden Sie aria-label stattdessen`
            });
          }
        });
      });

      // Check for duplicate IDs (affects aria-labelledby/describedby)
      const allElements = document.querySelectorAll('*');
      const idCounts: Record<string, number> = {};
      allElements.forEach(el => {
        const id = el.id;
        if (id) {
          idCounts[id] = (idCounts[id] || 0) + 1;
        }
      });
      Object.entries(idCounts).forEach(([id, count]) => {
        if (count > 1) {
          ariaIssues.push({
            element: `//*[@id="${id}"]`,
            html: `<Elemente mit id="${id}">`,
            issue: `Doppelte ID: "${id}" wird ${count} Mal verwendet`,
            severity: 'warning',
            suggestion: 'IDs müssen eindeutig sein. Verwenden Sie eindeutige IDs für jedes Element.'
          });
        }
      });

      // ===== MISSING LABELS =====
      
      // Find inputs without labels
      const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea');
      inputs.forEach(input => {
        const hasLabel = input.closest('label') || 
                        document.querySelector(`label[for="${input.id}"]`) ||
                        input.hasAttribute('aria-label') ||
                        input.hasAttribute('aria-labelledby') ||
                        input.hasAttribute('placeholder') ||
                        input.hasAttribute('title');
        
        if (!hasLabel) {
          missingLabels.push({
            element: getXPath(input),
            html: input.outerHTML.slice(0, 200),
            context: input.closest('form')?.querySelector('legend')?.textContent?.trim() || 'Kein Formular-Kontext'
          });
        }
      });

      // ===== HEADING ANALYSIS =====
      
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const headingLevels: number[] = [];
      
      headings.forEach((heading, index) => {
        const level = parseInt(heading.tagName[1]);
        headingLevels.push(level);
        
        // Check for empty headings
        const text = heading.textContent?.trim() || '';
        const ariaLabel = heading.getAttribute('aria-label') || '';
        const labelledBy = heading.getAttribute('aria-labelledby');
        let labelledByText = '';
        if (labelledBy) {
          const labelEl = document.getElementById(labelledBy);
          labelledByText = labelEl?.textContent?.trim() || '';
        }
        
        if (!text && !ariaLabel && !labelledByText) {
          emptyHeadings.push({
            level,
            html: heading.outerHTML.slice(0, 200),
            text: '(leer)'
          });
        } else if (!text && (ariaLabel || labelledByText)) {
          // Heading has accessible name but no visible text - this is okay for screen readers
          // but might be a visual issue
        }
        
        // Check heading hierarchy
        if (index > 0) {
          const prevLevel = headingLevels[index - 1];
          if (level > prevLevel + 1) {
            headingStructureIssues.push({
              issue: `Überschriften-Hierarchie übersprungen`,
              details: `Von H${prevLevel} zu H${level} (sollte H${prevLevel + 1} sein)`
            });
          }
        }
      });

      // Check for multiple H1s
      const h1s = document.querySelectorAll('h1');
      if (h1s.length > 1) {
        headingStructureIssues.push({
          issue: 'Mehrere H1-Überschriften gefunden',
          details: `${h1s.length} H1-Elemente auf der Seite. Eine Seite sollte typischerweise nur eine H1 haben.`
        });
      }

      // Check for no H1
      if (h1s.length === 0) {
        headingStructureIssues.push({
          issue: 'Keine H1-Überschrift gefunden',
          details: 'Jede Seite sollte eine H1-Überschrift haben, die den Hauptinhalt beschreibt.'
        });
      }

      // Check for paragraphs styled as headings
      const paragraphs = document.querySelectorAll('p');
      paragraphs.forEach(p => {
        const style = window.getComputedStyle(p);
        const fontSize = parseInt(style.fontSize);
        const fontWeight = style.fontWeight;
        const text = p.textContent?.trim() || '';
        
        if (fontSize >= 24 && (fontWeight === 'bold' || fontWeight === '700' || parseInt(fontWeight) >= 700)) {
          if (text.length < 100) {
            headingStructureIssues.push({
              issue: 'Absatz statt Überschrift verwendet',
              details: `Text "${text.slice(0, 50)}..." sieht wie eine Überschrift aus, ist aber ein <p>`
            });
          }
        }
      });

      // ===== FORM ANALYSIS =====
      
      const forms = document.querySelectorAll('form');
      forms.forEach(form => {
        // Check for form without submit button
        const hasSubmit = form.querySelector('button[type="submit"], input[type="submit"]');
        if (!hasSubmit) {
          formIssues.push({
            element: getXPath(form),
            issue: 'Formular ohne Submit-Button',
            suggestion: 'Fügen Sie einen Submit-Button hinzu oder verwenden Sie button[type="submit"]'
          });
        }

        // Check for required fields without visual indicator
        const requiredFields = form.querySelectorAll('[required], [aria-required="true"]');
        requiredFields.forEach(field => {
          const parent = field.closest('label, .form-group, .field');
          if (parent) {
            const text = parent.textContent || '';
            if (!text.includes('*') && !text.includes('(required)') && !text.includes('(erforderlich)')) {
              formIssues.push({
                element: getXPath(field),
                issue: 'Pflichtfeld ohne visuelle Kennzeichnung',
                suggestion: 'Fügen Sie ein Sternchen (*) oder "(erforderlich)" zum Label hinzu'
              });
            }
          }
        });

        // Check for error messages without aria-live
        const errorMessages = form.querySelectorAll('.error, .alert, [class*="error"], [class*="alert"]');
        errorMessages.forEach(error => {
          const hasLive = error.hasAttribute('aria-live') || error.closest('[aria-live]');
          if (!hasLive && error.textContent?.trim()) {
            formIssues.push({
              element: getXPath(error),
              issue: 'Fehlermeldung ohne aria-live',
              suggestion: 'Fügen Sie aria-live="polite" oder aria-live="assertive" hinzu'
            });
          }
        });
      });

      // ===== LINK ANALYSIS =====
      
      const links = document.querySelectorAll('a');
      links.forEach(link => {
        const text = (link.textContent || '').trim().toLowerCase();
        const ariaLabel = link.getAttribute('aria-label') || '';
        const labelledBy = link.getAttribute('aria-labelledby');
        const title = link.getAttribute('title') || '';
        
        // Check for empty links
        if (!text && !ariaLabel && !labelledBy && !title) {
          // Check if it has an image with alt
          const img = link.querySelector('img');
          if (!img || !img.alt) {
            linkIssues.push({
              html: link.outerHTML.slice(0, 200),
              issue: 'empty',
              text: '(leer)'
            });
          }
        }
        
        // Check for generic link text
        const genericTexts = ['click here', 'here', 'read more', 'more', 'link', 'click', 'learn more',
          'details', 'mehr', 'hier', 'weiter', 'mehr erfahren', 'details anzeigen', 'klicken'];
        
        if (genericTexts.some(t => text === t || text.includes(t)) && !ariaLabel) {
          linkIssues.push({
            html: link.outerHTML.slice(0, 200),
            issue: 'generic',
            text: link.textContent?.trim() || ''
          });
        }
      });

      // ===== LANDMARK ANALYSIS =====
      
      const landmarks = {
        main: document.querySelectorAll('main, [role="main"]'),
        navigation: document.querySelectorAll('nav, [role="navigation"]'),
        complementary: document.querySelectorAll('aside, [role="complementary"]'),
        contentinfo: document.querySelectorAll('footer, [role="contentinfo"]'),
        banner: document.querySelectorAll('header, [role="banner"]'),
        search: document.querySelectorAll('[role="search"]'),
        article: document.querySelectorAll('article'),
        section: document.querySelectorAll('section[aria-labelledby], section[aria-label]')
      };

      // Check for missing main landmark
      if (landmarks.main.length === 0) {
        landmarkIssues.push({
          issue: 'Kein <main> oder role="main" Landmark gefunden',
          suggestion: 'Fügen Sie ein <main> Element um den Hauptinhalt hinzu'
        });
      }

      // Check for multiple mains
      if (landmarks.main.length > 1) {
        landmarkIssues.push({
          issue: 'Mehrere main Landmarks gefunden',
          suggestion: 'Eine Seite sollte nur eine main Landmark haben'
        });
      }

      // Check for missing navigation
      if (landmarks.navigation.length === 0) {
        landmarkIssues.push({
          issue: 'Keine Navigation Landmark gefunden',
          suggestion: 'Fügen Sie <nav> oder role="navigation" zur Hauptnavigation hinzu'
        });
      }

      // Check for sections without labels
      const unlabeledSections = document.querySelectorAll('section:not([aria-label]):not([aria-labelledby])');
      if (unlabeledSections.length > 0) {
        landmarkIssues.push({
          issue: `${unlabeledSections.length} section Elemente ohne Label`,
          suggestion: 'Fügen Sie aria-label oder aria-labelledby zu section Elementen hinzu'
        });
      }

      // Calculate score
      const criticalCount = ariaIssues.filter(i => i.severity === 'critical').length +
                           missingLabels.length +
                           emptyHeadings.length +
                           linkIssues.filter(i => i.issue === 'empty').length;
      
      const warningCount = ariaIssues.filter(i => i.severity === 'warning').length +
                          headingStructureIssues.length +
                          formIssues.length +
                          linkIssues.filter(i => i.issue === 'generic').length;
      
      const infoCount = ariaIssues.filter(i => i.severity === 'info').length +
                       landmarkIssues.length;

      return {
        ariaIssues,
        missingLabels,
        emptyHeadings,
        headingStructureIssues,
        formIssues,
        linkIssues,
        landmarkIssues,
        summary: {
          criticalCount,
          warningCount,
          infoCount,
          totalIssues: criticalCount + warningCount + infoCount
        }
      };
    });

    // Calculate screen reader score
    const maxScore = 100;
    const criticalPenalty = 15;
    const warningPenalty = 5;
    const infoPenalty = 1;
    
    let score = maxScore 
      - (results.summary.criticalCount * criticalPenalty)
      - (results.summary.warningCount * warningPenalty)
      - (results.summary.infoCount * infoPenalty);
    
    score = Math.max(0, Math.min(100, score));

    return {
      url,
      timestamp: new Date().toISOString(),
      ariaIssues: results.ariaIssues,
      missingLabels: results.missingLabels,
      emptyHeadings: results.emptyHeadings,
      headingStructureIssues: results.headingStructureIssues,
      formIssues: results.formIssues,
      linkIssues: results.linkIssues,
      landmarkIssues: results.landmarkIssues,
      screenReaderScore: score,
      summary: results.summary
    };

  } catch (error) {
    console.error('Screen reader simulation error:', error);
    throw new Error(`Fehler bei der Screen-Reader-Simulation: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Get screen reader friendly description of the page structure
 */
export function generateScreenReaderSummary(result: ScreenReaderResult): string {
  const parts: string[] = [];
  
  if (result.summary.criticalCount > 0) {
    parts.push(`${result.summary.criticalCount} kritische Probleme gefunden, die Screen-Reader-Benutzer blockieren.`);
  }
  
  if (result.missingLabels.length > 0) {
    parts.push(`${result.missingLabels.length} Formularfelder ohne Beschriftung.`);
  }
  
  if (result.emptyHeadings.length > 0) {
    parts.push(`${result.emptyHeadings.length} leere Überschriften.`);
  }
  
  if (result.linkIssues.length > 0) {
    const empty = result.linkIssues.filter(l => l.issue === 'empty').length;
    const generic = result.linkIssues.filter(l => l.issue === 'generic').length;
    if (empty > 0) parts.push(`${empty} Links ohne Text.`);
    if (generic > 0) parts.push(`${generic} Links mit nicht aussagekräftigem Text.`);
  }
  
  if (parts.length === 0) {
    return 'Keine kritischen Screen-Reader-Probleme gefunden.';
  }
  
  return parts.join(' ');
}
