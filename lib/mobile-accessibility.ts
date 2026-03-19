import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { join } from 'path';

// Types for mobile accessibility results
export interface TouchTarget {
  element: string;
  html: string;
  width: number;
  height: number;
  compliant: boolean;
  recommendedSize: string;
  x: number;
  y: number;
}

export interface ViewportIssue {
  issue: string;
  current: string;
  recommended: string;
}

export interface ZoomIssue {
  issue: string;
  meta: string;
  suggestion: string;
}

export interface TouchActionIssue {
  element: string;
  issue: string;
  suggestion: string;
}

export interface MobileWCAGIssue {
  criterion: string;
  issue: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
}

export interface DeviceTest {
  device: string;
  width: number;
  height: number;
  issues: string[];
}

export interface MobileAccessibilityResult {
  url: string;
  timestamp: string;
  
  // Touch Target Analysis
  touchTargets: TouchTarget[];
  nonCompliantTargets: TouchTarget[];
  
  // Viewport Configuration
  viewportIssues: ViewportIssue[];
  viewportConfig: {
    width: string;
    initialScale: string;
    userScalable: boolean;
    maximumScale: string | null;
    minimumScale: string | null;
  } | null;
  
  // Zoom/Scale Issues
  zoomIssues: ZoomIssue[];
  
  // Touch Action Issues
  touchActionIssues: TouchActionIssue[];
  
  // Mobile-Specific WCAG Issues
  mobileWcagIssues: MobileWCAGIssue[];
  
  // Device Simulation Results
  deviceTests: DeviceTest[];
  
  // Overall Score (0-100)
  mobileScore: number;
  
  // Summary
  summary: {
    totalTargets: number;
    nonCompliantCount: number;
    criticalIssues: number;
    warningIssues: number;
    infoIssues: number;
  };
  
  // Recommendations
  recommendations: string[];
}

// WCAG 2.5.5 Target Size (Enhanced) - 44x44px
// WCAG 2.5.5 AA (recommended) - 24x24px minimum
const MIN_TOUCH_TARGET_SIZE = 24; // WCAG AA minimum
const RECOMMENDED_TOUCH_TARGET_SIZE = 44; // WCAG AAA / iOS HIG / Material Design

// Device viewports for testing
const TEST_DEVICES = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 14', width: 390, height: 844 },
  { name: 'iPhone 14 Pro Max', width: 430, height: 932 },
  { name: 'Samsung S22', width: 360, height: 780 },
  { name: 'iPad Mini', width: 768, height: 1024 },
];

/**
 * Analyze mobile accessibility of a webpage
 */
