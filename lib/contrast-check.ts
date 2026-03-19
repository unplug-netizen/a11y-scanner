import { A11yViolation } from '@/types';

/**
 * WCAG Kontrast-Verhältnis Berechnung
 * 
 * WCAG 1.4.3 - Contrast (Minimum): 4.5:1 für normalen Text, 3:1 für großen Text
 * WCAG 1.4.6 - Contrast (Enhanced): 7:1 für normalen Text, 4.5:1 für großen Text
 * WCAG 1.4.11 - Non-text Contrast: 3:1 für UI-Komponenten und Grafiken
 */

export interface ContrastResult {
  ratio: number;
  foreground: string;
  background: string;
  element: string;
  isLargeText: boolean;
  isBold: boolean;
  fontSize: string;
  wcagAA: boolean;
  wcagAAA: boolean;
  wcagAAALarge: boolean;
}

export interface DetailedContrastCheck {
  url: string;
  checks: ContrastResult[];
  violations: ContrastViolation[];
  summary: ContrastSummary;
}

export interface ContrastViolation {
  element: string;
  ratio: number;
  requiredRatio: number;
  level: 'AA' | 'AAA';
  textType: 'normal' | 'large' | 'ui';
  foreground: string;
  background: string;
  suggestion: string;
}

export interface ContrastSummary {
  totalElements: number;
  passedAA: number;
  passedAAA: number;
  failedAA: number;
  failedAAA: number;
  uiComponentsFailed: number;
}

/**
 * Berechnet die relative Luminanz einer Farbe
 * @see https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Parst eine Farbe in RGB-Werte
 */
export function parseColor(color: string): { r: number; g: number; b: number; a: number } | null {
  // Hex
  const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      const [r, g, b] = hex.split('').map(c => parseInt(c + c, 16));
      return { r, g, b, a: 1 };
    } else if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return { r, g, b, a: 1 };
    } else if (hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = parseInt(hex.slice(6, 8), 16) / 255;
      return { r, g, b, a };
    }
  }

  // RGB/RGBA
  const rgbMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
      a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1,
    };
  }

  // HSL/HSLA
  const hslMatch = color.match(/^hsla?\((\d+),\s*(\d+)%,\s*(\d+)%(?:,\s*([\d.]+))?\)$/);
  if (hslMatch) {
    const h = parseInt(hslMatch[1], 10) / 360;
    const s = parseInt(hslMatch[2], 10) / 100;
    const l = parseInt(hslMatch[3], 10) / 100;
    const a = hslMatch[4] ? parseFloat(hslMatch[4]) : 1;

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
    const g = Math.round(hue2rgb(p, q, h) * 255);
    const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);

    return { r, g, b, a };
  }

  // Named colors (common ones)
  const namedColors: Record<string, string> = {
    black: '#000000',
    white: '#ffffff',
    red: '#ff0000',
    green: '#008000',
    blue: '#0000ff',
    yellow: '#ffff00',
    cyan: '#00ffff',
    magenta: '#ff00ff',
    silver: '#c0c0c0',
    gray: '#808080',
    grey: '#808080',
    maroon: '#800000',
    olive: '#808000',
    lime: '#00ff00',
    aqua: '#00ffff',
    teal: '#008080',
    navy: '#000080',
    fuchsia: '#ff00ff',
    purple: '#800080',
    orange: '#ffa500',
    transparent: '#00000000',
  };

  const lowerColor = color.toLowerCase().trim();
  if (namedColors[lowerColor]) {
    return parseColor(namedColors[lowerColor]);
  }

  return null;
}

