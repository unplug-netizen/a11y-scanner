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

export interface ComplianceStatus {
  wcag21: {
    A: boolean;
    AA: boolean;
    AAA: boolean;
  };
  wcag22: {
    A: boolean;
    AA: boolean;
    AAA: boolean;
  };
  section508: boolean;
}

export interface PageResult {
  url: string;
  violations: A11yViolation[];
  passes: number;
  incomplete: number;
  inapplicable: number;
  scanTimeMs?: number;
}

export interface ScanResult {
  url: string;
  timestamp: string;
  violations: A11yViolation[];
  passes: number;
  incomplete: number;
  inapplicable: number;
  // New fields for compliance and deep scan
  compliance?: ComplianceStatus;
  pages?: PageResult[];
  scanMode?: 'quick' | 'deep';
  pagesScanned?: number;
}

export interface FixSuggestion {
  violationId: string;
  originalCode: string;
  fixedCode: string;
  explanation: string;
}

export interface ScanRequest {
  url: string;
  mode?: 'quick' | 'deep';
}

export interface FixRequest {
  violation: A11yViolation;
  html: string;
}

// ============================================
// Phase 2: Bulk Scan Types
// ============================================

export interface BulkScanResult {
  id: string;
  userId: string;
  name?: string;
  urls: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  results: BulkScanItemResult[];
  totalUrls: number;
  completedUrls: number;
  failedUrls: number;
  aggregateReport?: AggregateReport;
  createdAt: string;
  completedAt?: string;
}

export interface BulkScanItemResult {
  url: string;
  status: 'success' | 'error';
  result?: ScanResult;
  error?: string;
  scannedAt: string;
}

export interface AggregateReport {
  totalViolations: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  urlsWithViolations: number;
  urlsClean: number;
  commonViolations: CommonViolation[];
  complianceSummary: {
    wcag21AA: number;
    wcag22AA: number;
    section508: number;
  };
}

export interface CommonViolation {
  id: string;
  help: string;
  impact: string;
  count: number;
  affectedUrls: string[];
}

export interface BulkScanRequest {
  urls: string[];
  name?: string;
  mode?: 'quick' | 'deep';
}

// ============================================
// Phase 2: Scheduled Scan Types
// ============================================

export interface ScheduledScan {
  id: string;
  userId: string;
  name: string;
  url: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  emailNotifications: boolean;
  notifyOnNewIssuesOnly: boolean;
  lastScanAt?: string;
  nextScanAt?: string;
  lastResult?: ScanResult;
  isActive: boolean;
  createdAt: string;
}

export interface ScheduledScanHistory {
  id: string;
  scheduledScanId: string;
  userId: string;
  url: string;
  result: ScanResult;
  violationCount: number;
  newViolations: A11yViolation[];
  fixedViolations: A11yViolation[];
  createdAt: string;
}

export interface TrendAnalysis {
  scanId: string;
  url: string;
  history: TrendDataPoint[];
  trend: 'improving' | 'worsening' | 'stable';
  totalChange: number;
}

export interface TrendDataPoint {
  date: string;
  violationCount: number;
  criticalCount: number;
}

// ============================================
// Phase 2: API Key Types
// ============================================

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  rateLimit: number;
  usageCount: number;
  lastUsedAt?: string;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
}

export interface ApiKeyWithSecret extends ApiKey {
  key: string; // Only shown once on creation
}

export interface ApiUsageLog {
  id: string;
  apiKeyId: string;
  userId: string;
  endpoint: string;
  method: string;
  statusCode?: number;
  responseTimeMs?: number;
  createdAt: string;
}

export interface ApiScanRequest {
  url: string;
  mode?: 'quick' | 'deep';
}

export interface ApiScanResponse {
  id: string;
  url: string;
  status: 'pending' | 'completed' | 'error';
  result?: ScanResult;
  error?: string;
  createdAt: string;
}

// ============================================
// Phase 4.3: Enhanced AI Fix Suggestions
// ============================================

