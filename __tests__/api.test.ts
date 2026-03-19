import { A11yViolation } from '@/types';

// Mock fetch globally
global.fetch = jest.fn();

describe('Scan API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reject invalid URLs', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    
    // Simulate API call with invalid URL
    const invalidUrls = [
      'not-a-url',
      'ftp://invalid-protocol.com',
      '',
    ];

    for (const url of invalidUrls) {
      const isValidUrl = (str: string) => {
        try {
          new URL(str);
          return true;
        } catch {
          try {
            new URL(`https://${str}`);
            return true;
          } catch {
            return false;
          }
        }
      };

      expect(isValidUrl(url)).toBe(false);
    }
  });

  it('should accept valid URLs', async () => {
    const validUrls = [
      'https://example.com',
      'http://localhost:3000',
      'https://sub.domain.co.uk/path?query=1',
    ];

    for (const url of validUrls) {
      const isValidUrl = (str: string) => {
        try {
          new URL(str);
          return true;
        } catch {
          try {
            new URL(`https://${str}`);
            return true;
          } catch {
            return false;
          }
        }
      };

      expect(isValidUrl(url)).toBe(true);
    }
  });
});

describe('Types', () => {
  it('should have correct A11yViolation structure', () => {
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
    expect(violation.nodes).toHaveLength(1);
  });
});