/**
 * Berechnet das Kontrast-Verhältnis zwischen zwei Farben
 * @see https://www.w3.org/TR/WCAG20/#contrast-ratiodef
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  const c1 = parseColor(color1);
  const c2 = parseColor(color2);

  if (!c1 || !c2) return 1;

  // Handle transparency
  if (c1.a < 1 || c2.a < 1) {
    // Simplified: assume white background for transparency
    const bg = { r: 255, g: 255, b: 255 };
    const blend = (fg: number, bg: number, a: number) => Math.round(fg * a + bg * (1 - a));
    
    const r1 = blend(c1.r, bg.r, c1.a);
    const g1 = blend(c1.g, bg.g, c1.a);
    const b1 = blend(c1.b, bg.b, c1.a);
    const r2 = blend(c2.r, bg.r, c2.a);
    const g2 = blend(c2.g, bg.g, c2.a);
    const b2 = blend(c2.b, bg.b, c2.a);

    const l1 = getRelativeLuminance(r1, g1, b1);
    const l2 = getRelativeLuminance(r2, g2, b2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  const l1 = getRelativeLuminance(c1.r, c1.g, c1.b);
  const l2 = getRelativeLuminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Prüft ob Text als "großer Text" gilt (WCAG Definition)
 * @see https://www.w3.org/TR/WCAG20/#larger-scaledef
 */
export function isLargeText(fontSize: string, fontWeight: string | number): boolean {
  const sizeMatch = fontSize.match(/([\d.]+)(px|pt|em|rem|%)/);
  if (!sizeMatch) return false;

  const size = parseFloat(sizeMatch[1]);
  const unit = sizeMatch[2];

  // Convert to points (approximate)
  let sizeInPt = size;
  if (unit === 'px') sizeInPt = size * 0.75;
  else if (unit === 'em' || unit === 'rem') sizeInPt = size * 12;
  else if (unit === '%') sizeInPt = size * 0.12;

  const weight = typeof fontWeight === 'string' 
    ? (fontWeight === 'bold' ? 700 : parseInt(fontWeight, 10) || 400)
    : fontWeight;

  // Large text: >= 18pt (24px) normal, or >= 14pt (18.5px) bold
  if (weight >= 700) {
    return sizeInPt >= 14;
  }
  return sizeInPt >= 18;
}

/**
 * Generiert Vorschläge für bessere Kontrast-Farben
 */
export function suggestContrastColors(
  foreground: string,
  background: string,
  targetRatio: number
): { foreground?: string; background?: string } {
  const fg = parseColor(foreground);
  const bg = parseColor(background);

  if (!fg || !bg) return {};

  // Try darkening/lightening foreground
  const adjustColor = (c: { r: number; g: number; b: number }, factor: number) => {
    return `rgb(${Math.max(0, Math.min(255, Math.round(c.r * factor)))}, ` +
           `${Math.max(0, Math.min(255, Math.round(c.g * factor)))}, ` +
           `${Math.max(0, Math.min(255, Math.round(c.b * factor)))})`;
  };

  // Try lightening foreground
  for (let i = 1.1; i <= 3; i += 0.1) {
    const newFg = adjustColor(fg, i);
    if (calculateContrastRatio(newFg, background) >= targetRatio) {
      return { foreground: newFg };
    }
  }

  // Try darkening foreground
  for (let i = 0.9; i >= 0.3; i -= 0.1) {
    const newFg = adjustColor(fg, i);
    if (calculateContrastRatio(newFg, background) >= targetRatio) {
      return { foreground: newFg };
    }
  }

  // Try adjusting background
  for (let i = 1.1; i <= 3; i += 0.1) {
    const newBg = adjustColor(bg, i);
    if (calculateContrastRatio(foreground, newBg) >= targetRatio) {
      return { background: newBg };
    }
  }

  for (let i = 0.9; i >= 0.3; i -= 0.1) {
    const newBg = adjustColor(bg, i);
    if (calculateContrastRatio(foreground, newBg) >= targetRatio) {
      return { background: newBg };
    }
  }

  return {};
}

/**
 * Client-seitige Kontrast-Analyse (für Browser)
 */