export interface EnhancedFixSuggestion {
  violationId: string;
  violationType: string;
  impact: string;
  originalCode: string;
  originalHtml: string;
  fixedCode: string;
  explanation: string;
  explanationDetailed: string;
  codeExamples: CodeExample[];
  wcagCriterion: string;
  wcagLevel: string;
  wcagUrl: string;
  resources: Resource[];
  confidenceScore: number;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedTime: string;
}

export interface CodeExample {
  title: string;
  code: string;
  language: 'html' | 'css' | 'js' | 'react' | 'vue' | 'angular';
}

export interface Resource {
  title: string;
  url: string;
  type: 'mdn' | 'wcag' | 'article' | 'tool';
}

// ============================================
// Phase 4.3: Screen Reader Simulation
// ============================================

export interface ScreenReaderResult {
  url: string;
  timestamp: string;
  ariaIssues: ARIAIssue[];
  missingLabels: MissingLabel[];
  emptyHeadings: EmptyHeading[];
  headingStructureIssues: HeadingStructureIssue[];
  formIssues: FormIssue[];
  linkIssues: LinkIssue[];
  landmarkIssues: LandmarkIssue[];
  screenReaderScore: number;
  summary: {
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    totalIssues: number;
  };
}

export interface ARIAIssue {
  element: string;
  html: string;
  issue: string;
  severity: 'critical' | 'warning' | 'info';
  suggestion: string;
}

export interface MissingLabel {
  element: string;
  html: string;
  context: string;
}

export interface EmptyHeading {
  level: number;
  html: string;
  text: string;
}

export interface HeadingStructureIssue {
  issue: string;
  details: string;
}

export interface FormIssue {
  element: string;
  issue: string;
  suggestion: string;
}

export interface LinkIssue {
  html: string;
  issue: 'empty' | 'generic' | 'context';
  text: string;
}

export interface LandmarkIssue {
  issue: string;
  suggestion: string;
}

// ============================================
// Phase 4.3: Visual Overlay
// ============================================

export interface VisualOverlayResult {
  url: string;
  timestamp: string;
  viewport: {
    width: number;
    height: number;
  };
  screenshotBase64: string;
  highlights: ViolationHighlight[];
  summary: {
    totalHighlights: number;
    criticalCount: number;
    seriousCount: number;
    moderateCount: number;
    minorCount: number;
  };
}

export interface ViolationHighlight {
  id: string;
  violationId: string;
  type: 'critical' | 'serious' | 'moderate' | 'minor';
  x: number;
  y: number;
  width: number;
  height: number;
  elementHtml: string;
  message: string;
  helpUrl: string;
  selector: string;
}

// ============================================
// Phase 4.3: Regression Tracking
// ============================================

export interface RegressionAnalysis {
  scanId: string;
  url: string;
  timestamp: string;
  totalViolations: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  previousScanId: string | null;
  previousScanAt: string | null;
  newViolations: A11yViolation[];
  fixedViolations: A11yViolation[];
  unchangedViolations: A11yViolation[];
  trend: 'improving' | 'worsening' | 'stable' | 'new';
  trendScore: number;
  alertTriggered: boolean;
  alertReasons: string[];
}

export interface URLTrackingStatus {
  url: string;
  urlHash: string;
  totalScans: number;
  lastScanId: string | null;
  lastScanAt: string | null;
  lastViolationCount: number;
  lastComplianceScore: number | null;
  bestScore: number | null;
  worstScore: number | null;
  averageScore: number | null;
  trendDirection: 'improving' | 'worsening' | 'stable';
  trendPercentage: number | null;
}

// ============================================
// Phase 4.3: Complete Scan Result
// ============================================

export interface CompleteScanResult extends ScanResult {
  screenReaderResult?: ScreenReaderResult;
  visualOverlay?: VisualOverlayResult;
  regressionAnalysis?: RegressionAnalysis;
  enhancedFixes?: EnhancedFixSuggestion[];
}
