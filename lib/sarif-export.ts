import { ScanResult, A11yViolation, PageResult } from '@/types';

// SARIF 2.1.0 Schema Types
// https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html

export interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

export interface SarifRun {
  tool: SarifTool;
  invocations?: SarifInvocation[];
  results: SarifResult[];
  artifacts?: SarifArtifact[];
  automationDetails?: {
    id: string;
    guid?: string;
    description?: {
      text: string;
    };
  };
}

export interface SarifTool {
  driver: {
    name: string;
    fullName?: string;
    version: string;
    semanticVersion?: string;
    informationUri?: string;
    rules: SarifRule[];
  };
}

export interface SarifRule {
  id: string;
  name?: string;
  shortDescription?: {
    text: string;
  };
  fullDescription?: {
    text: string;
  };
  helpUri?: string;
  help?: {
    text: string;
    markdown?: string;
  };
  properties?: {
    tags?: string[];
    precision?: string;
    problemSeverity?: string;
    [key: string]: unknown;
  };
  defaultConfiguration?: {
    level: 'error' | 'warning' | 'note' | 'none';
    rank?: number;
  };
}

export interface SarifResult {
  ruleId: string;
  ruleIndex?: number;
  level: 'error' | 'warning' | 'note' | 'none';
  message: {
    text: string;
    markdown?: string;
  };
  locations: SarifLocation[];
  partialFingerprints?: {
    [key: string]: string;
  };
  properties?: {
    [key: string]: unknown;
  };
}

export interface SarifLocation {
  physicalLocation: {
    artifactLocation: {
      uri: string;
      index?: number;
    };
    region?: {
      startLine?: number;
      startColumn?: number;
      endLine?: number;
      endColumn?: number;
      snippet?: {
        text: string;
      };
    };
    contextRegion?: {
      startLine?: number;
      endLine?: number;
      snippet?: {
        text: string;
      };
    };
  };
  logicalLocations?: SarifLogicalLocation[];
}

export interface SarifLogicalLocation {
  name: string;
  kind: string;
  fullyQualifiedName?: string;
}

export interface SarifArtifact {
  location: {
    uri: string;
  };
  sourceLanguage?: string;
}

export interface SarifInvocation {
  executionSuccessful: boolean;
  startTimeUtc?: string;
  endTimeUtc?: string;
  machine?: string;
  account?: string;
}

// Impact to SARIF level mapping
const IMPACT_TO_LEVEL: Record<string, 'error' | 'warning' | 'note' | 'none'> = {
  critical: 'error',
  serious: 'error',
  moderate: 'warning',
  minor: 'note',
};

// Impact to problem severity mapping
const IMPACT_TO_SEVERITY: Record<string, string> = {
  critical: 'high',
  serious: 'high',
  moderate: 'medium',
  minor: 'low',
};

/**
 * Convert A11yViolation to SARIF Rule
 */
function violationToRule(violation: A11yViolation, ruleIndex: number): SarifRule {
  const level = IMPACT_TO_LEVEL[violation.impact || 'moderate'];
  const severity = IMPACT_TO_SEVERITY[violation.impact || 'moderate'];
  
  return {
    id: violation.id,
    name: violation.help,
    shortDescription: {
      text: violation.help,
    },
    fullDescription: {
      text: violation.description,
    },
    helpUri: violation.helpUrl,
    help: {
      text: violation.help,
      markdown: `[${violation.help}](${violation.helpUrl})`,
    },
    properties: {
      tags: violation.tags,
      precision: 'high',
      problemSeverity: severity,
    },
    defaultConfiguration: {
      level,
      rank: calculateRank(violation.impact),
    },
  };
}

/**
 * Calculate SARIF rank based on impact
 * Rank 1-100, higher is more severe
 */
function calculateRank(impact: string | null): number {
  switch (impact) {
    case 'critical': return 100;
    case 'serious': return 75;
    case 'moderate': return 50;
    case 'minor': return 25;
    default: return 50;
  }
}

/**
 * Convert A11yViolation to SARIF Result
 */
function violationToResult(
  violation: A11yViolation,
  ruleIndex: number,
  baseUrl: string
): SarifResult {
  const level = IMPACT_TO_LEVEL[violation.impact || 'moderate'];
  
  // Create locations from nodes
  const locations: SarifLocation[] = violation.nodes.map(node => ({
    physicalLocation: {
      artifactLocation: {
        uri: baseUrl,
      },
      region: {
        snippet: {
          text: node.html.substring(0, 1000), // Limit snippet size
        },
      },
    },
    logicalLocations: node.target.map((selector, idx) => ({
      name: selector,
      kind: idx === 0 ? 'element' : 'subelement',
      fullyQualifiedName: node.target.join(' > '),
    })),
  }));

  // Create partial fingerprint for deduplication
  const fingerprint = `${violation.id}-${violation.nodes.map(n => n.target.join('|')).join('-')}`;

  return {
    ruleId: violation.id,
    ruleIndex,
    level,
    message: {
      text: violation.help,
      markdown: `${violation.help}\n\n${violation.description}\n\n[Learn more](${violation.helpUrl})`,
    },
    locations,
    partialFingerprints: {
      primaryLocationLineHash: fingerprint,
    },
    properties: {
      impact: violation.impact,
      tags: violation.tags,
      failureSummary: violation.nodes[0]?.failureSummary,
    },
  };
}

