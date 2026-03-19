import { A11yViolation, ScanResult } from '@/types';

// False positive rule types
export interface FalsePositiveRule {
  id: string;
  violationId: string;
  urlPattern?: string;
  selectorPattern?: string;
  htmlPattern?: string;
  reason: string;
  createdAt: string;
  createdBy: string;
}

export interface FilterResult {
  filteredViolations: A11yViolation[];
  filteredCount: number;
  appliedRules: string[];
  falsePositives: Array<{
    violation: A11yViolation;
    ruleId: string;
    reason: string;
  }>;
}

// Common false positive patterns
const DEFAULT_FALSE_POSITIVE_PATTERNS: Omit<FalsePositiveRule, 'id' | 'createdAt' | 'createdBy'>[] = [
  {
    violationId: 'color-contrast',
    selectorPattern: '.*\\.disabled.*|.*\\[disabled\\].*|.*\\.inactive.*',
    reason: 'Disabled elements are exempt from contrast requirements',
  },
  {
    violationId: 'color-contrast',
    htmlPattern: '.*aria-disabled=\"true\".*',
    reason: 'ARIA disabled elements are exempt from contrast requirements',
  },
  {
    violationId: 'image-alt',
    selectorPattern: '.*\\.avatar.*|.*\\.icon.*|.*\\.decorative.*',
    reason: 'Decorative images may have empty alt text intentionally',
  },
  {
    violationId: 'link-name',
    selectorPattern: '.*\\.social.*|.*\\.icon-link.*',
    reason: 'Icon links often use aria-label instead of visible text',
  },
  {
    violationId: 'button-name',
    selectorPattern: '.*\\.icon-button.*|.*\\[aria-label\\].*',
    reason: 'Icon buttons use aria-label for accessibility',
  },
  {
    violationId: 'aria-hidden-focus',
    selectorPattern: '.*\\.modal.*|.*\\.dialog.*|.*\\.overlay.*',
    reason: 'Modal overlays may have aria-hidden during transitions',
  },
  {
    violationId: 'region',
    htmlPattern: '.*role=\"main\".*|.*role=\"contentinfo\".*|.*role=\"complementary\".*',
    reason: 'Explicit ARIA roles define regions without landmarks',
  },
];

/**
 * Create a false positive rule
 */