export function analyzeElementContrast(element: Element): ContrastResult | null {
  const computedStyle = window.getComputedStyle(element);
  const color = computedStyle.color;
  const backgroundColor = computedStyle.backgroundColor;
  const fontSize = computedStyle.fontSize;
  const fontWeight = computedStyle.fontWeight;

  // Skip if no visible text or transparent
  if (!color || color === 'transparent' || !element.textContent?.trim()) {
    return null;
  }

  // Get effective background (handle transparent backgrounds)
  let effectiveBg = backgroundColor;
  if (backgroundColor === 'transparent' || backgroundColor === 'rgba(0, 0, 0, 0)') {
    // Find first non-transparent ancestor
    let parent = element.parentElement;
    while (parent) {
      const parentBg = window.getComputedStyle(parent).backgroundColor;
      if (parentBg !== 'transparent' && parentBg !== 'rgba(0, 0, 0, 0)') {
        effectiveBg = parentBg;
        break;
      }
      parent = parent.parentElement;
    }
    // Default to white if no background found
    if (effectiveBg === 'transparent' || effectiveBg === 'rgba(0, 0, 0, 0)') {
      effectiveBg = 'rgb(255, 255, 255)';
    }
  }

  const ratio = calculateContrastRatio(color, effectiveBg);
  const largeText = isLargeText(fontSize, fontWeight);

  return {
    ratio,
    foreground: color,
    background: effectiveBg,
    element: element.tagName.toLowerCase() + (element.id ? `#${element.id}` : ''),
    isLargeText: largeText,
    isBold: parseInt(fontWeight, 10) >= 700 || fontWeight === 'bold',
    fontSize,
    wcagAA: largeText ? ratio >= 3 : ratio >= 4.5,
    wcagAAA: largeText ? ratio >= 4.5 : ratio >= 7,
    wcagAAALarge: ratio >= 4.5,
  };
}

/**
 * Server-seitige Kontrast-Analyse mit Puppeteer
 */
