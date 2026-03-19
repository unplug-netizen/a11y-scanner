import { 
  scanResultToSarif, 
  bulkScanToSarif,
  exportToSarifJson 
} from '@/lib/sarif-export';
import { ScanResult, A11yViolation } from '@/types';

describe('SARIF Export', () => {
  const mockViolation: A11yViolation = {
    id: 'color-contrast',
    impact: 'serious',
    description: 'Elements must have sufficient color contrast',
    help: 'Elements must have sufficient color contrast',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
    tags: ['wcag2aa', 'wcag143'],
    nodes: [
      {
        html: '<button>Click me</button>',
        target: ['#button1'],
        failureSummary: 'Fix the following:\nElement has insufficient color contrast',
      },
    ],
  };

  const mockScanResult: ScanResult = {
    url: 'https://example.com',
    timestamp: '2024-01-15T10:00:00Z',
    violations: [mockViolation],
    passes: 10,
    incomplete: 2,
    inapplicable: 5,
    compliance: {
      wcag21: { A: true, AA: false, AAA: false },
      wcag22: { A: true, AA: false, AAA: false },
      section508: true,
    },
    scanMode: 'quick',
    pagesScanned: 1,
  };

  describe('scanResultToSarif', () => {
    it('should convert scan result to valid SARIF format', () => {
      const sarif = scanResultToSarif(mockScanResult);

      expect(sarif.$schema).toContain('sarif-schema-2.1.0');
      expect(sarif.version).toBe('2.1.0');
      expect(sarif.runs).toHaveLength(1);
    });

    it('should include tool information', () => {
      const sarif = scanResultToSarif(mockScanResult);
      const run = sarif.runs[0];

      expect(run.tool.driver.name).toBe('A11y Scanner');
      expect(run.tool.driver.version).toBe('1.0.0');
      expect(run.tool.driver.rules).toHaveLength(1);
    });

    it('should convert violations to SARIF rules', () => {
      const sarif = scanResultToSarif(mockScanResult);
      const rule = sarif.runs[0].tool.driver.rules[0];

      expect(rule.id).toBe('color-contrast');
      expect(rule.name).toBe('Elements must have sufficient color contrast');
      expect(rule.helpUri).toBe('https://dequeuniversity.com/rules/axe/4.4/color-contrast');
      expect(rule.properties?.tags).toContain('wcag2aa');
    });

    it('should convert violations to SARIF results', () => {
      const sarif = scanResultToSarif(mockScanResult);
      const result = sarif.runs[0].results[0];

      expect(result.ruleId).toBe('color-contrast');
      expect(result.level).toBe('error');
      expect(result.message.text).toBe('Elements must have sufficient color contrast');
    });

    it('should map impact levels correctly', () => {
      const violations: A11yViolation[] = [
        { ...mockViolation, id: 'v1', impact: 'critical' },
        { ...mockViolation, id: 'v2', impact: 'serious' },
        { ...mockViolation, id: 'v3', impact: 'moderate' },
        { ...mockViolation, id: 'v4', impact: 'minor' },
        { ...mockViolation, id: 'v5', impact: null },
      ];

      const scanResult: ScanResult = {
        ...mockScanResult,
        violations,
      };

      const sarif = scanResultToSarif(scanResult);
      const results = sarif.runs[0].results;

      expect(results.find(r => r.ruleId === 'v1')?.level).toBe('error');
      expect(results.find(r => r.ruleId === 'v2')?.level).toBe('error');
      expect(results.find(r => r.ruleId === 'v3')?.level).toBe('warning');
      expect(results.find(r => r.ruleId === 'v4')?.level).toBe('note');
      expect(results.find(r => r.ruleId === 'v5')?.level).toBe('warning');
    });

    it('should include artifacts', () => {
      const sarif = scanResultToSarif(mockScanResult);
      const artifacts = sarif.runs[0].artifacts;

      expect(artifacts).toBeDefined();
      expect(artifacts?.[0].location.uri).toBe('https://example.com');
    });

    it('should include invocation details', () => {
      const sarif = scanResultToSarif(mockScanResult);
      const invocation = sarif.runs[0].invocations?.[0];

      expect(invocation).toBeDefined();
      expect(invocation?.executionSuccessful).toBe(true);
      expect(invocation?.startTimeUtc).toBe(mockScanResult.timestamp);
    });

    it('should include automation details when provided', () => {
      const sarif = scanResultToSarif(mockScanResult, {
        runGuid: 'test-guid',
        automationId: 'test-automation',
        automationDescription: 'Test scan',
      });

      expect(sarif.runs[0].automationDetails).toEqual({
        id: 'test-automation',
        guid: 'test-guid',
        description: {
          text: 'Test scan',
        },
      });
    });
  });

  describe('bulkScanToSarif', () => {
    it('should convert multiple scan results to SARIF', () => {
      const results: ScanResult[] = [
        mockScanResult,
        {
          ...mockScanResult,
          url: 'https://example.com/page2',
          violations: [{ ...mockViolation, id: 'another-rule' }],
        },
      ];

      const sarif = bulkScanToSarif(results);

      expect(sarif.runs[0].artifacts).toHaveLength(2);
      expect(sarif.runs[0].results).toHaveLength(2);
    });

    it('should deduplicate rules across scans', () => {
      const results: ScanResult[] = [
        mockScanResult,
        {
          ...mockScanResult,
          url: 'https://example.com/page2',
        },
      ];

      const sarif = bulkScanToSarif(results);

      // Same violation on both pages should result in one rule
      expect(sarif.runs[0].tool.driver.rules).toHaveLength(1);
      // But two results (one per page)
      expect(sarif.runs[0].results).toHaveLength(2);
    });
  });

  describe('exportToSarifJson', () => {
    it('should export as JSON string', () => {
      const json = exportToSarifJson(mockScanResult);
      
      expect(typeof json).toBe('string');
      
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe('2.1.0');
    });

    it('should format JSON when pretty option is true', () => {
      const compact = exportToSarifJson(mockScanResult, { pretty: false });
      const pretty = exportToSarifJson(mockScanResult, { pretty: true });

      expect(pretty.length).toBeGreaterThan(compact.length);
      expect(pretty).toContain('\n');
    });
  });
});