/**
 * Convert ScanResult to SARIF format
 */
export function scanResultToSarif(
  result: ScanResult,
  options?: {
    runGuid?: string;
    automationId?: string;
    automationDescription?: string;
  }
): SarifLog {
  // Deduplicate violations by ID for rules
  const uniqueViolations = new Map<string, A11yViolation>();
  result.violations.forEach(v => {
    if (!uniqueViolations.has(v.id)) {
      uniqueViolations.set(v.id, v);
    }
  });
  const violationsArray = Array.from(uniqueViolations.values());

  // Create rules from unique violations
  const rules: SarifRule[] = violationsArray.map((v, idx) => 
    violationToRule(v, idx)
  );

  // Create rule index map for quick lookup
  const ruleIndexMap = new Map<string, number>();
  violationsArray.forEach((v, idx) => {
    ruleIndexMap.set(v.id, idx);
  });

  // Create results
  const results: SarifResult[] = result.violations.map(v => 
    violationToResult(v, ruleIndexMap.get(v.id) || 0, result.url)
  );

  // Create artifacts for each page scanned
  const artifacts: SarifArtifact[] = (result.pages || [result]).map((page: PageResult | ScanResult) => ({
    location: {
      uri: 'url' in page ? page.url : result.url,
    },
    sourceLanguage: 'HTML',
  }));

  const run: SarifRun = {
    tool: {
      driver: {
        name: 'A11y Scanner',
        fullName: 'A11y Scanner - Accessibility Testing Tool',
        version: '1.0.0',
        semanticVersion: '1.0.0',
        informationUri: 'https://github.com/a11y-scanner/a11y-scanner',
        rules,
      },
    },
    invocations: [
      {
        executionSuccessful: true,
        startTimeUtc: result.timestamp,
        endTimeUtc: new Date(
          new Date(result.timestamp).getTime() + 
          (result.pages?.reduce((sum, p) => sum + (p.scanTimeMs || 0), 0) || 0)
        ).toISOString(),
      },
    ],
    results,
    artifacts,
  };

  // Add automation details if provided
  if (options?.automationId) {
    run.automationDetails = {
      id: options.automationId,
      guid: options.runGuid,
      description: {
        text: options.automationDescription || 'A11y Scanner automated accessibility test',
      },
    };
  }

  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [run],
  };
}

/**
 * Convert multiple scan results to SARIF format
 */
export function bulkScanToSarif(
  results: ScanResult[],
  options?: {
    runGuid?: string;
    automationId?: string;
    automationDescription?: string;
  }
): SarifLog {
  // Collect all unique violations across all scans
  const allViolations: A11yViolation[] = [];
  results.forEach(r => {
    allViolations.push(...r.violations);
  });

  // Deduplicate violations by ID for rules
  const uniqueViolations = new Map<string, A11yViolation>();
  allViolations.forEach(v => {
    if (!uniqueViolations.has(v.id)) {
      uniqueViolations.set(v.id, v);
    }
  });
  const violationsArray = Array.from(uniqueViolations.values());

  // Create rules
  const rules: SarifRule[] = violationsArray.map((v, idx) => 
    violationToRule(v, idx)
  );

  // Create rule index map
  const ruleIndexMap = new Map<string, number>();
  violationsArray.forEach((v, idx) => {
    ruleIndexMap.set(v.id, idx);
  });

  // Create results with proper URLs
  const results_sarif: SarifResult[] = [];
  results.forEach(scanResult => {
    scanResult.violations.forEach(v => {
      results_sarif.push(
        violationToResult(v, ruleIndexMap.get(v.id) || 0, scanResult.url)
      );
    });
  });

  // Create artifacts
  const artifacts: SarifArtifact[] = results.map(r => ({
    location: {
      uri: r.url,
    },
    sourceLanguage: 'HTML',
  }));

  const run: SarifRun = {
    tool: {
      driver: {
        name: 'A11y Scanner',
        fullName: 'A11y Scanner - Accessibility Testing Tool',
        version: '1.0.0',
        semanticVersion: '1.0.0',
        informationUri: 'https://github.com/a11y-scanner/a11y-scanner',
        rules,
      },
    },
    invocations: [
      {
        executionSuccessful: true,
      },
    ],
    results: results_sarif,
    artifacts,
  };

  if (options?.automationId) {
    run.automationDetails = {
      id: options.automationId,
      guid: options.runGuid,
      description: {
        text: options.automationDescription || 'A11y Scanner bulk accessibility test',
      },
    };
  }

  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [run],
  };
}

/**
 * Export scan result as SARIF JSON string
 */
export function exportToSarifJson(
  result: ScanResult,
  options?: {
    runGuid?: string;
    automationId?: string;
    automationDescription?: string;
    pretty?: boolean;
  }
): string {
  const sarif = scanResultToSarif(result, options);
  return JSON.stringify(sarif, null, options?.pretty ? 2 : undefined);
}

/**
 * Export bulk scan results as SARIF JSON string
 */
export function exportBulkToSarifJson(
  results: ScanResult[],
  options?: {
    runGuid?: string;
    automationId?: string;
    automationDescription?: string;
    pretty?: boolean;
  }
): string {
  const sarif = bulkScanToSarif(results, options);
  return JSON.stringify(sarif, null, options?.pretty ? 2 : undefined);
}
