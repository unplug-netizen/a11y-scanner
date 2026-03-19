/**
 * @jest-environment node
 */

import { scanWebsite, scanWebsiteLegacy, calculateCompliance } from '../lib/scan-server';
import { A11yViolation } from '@/types';

// Mock dependencies
jest.mock('puppeteer-core');
jest.mock('@sparticuz/chromium');
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('mock axe content'),
  existsSync: jest.fn().mockReturnValue(true),
}));

describe('calculateCompliance', () => {
  it('should return compliant for empty violations', async () => {
    const compliance = await calculateCompliance([]);
    
    expect(compliance.wcag21.A).toBe(true);
    expect(compliance.wcag21.AA).toBe(true);
    expect(compliance.wcag21.AAA).toBe(true);
    expect(compliance.wcag22.A).toBe(true);
    expect(compliance.wcag22.AA).toBe(true);
    expect(compliance.wcag22.AAA).toBe(true);
    expect(compliance.section508).toBe(true);
  });

  it('should detect WCAG 2.1 A violations', async () => {
    const violations: A11yViolation[] = [
      {
        id: 'test-1',
        impact: 'critical',
        description: 'Test',
        help: 'Test help',
        helpUrl: 'https://example.com',
        tags: ['wcag2a'],
        nodes: [],
      },
    ];
    
    const compliance = await calculateCompliance(violations);
    expect(compliance.wcag21.A).toBe(false);
    expect(compliance.wcag21.AA).toBe(false);
    expect(compliance.wcag22.A).toBe(false);
    expect(compliance.wcag22.AA).toBe(false);
  });

  it('should detect WCAG 2.1 AA violations', async () => {
    const violations: A11yViolation[] = [
      {
        id: 'test-1',
        impact: 'serious',
        description: 'Test',
        help: 'Test help',
        helpUrl: 'https://example.com',
        tags: ['wcag2aa'],
        nodes: [],
      },
    ];
    
    const compliance = await calculateCompliance(violations);
    expect(compliance.wcag21.A).toBe(true);
    expect(compliance.wcag21.AA).toBe(false);
    expect(compliance.wcag22.AA).toBe(false);
  });

  it('should detect WCAG 2.2 AA violations', async () => {
    const violations: A11yViolation[] = [
      {
        id: 'test-1',
        impact: 'serious',
        description: 'Test',
        help: 'Test help',
        helpUrl: 'https://example.com',
        tags: ['wcag22aa'],
        nodes: [],
      },
    ];
    
    const compliance = await calculateCompliance(violations);
    expect(compliance.wcag21.A).toBe(true);
    expect(compliance.wcag21.AA).toBe(true);
    expect(compliance.wcag22.A).toBe(true);
    expect(compliance.wcag22.AA).toBe(false);
  });

  it('should detect Section 508 violations', async () => {
    const violations: A11yViolation[] = [
      {
        id: 'test-1',
        impact: 'serious',
        description: 'Test',
        help: 'Test help',
        helpUrl: 'https://example.com',
        tags: ['section508'],
        nodes: [],
      },
    ];
    
    const compliance = await calculateCompliance(violations);
    expect(compliance.section508).toBe(false);
  });

  it('should handle multiple violations', async () => {
    const violations: A11yViolation[] = [
      {
        id: 'test-1',
        impact: 'critical',
        description: 'Test',
        help: 'Test help',
        helpUrl: 'https://example.com',
        tags: ['wcag2a', 'wcag2aa', 'wcag22aa'],
        nodes: [],
      },
    ];
    
    const compliance = await calculateCompliance(violations);
    expect(compliance.wcag21.A).toBe(false);
    expect(compliance.wcag21.AA).toBe(false);
    expect(compliance.wcag22.AA).toBe(false);
  });
});
