export interface A11yViolation {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor' | null;
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: A11yNode[];
}

export interface A11yNode {
  html: string;
  target: string[];
  failureSummary?: string;
}

export interface ScanResult {
  url: string;
  timestamp: string;
  violations: A11yViolation[];
  passes: number;
  incomplete: number;
  inapplicable: number;
}

export interface FixSuggestion {
  violationId: string;
  originalCode: string;
  fixedCode: string;
  explanation: string;
}

export interface ScanRequest {
  url: string;
}

export interface FixRequest {
  violation: A11yViolation;
  html: string;
}
