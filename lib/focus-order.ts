import { Page } from 'puppeteer-core';

// Focus-related issue types
export interface FocusIssue {
  type: 'missing-focus-indicator' | 'illogical-tab-order' | 'focus-trap' | 'hidden-focusable' | 'no-focusable-elements';
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  element?: string;
  selector?: string;
  message: string;
  help: string;
  helpUrl: string;
  suggestedFix?: string;
}

export interface FocusOrderResult {
  url: string;
  issues: FocusIssue[];
  focusableElements: FocusableElement[];
  tabOrder: TabOrderItem[];
  hasLogicalTabOrder: boolean;
  scanTimeMs: number;
}

export interface FocusableElement {
  tagName: string;
  selector: string;
  html: string;
  tabIndex: number | null;
  isVisible: boolean;
  hasFocusIndicator: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
}

export interface TabOrderItem {
  index: number;
  selector: string;
  tagName: string;
  tabIndex: number | null;
}

// CSS selectors for focusable elements
const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]',
  'audio[controls]',
  'video[controls]',
  'summary',
  'details > summary',
].join(', ');

/**
 * Analyze focus order and indicators on a page
 */
export async function analyzeFocusOrder(page: Page): Promise<FocusOrderResult> {
  const startTime = Date.now();

  const result = await page.evaluate((selectors) => {
    const issues: FocusIssue[] = [];
    const focusableElements: FocusableElement[] = [];
    const tabOrder: TabOrderItem[] = [];

    // Get all focusable elements
    const elements = Array.from(document.querySelectorAll(selectors));

    if (elements.length === 0) {
      issues.push({
        type: 'no-focusable-elements',
        severity: 'critical',
        message: 'No focusable elements found on the page',
        help: 'Interactive pages should have focusable elements for keyboard navigation',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/keyboard',
      });
    }

    // Track tab order
    const tabOrderMap = new Map<number, Element[]>();

    elements.forEach((el, index) => {
      const htmlElement = el as HTMLElement;
      const computedStyle = window.getComputedStyle(htmlElement);
      const rect = htmlElement.getBoundingClientRect();

      // Check visibility
      const isVisible = computedStyle.display !== 'none' &&
                       computedStyle.visibility !== 'hidden' &&
                       computedStyle.opacity !== '0' &&
                       rect.width > 0 &&
                       rect.height > 0;

      // Get tabindex
      const tabIndexAttr = htmlElement.getAttribute('tabindex');
      const tabIndex = tabIndexAttr !== null ? parseInt(tabIndexAttr, 10) : null;

      // Build selector
      const selector = buildSelector(htmlElement);

      // Check for focus indicator
      const hasFocusIndicator = checkFocusIndicator(htmlElement);

      // Store focusable element info
      focusableElements.push({
        tagName: htmlElement.tagName.toLowerCase(),
        selector,
        html: htmlElement.outerHTML.substring(0, 500),
        tabIndex,
        isVisible,
        hasFocusIndicator,
        ariaLabel: htmlElement.getAttribute('aria-label') || undefined,
        ariaLabelledBy: htmlElement.getAttribute('aria-labelledby') || undefined,
      });

      // Track hidden but focusable elements
      if (!isVisible && tabIndex !== null && tabIndex >= 0) {
        issues.push({
          type: 'hidden-focusable',
          severity: 'serious',
          element: htmlElement.tagName.toLowerCase(),
          selector,
          message: `Hidden element is focusable: ${selector}`,
          help: 'Hidden elements should not be in the tab order',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/focus-order',
          suggestedFix: 'Remove tabindex or make the element visible',
        });
      }

      // Check for missing focus indicator
      if (isVisible && !hasFocusIndicator) {
        issues.push({
          type: 'missing-focus-indicator',
          severity: 'serious',
          element: htmlElement.tagName.toLowerCase(),
          selector,
          message: `Element lacks visible focus indicator: ${selector}`,
          help: 'All interactive elements should have a visible focus indicator',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/focus-visible',
          suggestedFix: 'Add CSS :focus styles with outline or border',
        });
      }

      // Track tab order
      const effectiveTabIndex = tabIndex !== null ? tabIndex : 0;
      if (!tabOrderMap.has(effectiveTabIndex)) {
        tabOrderMap.set(effectiveTabIndex, []);
      }
      tabOrderMap.get(effectiveTabIndex)!.push(htmlElement);
    });

    // Build tab order array
    const sortedTabIndices = Array.from(tabOrderMap.keys()).sort((a, b) => a - b);
    let tabOrderIndex = 0;

    sortedTabIndices.forEach(tabIdx => {
      const elementsAtIndex = tabOrderMap.get(tabIdx)!;
      elementsAtIndex.forEach(el => {
        const htmlEl = el as HTMLElement;
        const selector = buildSelector(htmlEl);
        tabOrder.push({
          index: tabOrderIndex++,
          selector,
          tagName: htmlEl.tagName.toLowerCase(),
          tabIndex: tabIdx === 0 && htmlEl.getAttribute('tabindex') === null ? null : tabIdx,
        });
      });
    });

    // Check for illogical tab order (positive tabindex values)
    const positiveTabIndices = focusableElements.filter(el => 
      el.tabIndex !== null && el.tabIndex > 0
    );

    if (positiveTabIndices.length > 0) {
      issues.push({
        type: 'illogical-tab-order',
        severity: 'moderate',
        message: `${positiveTabIndices.length} elements have positive tabindex values`,
        help: 'Positive tabindex values can create confusing tab order. Use 0 or -1 instead.',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/focus-order',
        suggestedFix: 'Use tabindex="0" for elements in natural DOM order, tabindex="-1" for programmatic focus only',
      });
    }

    // Check for potential focus traps
    const potentialTraps = detectPotentialFocusTraps(elements);
    if (potentialTraps.length > 0) {
      potentialTraps.forEach(trap => {
        issues.push({
          type: 'focus-trap',
          severity: 'serious',
          element: trap.tagName,
          selector: trap.selector,
          message: `Potential focus trap detected: ${trap.selector}`,
          help: 'Ensure users can navigate away from all interactive elements',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/no-keyboard-trap',
          suggestedFix: trap.suggestion,
        });
      });
    }

    return {
      issues,
      focusableElements,
      tabOrder,
      hasLogicalTabOrder: positiveTabIndices.length === 0,
    };

    // Helper function to build a CSS selector for an element
    function buildSelector(el: HTMLElement): string {
      const parts: string[] = [];
      let current: HTMLElement | null = el;

      while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        
        if (current.id) {
          selector += `#${current.id}`;
          parts.unshift(selector);
          break;
        }
        
        if (current.className && typeof current.className === 'string') {
          const classes = current.className.split(' ').filter(c => c).slice(0, 2);
          if (classes.length > 0) {
            selector += `.${classes.join('.')}`;
          }
        }
        
        const siblings = Array.from(current.parentElement?.children || [])
          .filter(s => s.tagName === current!.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
        
        parts.unshift(selector);
        current = current.parentElement;
      }

      return parts.join(' > ');
    }

    // Helper function to check if element has visible focus indicator
    function checkFocusIndicator(el: HTMLElement): boolean {
      const computedStyle = window.getComputedStyle(el);
      
      // Check for explicit outline
      if (computedStyle.outlineStyle !== 'none' && computedStyle.outlineWidth !== '0px') {
        return true;
      }

      // Check for box-shadow that could be a focus indicator
      if (computedStyle.boxShadow && computedStyle.boxShadow !== 'none') {
        return true;
      }

      // Check for border changes on focus (via CSS)
      // This is a heuristic - we can't easily detect :focus styles
      const focusStyles = document.styleSheets;
      for (let i = 0; i < focusStyles.length; i++) {
        try {
          const rules = focusStyles[i].cssRules || focusStyles[i].rules;
          for (let j = 0; j < rules.length; j++) {
            const rule = rules[j] as CSSStyleRule;
            if (rule.selectorText && 
                (rule.selectorText.includes(':focus') || rule.selectorText.includes(':focus-visible')) &&
                el.matches(rule.selectorText.replace(/:focus-visible?/g, ''))) {
              return true;
            }
          }
        } catch {
          // Cross-origin stylesheets may throw
          continue;
        }
      }

      // Default: assume browser default focus indicator exists
      // But flag if element has explicit outline: none
      return computedStyle.outlineStyle !== 'none' || 
             !el.matches('[style*="outline: none"], [style*="outline:none"]');
    }

    // Helper function to detect potential focus traps
    function detectPotentialFocusTraps(elements: Element[]): Array<{
      tagName: string;
      selector: string;
      suggestion: string;
    }> {
      const traps: Array<{ tagName: string; selector: string; suggestion: string }> = [];

      elements.forEach(el => {
        const htmlEl = el as HTMLElement;
        const tagName = htmlEl.tagName.toLowerCase();

        // Check for common trap patterns
        if (tagName === 'div' && htmlEl.getAttribute('role') === 'dialog') {
          const hasCloseButton = htmlEl.querySelector('[aria-label*="close" i], [aria-label*="schließen" i], button[aria-label]');
          if (!hasCloseButton) {
            traps.push({
              tagName,
              selector: buildSelector(htmlEl),
              suggestion: 'Add a visible close button with keyboard support (Escape key)',
            });
          }
        }

        // Check for iframe without title
        if (tagName === 'iframe' && !htmlEl.getAttribute('title')) {
          traps.push({
            tagName,
            selector: buildSelector(htmlEl),
            suggestion: 'Add a descriptive title attribute to the iframe',
          });
        }
      });

      return traps;
    }
  }, FOCUSABLE_SELECTORS);

  return {
    url: page.url(),
    issues: result.issues,
    focusableElements: result.focusableElements,
    tabOrder: result.tabOrder,
    hasLogicalTabOrder: result.hasLogicalTabOrder,
    scanTimeMs: Date.now() - startTime,
  };
}

/**
 * Convert FocusOrderResult to A11yViolation format for consistency
 */
export function focusIssuesToViolations(result: FocusOrderResult): Array<{
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary?: string;
  }>;
}> {
  const typeToId: Record<string, string> = {
    'missing-focus-indicator': 'focus-visible',
    'illogical-tab-order': 'focus-order-semantics',
    'focus-trap': 'no-keyboard-trap',
    'hidden-focusable': 'focus-order-semantics',
    'no-focusable-elements': 'keyboard',
  };

  return result.issues.map(issue => ({
    id: typeToId[issue.type] || 'focus-order',
    impact: issue.severity,
    description: issue.message,
    help: issue.help,
    helpUrl: issue.helpUrl,
    tags: ['wcag2a', 'wcag211', 'keyboard'],
    nodes: issue.selector ? [{
      html: issue.element || 'unknown',
      target: [issue.selector],
      failureSummary: issue.suggestedFix,
    }] : [],
  }));
}