export async function analyzeMobileAccessibility(url: string): Promise<MobileAccessibilityResult> {
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
    
    // Set mobile viewport
    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Run mobile accessibility analysis
    const results = await page.evaluate((minSize, recSize) => {
      const touchTargets: TouchTarget[] = [];
      const nonCompliantTargets: TouchTarget[] = [];
      const viewportIssues: ViewportIssue[] = [];
      const zoomIssues: ZoomIssue[] = [];
      const touchActionIssues: TouchActionIssue[] = [];
      const mobileWcagIssues: MobileWCAGIssue[] = [];
      const recommendations: string[] = [];

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

      // ===== VIEWPORT ANALYSIS =====
      
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      let viewportConfig = null;
      
      if (viewportMeta) {
        const content = viewportMeta.getAttribute('content') || '';
        const width = content.match(/width=([^,]+)/)?.[1] || '';
        const initialScale = content.match(/initial-scale=([^,]+)/)?.[1] || '';
        const userScalable = !content.includes('user-scalable=no');
        const maximumScale = content.match(/maximum-scale=([^,]+)/)?.[1] || null;
        const minimumScale = content.match(/minimum-scale=([^,]+)/)?.[1] || null;
        
        viewportConfig = {
          width,
          initialScale,
          userScalable,
          maximumScale,
          minimumScale
        };
        
        // Check for user-scalable=no
        if (!userScalable) {
          zoomIssues.push({
            issue: 'user-scalable=no verhindert Zoom',
            meta: content,
            suggestion: 'Entfernen Sie user-scalable=no oder setzen Sie user-scalable=yes'
          });
          mobileWcagIssues.push({
            criterion: '1.4.4 Resize Text (AA)',
            issue: 'Zoom ist durch user-scalable=no deaktiviert',
            impact: 'serious'
          });
        }
        
        // Check for maximum-scale limitation
        if (maximumScale && parseFloat(maximumScale) < 2) {
          zoomIssues.push({
            issue: `maximum-scale=${maximumScale} limitiert Zoom zu stark`,
            meta: content,
            suggestion: 'Erhöhen Sie maximum-scale auf mindestens 2.0 oder entfernen Sie die Einschränkung'
          });
          mobileWcagIssues.push({
            criterion: '1.4.4 Resize Text (AA)',
            issue: `maximum-scale=${maximumScale} erlaubt nicht ausreichendes Zoomen`,
            impact: 'moderate'
          });
        }
        
        // Check for width=device-width
        if (width !== 'device-width') {
          viewportIssues.push({
            issue: 'Viewport width ist nicht auf device-width gesetzt',
            current: width || '(nicht gesetzt)',
            recommended: 'width=device-width'
          });
        }
      } else {
        viewportIssues.push({
          issue: 'Kein Viewport Meta-Tag gefunden',
          current: '(fehlt)',
          recommended: '<meta name="viewport" content="width=device-width, initial-scale=1">'
        });
        mobileWcagIssues.push({
          criterion: '1.4.4 Resize Text (AA)',
          issue: 'Fehlendes Viewport Meta-Tag verhindert responsive Darstellung',
          impact: 'serious'
        });
      }

      // ===== TOUCH TARGET ANALYSIS =====
      
      // Get all interactive elements
      const interactiveSelectors = [
        'button',
        'a',
        'input:not([type="hidden"])',
        'select',
        'textarea',
        '[role="button"]',
        '[role="link"]',
        '[onclick]',
        '[tabindex]:not([tabindex="-1"])'
      ];
      
      const interactiveElements = document.querySelectorAll(interactiveSelectors.join(', '));
      
      interactiveElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(el);
        
        // Skip hidden elements
        if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
          return;
        }
        
        const width = rect.width;
        const height = rect.height;
        
        // Check if element is actually clickable/tappable
        const isClickable = el.tagName === 'BUTTON' ||
                           el.tagName === 'A' ||
                           el.tagName === 'INPUT' ||
                           el.tagName === 'SELECT' ||
                           el.tagName === 'TEXTAREA' ||
                           el.hasAttribute('onclick') ||
                           computedStyle.cursor === 'pointer';
        
        if (!isClickable) return;
        
        const compliant = width >= minSize && height >= minSize;
        const recommended = width >= recSize && height >= recSize;
        
        const target: TouchTarget = {
          element: getXPath(el),
          html: el.outerHTML.slice(0, 200),
          width: Math.round(width),
          height: Math.round(height),
          compliant,
          recommendedSize: recommended ? 'optimal' : (width >= minSize && height >= minSize ? 'minimum' : 'zu klein'),
          x: Math.round(rect.x),
          y: Math.round(rect.y)
        };
        
        touchTargets.push(target);
        
        if (!compliant) {
          nonCompliantTargets.push(target);
        }
      });

      // ===== TOUCH ACTION ANALYSIS =====
      
      // Check for elements with touch-action: none
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const touchAction = style.touchAction;
        
        if (touchAction === 'none') {
          touchActionIssues.push({
            element: getXPath(el),
            issue: 'touch-action: none verhindert Touch-Gesten',
            suggestion: 'Entfernen Sie touch-action: none oder beschränken Sie es auf spezifische Gesten'
          });
        }
      });

      // Check for horizontal scrolling
      const bodyWidth = document.body.scrollWidth;
      const viewportWidth = window.innerWidth;
      
      if (bodyWidth > viewportWidth) {
        mobileWcagIssues.push({
          criterion: '1.4.10 Reflow (AA)',
          issue: 'Horizontales Scrollen erforderlich bei 320px Viewport',
          impact: 'serious'
        });
        recommendations.push('Inhalt sollte ohne horizontales Scrollen bei 320px Viewport darstellbar sein');
      }

      // ===== INPUT TYPE ANALYSIS =====
      
      const inputs = document.querySelectorAll('input');
      inputs.forEach(input => {
        const type = input.getAttribute('type') || 'text';
        
        // Check for telephone inputs without tel type
        if (input.getAttribute('inputmode') === 'tel' && type !== 'tel') {
          mobileWcagIssues.push({
            criterion: '1.3.5 Identify Input Purpose (AA)',
            issue: 'Telefon-Eingabe ohne type="tel"',
            impact: 'moderate'
          });
        }
        
        // Check for email inputs
        const placeholder = input.placeholder?.toLowerCase() || '';
        const name = input.name?.toLowerCase() || '';
        const id = input.id?.toLowerCase() || '';
        
        if ((placeholder.includes('email') || name.includes('email') || id.includes('email')) && 
            type !== 'email') {
          mobileWcagIssues.push({
            criterion: '1.3.5 Identify Input Purpose (AA)',
            issue: 'E-Mail-Eingabe ohne type="email"',
            impact: 'moderate'
          });
        }
      });

      // ===== SPACING ANALYSIS =====
      
      // Check for elements that are too close together
      const clickables = Array.from(document.querySelectorAll('button, a, input, [role="button"]'));
      for (let i = 0; i < clickables.length; i++) {
        for (let j = i + 1; j < clickables.length; j++) {
          const rect1 = clickables[i].getBoundingClientRect();
          const rect2 = clickables[j].getBoundingClientRect();
          
          // Check horizontal spacing
          const horizontalGap = Math.max(0, Math.max(rect1.left, rect2.left) - Math.min(rect1.right, rect2.right));
          // Check vertical spacing
          const verticalGap = Math.max(0, Math.max(rect1.top, rect2.top) - Math.min(rect1.bottom, rect2.bottom));
          
          // If elements are adjacent (no gap) and both are small
          if (horizontalGap === 0 && verticalGap === 0) {
            const minDim1 = Math.min(rect1.width, rect1.height);
            const minDim2 = Math.min(rect2.width, rect2.height);
            
            if (minDim1 < recSize && minDim2 < recSize) {
              // Elements are close - this might be an issue
            }
          }
        }
      }

      // ===== FONT SIZE ANALYSIS =====
      
      const rootFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize);
      if (rootFontSize < 14) {
        mobileWcagIssues.push({
          criterion: '1.4.4 Resize Text (AA)',
          issue: `Root-Font-Size ist ${rootFontSize}px, sollte mindestens 16px sein`,
          impact: 'moderate'
        });
      }

      // Generate recommendations
      if (nonCompliantTargets.length > 0) {
        recommendations.push(`${nonCompliantTargets.length} Touch-Targets sind kleiner als ${minSize}x${minSize}px (WCAG AA Minimum)`);
      }
      
      if (touchTargets.filter(t => t.recommendedSize !== 'optimal').length > 0) {
        recommendations.push(`Erhöhen Sie Touch-Targets auf mindestens ${recSize}x${recSize}px für bessere Bedienbarkeit`);
      }

      return {
        touchTargets,
        nonCompliantTargets,
        viewportIssues,
        viewportConfig,
        zoomIssues,
        touchActionIssues,
        mobileWcagIssues,
        recommendations
      };
    }, MIN_TOUCH_TARGET_SIZE, RECOMMENDED_TOUCH_TARGET_SIZE);

    // Test different device viewports
    const deviceTests: DeviceTest[] = [];
    
    for (const device of TEST_DEVICES.slice(0, 3)) { // Test first 3 devices
      try {
        await page.setViewport({
          width: device.width,
          height: device.height,
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true
        });
        
        await page.reload({ waitUntil: 'networkidle2', timeout: 20000 });
        
        const deviceIssues = await page.evaluate(() => {
          const issues: string[] = [];
          
          // Check for horizontal overflow
          const bodyWidth = document.body.scrollWidth;
          const viewportWidth = window.innerWidth;
          
          if (bodyWidth > viewportWidth) {
            issues.push('Horizontales Scrollen erforderlich');
          }
          
          // Check for text truncation
          const elements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, button');
          elements.forEach(el => {
            const style = window.getComputedStyle(el);
            if (style.overflow === 'hidden' && style.textOverflow === 'ellipsis') {
              // Text might be truncated - check if it's a problem
            }
          });
          
          return issues;
        });
        
        deviceTests.push({
          device: device.name,
          width: device.width,
          height: device.height,
          issues: deviceIssues
        });
      } catch (e) {
        // Skip failed device tests
      }
    }

    // Calculate mobile score
    const maxScore = 100;
    const nonCompliantCount = results.nonCompliantTargets.length;
    const criticalIssues = results.mobileWcagIssues.filter(i => i.impact === 'critical' || i.impact === 'serious').length;
    const warningIssues = results.mobileWcagIssues.filter(i => i.impact === 'moderate').length;
    const infoIssues = results.mobileWcagIssues.filter(i => i.impact === 'minor').length + results.viewportIssues.length;
    
    const penalties = {
      nonCompliant: 5,
      critical: 15,
      warning: 5,
      info: 1
    };
    
    let score = maxScore
      - (Math.min(nonCompliantCount, 5) * penalties.nonCompliant)
      - (criticalIssues * penalties.critical)
      - (warningIssues * penalties.warning)
      - (infoIssues * penalties.info);
    
    score = Math.max(0, Math.min(100, score));

    return {
      url,
      timestamp: new Date().toISOString(),
      touchTargets: results.touchTargets,
      nonCompliantTargets: results.nonCompliantTargets,
      viewportIssues: results.viewportIssues,
      viewportConfig: results.viewportConfig,
      zoomIssues: results.zoomIssues,
      touchActionIssues: results.touchActionIssues,
      mobileWcagIssues: results.mobileWcagIssues,
      deviceTests,
      mobileScore: score,
      summary: {
        totalTargets: results.touchTargets.length,
        nonCompliantCount,
        criticalIssues,
        warningIssues,
        infoIssues
      },
      recommendations: results.recommendations
    };

  } catch (error) {
    console.error('Mobile accessibility analysis error:', error);
    throw new Error(`Fehler bei der Mobile-Accessibility-Analyse: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate human-readable summary of mobile issues
 */
export function generateMobileSummary(result: MobileAccessibilityResult): string {
  const parts: string[] = [];
  
  if (result.nonCompliantTargets.length > 0) {
    parts.push(`${result.nonCompliantTargets.length} Touch-Targets sind zu klein (mindestens 24x24px empfohlen).`);
  }
  
  if (result.zoomIssues.length > 0) {
    parts.push('Zoom-Funktionalität ist eingeschränkt.');
  }
  
  if (result.viewportIssues.length > 0) {
    parts.push('Viewport-Konfiguration hat Probleme.');
  }
  
  if (result.mobileWcagIssues.length > 0) {
    const critical = result.mobileWcagIssues.filter(i => i.impact === 'critical' || i.impact === 'serious').length;
    if (critical > 0) {
      parts.push(`${critical} kritische WCAG-Verstöße gefunden.`);
    }
  }
  
  if (parts.length === 0) {
    return 'Keine kritischen Mobile-Accessibility-Probleme gefunden.';
  }
  
  return parts.join(' ');
}

/**
 * Get specific recommendations for mobile improvements
 */
export function getMobileRecommendations(result: MobileAccessibilityResult): string[] {
  const recommendations: string[] = [...result.recommendations];
  
  if (result.nonCompliantTargets.length > 0) {
    recommendations.push('Erhöhen Sie die Größe von Touch-Targets auf mindestens 44x44px für optimale Bedienbarkeit');
  }
  
  if (result.zoomIssues.some(z => z.issue.includes('user-scalable'))) {
    recommendations.push('Entfernen Sie user-scalable=no aus dem Viewport Meta-Tag');
  }
  
  if (result.viewportConfig && !result.viewportConfig.userScalable) {
    recommendations.push('Erlauben Sie Benutzern das Zoomen der Seite');
  }
  
  if (result.touchActionIssues.length > 0) {
    recommendations.push('Überprüfen Sie touch-action CSS-Eigenschaften - diese sollten nicht auf "none" gesetzt sein');
  }
  
  return recommendations;
}
