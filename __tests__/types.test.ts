import { A11yViolation, ScanResult, ComplianceStatus, PageResult } from '@/types';

describe('Types', () => {
  describe('A11yViolation', () => {
    it('should have all required fields', () => {
      const violation: A11yViolation = {
        id: 'test-id',
        impact: 'critical',
        description: 'Test description',
        help: 'Test help',
        helpUrl: 'https://example.com/help',
        tags: ['wcag2a', 'wcag411'],
        nodes: [
          {
            html: '<div>Test</div>',
            target: ['#test'],
            failureSummary: 'Test failure',
          },
        ],
      };

      expect(violation.id).toBeDefined();
      expect(violation.impact).toBe('critical');
      expect(violation.description).toBeDefined();
      expect(violation.help).toBeDefined();
      expect(violation.helpUrl).toBeDefined();
      expect(violation.tags).toBeInstanceOf(Array);
      expect(violation.nodes).toBeInstanceOf(Array);
    });

    it('should accept all impact levels', () => {
      const impacts: Array<A11yViolation['impact']> = ['critical', 'serious', 'moderate', 'minor', null];
      
      impacts.forEach(impact => {
        const violation: A11yViolation = {
          id: 'test',
          impact,
          description: 'Test',
          help: 'Test',
          helpUrl: 'https://example.com',
          tags: [],
          nodes: [],
        };
        expect(violation.impact).toBe(impact);
      });
    });
  });

  describe('ScanResult', () => {
    it('should have all required fields', () => {
      const result: ScanResult = {
        url: 'https://example.com',
        timestamp: new Date().toISOString(),
        violations: [],
        passes: 10,
        incomplete: 0,
        inapplicable: 5,
      };

      expect(result.url).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.violations).toBeInstanceOf(Array);
      expect(typeof result.passes).toBe('number');
      expect(typeof result.incomplete).toBe('number');
      expect(typeof result.inapplicable).toBe('number');
    });

    it('should support optional fields', () => {
      const result: ScanResult = {
        url: 'https://example.com',
        timestamp: new Date().toISOString(),
        violations: [],
        passes: 10,
        incomplete: 0,
        inapplicable: 5,
        compliance: {
          wcag21: { A: true, AA: true, AAA: true },
          wcag22: { A: true, AA: true, AAA: true },
          section508: true,
        },
        pages: [],
        scanMode: 'quick',
        pagesScanned: 1,
      };

      expect(result.compliance).toBeDefined();
      expect(result.pages).toBeDefined();
      expect(result.scanMode).toBe('quick');
      expect(result.pagesScanned).toBe(1);
    });
  });

  describe('ComplianceStatus', () => {
    it('should have correct structure', () => {
      const compliance: ComplianceStatus = {
        wcag21: { A: true, AA: true, AAA: true },
        wcag22: { A: true, AA: true, AAA: true },
        section508: true,
      };

      expect(compliance.wcag21.A).toBe(true);
      expect(compliance.wcag21.AA).toBe(true);
      expect(compliance.wcag21.AAA).toBe(true);
      expect(compliance.wcag22.A).toBe(true);
      expect(compliance.wcag22.AA).toBe(true);
      expect(compliance.wcag22.AAA).toBe(true);
      expect(compliance.section508).toBe(true);
    });

    it('should handle non-compliant status', () => {
      const compliance: ComplianceStatus = {
        wcag21: { A: false, AA: false, AAA: false },
        wcag22: { A: false, AA: false, AAA: false },
        section508: false,
      };

      expect(compliance.wcag21.A).toBe(false);
      expect(compliance.section508).toBe(false);
    });
  });

  describe('PageResult', () => {
    it('should have all required fields', () => {
      const pageResult: PageResult = {
        url: 'https://example.com/page',
        violations: [],
        passes: 5,
        incomplete: 0,
        inapplicable: 2,
      };

      expect(pageResult.url).toBeDefined();
      expect(pageResult.violations).toBeInstanceOf(Array);
      expect(typeof pageResult.passes).toBe('number');
      expect(typeof pageResult.incomplete).toBe('number');
      expect(typeof pageResult.inapplicable).toBe('number');
    });

    it('should support optional scanTimeMs', () => {
      const pageResult: PageResult = {
        url: 'https://example.com/page',
        violations: [],
        passes: 5,
        incomplete: 0,
        inapplicable: 2,
        scanTimeMs: 1500,
      };

      expect(pageResult.scanTimeMs).toBe(1500);
    });
  });
});