export async function checkContrastOnPage(page: any): Promise<DetailedContrastCheck> {
  const results = await page.evaluate(() => {
    const checks: any[] = [];
    const violations: any[] = [];

    // Get all text elements
    const textElements = document.querySelectorAll(
      'p, span, a, h1, h2, h3, h4, h5, h6, li, td, th, label, button, input, textarea, select'
    );

    // Get UI components
    const uiElements = document.querySelectorAll(
      'button, input, select, textarea, [role="button"], [role="checkbox"], [role="radio"], ' +
      'a, [tabindex]:not([tabindex="-1"]), svg, img, [role="img"]'
    );

    const analyzeElement = (element: Element, isUI = false) => {
      const computedStyle = window.getComputedStyle(element);
      const color = computedStyle.color;
      const backgroundColor = computedStyle.backgroundColor;
      const fontSize = computedStyle.fontSize;
      const fontWeight = computedStyle.fontWeight;

      // Skip hidden elements
      if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
        return null;
      }

      // Get effective background
      let effectiveBg = backgroundColor;
      if (backgroundColor === 'transparent' || backgroundColor === 'rgba(0, 0, 0, 0)') {
        let parent = element.parentElement;
        while (parent) {
          const parentBg = window.getComputedStyle(parent).backgroundColor;
          if (parentBg !== 'transparent' && parentBg !== 'rgba(0, 0, 0, 0)') {
            effectiveBg = parentBg;
            break;
          }
          parent = parent.parentElement;
        }
        if (effectiveBg === 'transparent' || effectiveBg === 'rgba(0, 0, 0, 0)') {
          effectiveBg = 'rgb(255, 255, 255)';
        }
      }

      // Calculate luminance
      const getLuminance = (r: number, g: number, b: number) => {
        const [rs, gs, bs] = [r, g, b].map(c => {
          c = c / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      };

      const parseColor = (color: string) => {
        const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
          return {
            r: parseInt(rgbMatch[1], 10),
            g: parseInt(rgbMatch[2], 10),
            b: parseInt(rgbMatch[3], 10),
          };
        }
        return null;
      };

      const fg = parseColor(color);
      const bg = parseColor(effectiveBg);

      if (!fg || !bg) return null;

      const l1 = getLuminance(fg.r, fg.g, fg.b);
      const l2 = getLuminance(bg.r, bg.g, bg.b);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      const ratio = (lighter + 0.05) / (darker + 0.05);

      // Check if large text
      const sizeMatch = fontSize.match(/([\d.]+)px/);
      const sizeInPx = sizeMatch ? parseFloat(sizeMatch[1]) : 16;
      const weight = parseInt(fontWeight, 10) || 400;
      const isLarge = weight >= 700 ? sizeInPx >= 18.5 : sizeInPx >= 24;

      const selector = element.tagName.toLowerCase() +
        (element.id ? `#${element.id}` : '') +
        (element.className && typeof element.className === 'string' ? `.${element.className.split(' ')[0]}` : '');

      return {
        ratio: Math.round(ratio * 100) / 100,
        foreground: color,
        background: effectiveBg,
        element: selector,
        isLargeText: isLarge,
        isBold: weight >= 700,
        fontSize,
        wcagAA: isLarge ? ratio >= 3 : ratio >= 4.5,
        wcagAAA: isLarge ? ratio >= 4.5 : ratio >= 7,
        wcagAAALarge: ratio >= 4.5,
        isUI,
      };
    };

    // Analyze text elements
    textElements.forEach(el => {
      const result = analyzeElement(el, false);
      if (result) checks.push(result);
    });

    // Analyze UI elements for non-text contrast (WCAG 1.4.11)
    uiElements.forEach(el => {
      const result = analyzeElement(el, true);
      if (result && result.isUI) {
        // Check non-text contrast (3:1)
        if (result.ratio < 3) {
          violations.push({
            element: result.element,
            ratio: result.ratio,
            requiredRatio: 3,
            level: 'AA',
            textType: 'ui',
            foreground: result.foreground,
            background: result.background,
            suggestion: 'UI-Komponente benötigt Kontrastverhältnis von mindestens 3:1',
          });
        }
      }
    });

    // Find violations
    checks.forEach(check => {
      if (!check.wcagAA) {
        violations.push({
          element: check.element,
          ratio: check.ratio,
          requiredRatio: check.isLargeText ? 3 : 4.5,
          level: 'AA',
          textType: check.isLargeText ? 'large' : 'normal',
          foreground: check.foreground,
          background: check.background,
          suggestion: `${check.isLargeText ? 'Großer Text' : 'Normaler Text'} benötigt Kontrastverhältnis von mindestens ${check.isLargeText ? '3:1' : '4.5:1'}`,
        });
      } else if (!check.wcagAAA) {
        violations.push({
          element: check.element,
          ratio: check.ratio,
          requiredRatio: check.isLargeText ? 4.5 : 7,
          level: 'AAA',
          textType: check.isLargeText ? 'large' : 'normal',
          foreground: check.foreground,
          background: check.background,
          suggestion: `${check.isLargeText ? 'Großer Text' : 'Normaler Text'} für AAA-Konformität benötigt ${check.isLargeText ? '4.5:1' : '7:1'}`,
        });
      }
    });

    const summary = {
      totalElements: checks.length,
      passedAA: checks.filter((c: any) => c.wcagAA).length,
      passedAAA: checks.filter((c: any) => c.wcagAAA).length,
      failedAA: violations.filter((v: any) => v.level === 'AA').length,
      failedAAA: violations.filter((v: any) => v.level === 'AAA').length,
      uiComponentsFailed: violations.filter((v: any) => v.textType === 'ui').length,
    };

    return {
      checks,
      violations,
      summary,
    };
  });

  return {
    url: page.url(),
    checks: results.checks,
    violations: results.violations,
    summary: results.summary,
  };
}

/**
 * Konvertiert Kontrast-Verletzungen in axe-core Format
 */
export function convertContrastToAxeViolation(violation: ContrastViolation): Partial<A11yViolation> {
  return {
    id: `color-contrast-${violation.level.toLowerCase()}`,
    impact: violation.level === 'AA' ? 'serious' : 'moderate',
    description: `Kontrastverhältnis von ${violation.ratio.toFixed(2)}:1 unterschreitet erforderliches ${violation.requiredRatio}:1`,
    help: `WCAG 1.4.${violation.level === 'AA' ? '3' : '6'} Contrast (${violation.level === 'AA' ? 'Minimum' : 'Enhanced'})`,
    helpUrl: `https://www.w3.org/WAI/WCAG21/Understanding/contrast-${violation.level === 'AA' ? 'minimum' : 'enhanced'}.html`,
    tags: [`wcag2${violation.level.toLowerCase()}`, `wcag${violation.level === 'AA' ? '143' : '146'}`],
    nodes: [{
      html: violation.element,
      target: [violation.element],
      failureSummary: violation.suggestion,
    }],
  };
}