export function createFalsePositiveRule(
  violationId: string,
  options: {
    urlPattern?: string;
    selectorPattern?: string;
    htmlPattern?: string;
    reason: string;
  },
  createdBy: string
): FalsePositiveRule {
  return {
    id: `fp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    violationId,
    urlPattern: options.urlPattern,
    selectorPattern: options.selectorPattern,
    htmlPattern: options.htmlPattern,
    reason: options.reason,
    createdAt: new Date().toISOString(),
    createdBy,
  };
}

/**
 * Check if a violation matches a false positive rule
 */
export function matchesFalsePositiveRule(
  violation: A11yViolation,
  url: string,
  rule: FalsePositiveRule
): boolean {
  // Check violation ID match
  if (!violation.id.includes(rule.violationId) && !rule.violationId.includes(violation.id)) {
    return false;
  }

  // Check URL pattern
  if (rule.urlPattern) {
    const urlRegex = new RegExp(rule.urlPattern, 'i');
    if (!urlRegex.test(url)) {
      return false;
    }
  }

  // Check selector pattern against all nodes
  if (rule.selectorPattern) {
    const selectorRegex = new RegExp(rule.selectorPattern, 'i');
    const hasMatchingSelector = violation.nodes.some(node => 
      node.target.some(selector => selectorRegex.test(selector))
    );
    if (!hasMatchingSelector) {
      return false;
    }
  }

  // Check HTML pattern against all nodes
  if (rule.htmlPattern) {
    const htmlRegex = new RegExp(rule.htmlPattern, 'i');
    const hasMatchingHtml = violation.nodes.some(node => 
      htmlRegex.test(node.html)
    );
    if (!hasMatchingHtml) {
      return false;
    }
  }

  return true;
}

/**
 * Filter false positives from scan results
 */
export function filterFalsePositives(
  violations: A11yViolation[],
  url: string,
  rules: FalsePositiveRule[]
): FilterResult {
  const filteredViolations: A11yViolation[] = [];
  const falsePositives: FilterResult['falsePositives'] = [];
  const appliedRules = new Set<string>();

  for (const violation of violations) {
    let isFalsePositive = false;
    let matchedRule: FalsePositiveRule | null = null;

    for (const rule of rules) {
      if (matchesFalsePositiveRule(violation, url, rule)) {
        isFalsePositive = true;
        matchedRule = rule;
        appliedRules.add(rule.id);
        break;
      }
    }

    if (isFalsePositive && matchedRule) {
      falsePositives.push({
        violation,
        ruleId: matchedRule.id,
        reason: matchedRule.reason,
      });
    } else {
      filteredViolations.push(violation);
    }
  }

  return {
    filteredViolations,
    filteredCount: falsePositives.length,
    appliedRules: Array.from(appliedRules),
    falsePositives,
  };
}

/**
 * Filter false positives from a complete scan result
 */
export function filterScanFalsePositives(
  scanResult: ScanResult,
  rules: FalsePositiveRule[]
): ScanResult & {
  filterStats: {
    originalCount: number;
    filteredCount: number;
    appliedRules: string[];
  };
} {
  const filterResult = filterFalsePositives(
    scanResult.violations,
    scanResult.url,
    rules
  );

  return {
    ...scanResult,
    violations: filterResult.filteredViolations,
    filterStats: {
      originalCount: scanResult.violations.length,
      filteredCount: filterResult.filteredCount,
      appliedRules: filterResult.appliedRules,
    },
  };
}

/**
 * Get default false positive rules
 */
export function getDefaultFalsePositiveRules(userId: string): FalsePositiveRule[] {
  return DEFAULT_FALSE_POSITIVE_PATTERNS.map((pattern, index) => ({
    ...pattern,
    id: `default-${index}`,
    createdAt: new Date().toISOString(),
    createdBy: 'system',
  }));
}

/**
 * Suggest false positive rules based on common patterns
 */
export function suggestFalsePositiveRules(
  violations: A11yViolation[],
  url: string
): Array<{
  violation: A11yViolation;
  suggestion: string;
  confidence: 'high' | 'medium' | 'low';
}> {
  const suggestions: Array<{
    violation: A11yViolation;
    suggestion: string;
    confidence: 'high' | 'medium' | 'low';
  }> = [];

  for (const violation of violations) {
    // Check for disabled elements with contrast issues
    if (violation.id.includes('color-contrast')) {
      const hasDisabledElements = violation.nodes.some(node =>
        node.html.includes('disabled') || 
        node.target.some(s => s.includes('disabled'))
      );
      if (hasDisabledElements) {
        suggestions.push({
          violation,
          suggestion: 'Filter disabled elements from color-contrast checks',
          confidence: 'high',
        });
      }
    }

    // Check for icon-only buttons
    if (violation.id.includes('button-name') || violation.id.includes('link-name')) {
      const hasIconOnly = violation.nodes.some(node =>
        node.html.includes('aria-label') ||
        node.target.some(s => s.includes('icon'))
      );
      if (hasIconOnly) {
        suggestions.push({
          violation,
          suggestion: 'Icon buttons with aria-label are accessible',
          confidence: 'medium',
        });
      }
    }

    // Check for decorative images
    if (violation.id.includes('image-alt')) {
      const hasDecorative = violation.nodes.some(node =>
        node.target.some(s => s.includes('avatar') || s.includes('icon') || s.includes('decorative'))
      );
      if (hasDecorative) {
        suggestions.push({
          violation,
          suggestion: 'Decorative images may intentionally have empty alt text',
          confidence: 'medium',
        });
      }
    }
  }

  return suggestions;
}

/**
 * Validate a false positive rule
 */
export function validateFalsePositiveRule(
  rule: Omit<FalsePositiveRule, 'id' | 'createdAt' | 'createdBy'>
): { valid: boolean; error?: string } {
  if (!rule.violationId) {
    return { valid: false, error: 'Violation ID is required' };
  }

  if (!rule.urlPattern && !rule.selectorPattern && !rule.htmlPattern) {
    return { valid: false, error: 'At least one pattern (url, selector, or html) is required' };
  }

  if (!rule.reason) {
    return { valid: false, error: 'Reason is required' };
  }

  // Validate regex patterns
  try {
    if (rule.urlPattern) new RegExp(rule.urlPattern);
    if (rule.selectorPattern) new RegExp(rule.selectorPattern);
    if (rule.htmlPattern) new RegExp(rule.htmlPattern);
  } catch (e) {
    return { valid: false, error: 'Invalid regex pattern' };
  }

  return { valid: true };
}
