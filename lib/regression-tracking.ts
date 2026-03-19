import { createClient } from '@supabase/supabase-js';
import { A11yViolation, ScanResult } from '@/types';

// Types for regression tracking
export interface RegressionAnalysis {
  scanId: string;
  url: string;
  timestamp: string;
  
  // Violation counts
  totalViolations: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  
  // Comparison with previous scan
  previousScanId: string | null;
  previousScanAt: string | null;
  
  // Changes
  newViolations: A11yViolation[];
  fixedViolations: A11yViolation[];
  unchangedViolations: A11yViolation[];
  
  // Trend
  trend: 'improving' | 'worsening' | 'stable' | 'new';
  trendScore: number; // Change in violation count (+/-)
  
  // Alert status
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

export interface TrendDataPoint {
  date: string;
  scanId: string;
  totalViolations: number;
  criticalCount: number;
  seriousCount: number;
  complianceScore: number;
}

// Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Track a new scan and analyze regression
 */
export async function trackScan(
  userId: string,
  scanId: string,
  url: string,
  scanResult: ScanResult
): Promise<RegressionAnalysis> {
  const supabase = getSupabaseClient();
  
  // Get previous scan for this URL
  const { data: previousScans } = await supabase
    .from('scan_history_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('url', url)
    .order('created_at', { ascending: false })
    .limit(1);
  
  const previousScan = previousScans?.[0];
  
  // Calculate violation counts
  const totalViolations = scanResult.violations.length;
  const criticalCount = scanResult.violations.filter(v => v.impact === 'critical').length;
  const seriousCount = scanResult.violations.filter(v => v.impact === 'serious').length;
  const moderateCount = scanResult.violations.filter(v => v.impact === 'moderate').length;
  const minorCount = scanResult.violations.filter(v => v.impact === 'minor').length;
  
  // Compare with previous scan
  let newViolations: A11yViolation[] = [];
  let fixedViolations: A11yViolation[] = [];
  let unchangedViolations: A11yViolation[] = [];
  
  if (previousScan) {
    const previousViolationIds = new Set(
      (previousScan.unchanged_violations || [])
        .concat(previousScan.new_violations || [])
        .map((v: A11yViolation) => v.id)
    );
    
    const currentViolationIds = new Set(scanResult.violations.map(v => v.id));
    
    // Find new violations
    newViolations = scanResult.violations.filter(v => !previousViolationIds.has(v.id));
    
    // Find fixed violations
    const previousViolations: A11yViolation[] = [
      ...(previousScan.unchanged_violations || []),
      ...(previousScan.new_violations || [])
    ];
    fixedViolations = previousViolations.filter((v: A11yViolation) => !currentViolationIds.has(v.id));
    
    // Find unchanged violations
    unchangedViolations = scanResult.violations.filter(v => previousViolationIds.has(v.id));
  } else {
    // First scan for this URL
    newViolations = scanResult.violations;
  }
  
  // Calculate trend
  const previousTotal = previousScan?.total_violations || 0;
  const trendScore = previousTotal - totalViolations;
  
  let trend: 'improving' | 'worsening' | 'stable' | 'new';
  if (!previousScan) {
    trend = 'new';
  } else if (trendScore > 0) {
    trend = 'improving';
  } else if (trendScore < 0) {
    trend = 'worsening';
  } else {
    trend = 'stable';
  }
  
  // Determine if alert should be triggered
  const alertReasons: string[] = [];
  
  if (newViolations.some(v => v.impact === 'critical')) {
    alertReasons.push('Neue kritische Verstöße gefunden');
  }
  
  if (trend === 'worsening' && newViolations.length > 0) {
    alertReasons.push('Trend verschlechtert mit neuen Verstößen');
  }
  
  if (newViolations.length >= 5) {
    alertReasons.push('Mehr als 5 neue Verstöße');
  }
  
  const alertTriggered = alertReasons.length > 0;
  
  // Store tracking data
  await supabase.from('scan_history_tracking').insert({
    user_id: userId,
    url,
    scan_id: scanId,
    total_violations: totalViolations,
    critical_count: criticalCount,
    serious_count: seriousCount,
    moderate_count: moderateCount,
    minor_count: minorCount,
    new_violations: newViolations,
    fixed_violations: fixedViolations,
    unchanged_violations: unchangedViolations,
    trend,
    trend_score: trendScore,
    previous_scan_id: previousScan?.scan_id || null,
    previous_scan_at: previousScan?.created_at || null,
    alert_triggered: alertTriggered
  });
  
  // Update URL tracking
  await updateURLTracking(userId, url, scanId, totalViolations);
  
  // Create alert if triggered
  if (alertTriggered) {
    await createAlert(userId, scanId, url, alertReasons, newViolations, trend);
  }
  
  return {
    scanId,
    url,
    timestamp: new Date().toISOString(),
    totalViolations,
    criticalCount,
    seriousCount,
    moderateCount,
    minorCount,
    previousScanId: previousScan?.scan_id || null,
    previousScanAt: previousScan?.created_at || null,
    newViolations,
    fixedViolations,
    unchangedViolations,
    trend,
    trendScore,
    alertTriggered,
    alertReasons
  };
}

/**
 * Update URL tracking statistics
 */
async function updateURLTracking(
  userId: string,
  url: string,
  scanId: string,
  violationCount: number
): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Calculate compliance score (0-100)
  const complianceScore = Math.max(0, 100 - (violationCount * 5));
  
  // Get existing tracking
  const { data: existing } = await supabase
    .from('url_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('url', url)
    .single();
  
  if (existing) {
    // Calculate trend
    const previousCount = existing.last_violation_count || 0;
    const trendDirection = violationCount < previousCount ? 'improving' : 
                          violationCount > previousCount ? 'worsening' : 'stable';
    
    const trendPercentage = previousCount > 0 
      ? ((previousCount - violationCount) / previousCount) * 100 
      : 0;
    
    // Update statistics
    const totalScans = (existing.total_scans || 0) + 1;
    const bestScore = Math.max(existing.best_score || 0, complianceScore);
    const worstScore = existing.worst_score === null 
      ? complianceScore 
      : Math.min(existing.worst_score, complianceScore);
    
    // Calculate average
    const currentAvg = existing.average_score || complianceScore;
    const newAverage = ((currentAvg * (totalScans - 1)) + complianceScore) / totalScans;
    
    await supabase
      .from('url_tracking')
      .update({
        total_scans: totalScans,
        last_scan_id: scanId,
        last_scan_at: new Date().toISOString(),
        last_violation_count: violationCount,
        last_compliance_score: complianceScore,
        best_score: bestScore,
        worst_score: worstScore,
        average_score: newAverage,
        trend_direction: trendDirection,
        trend_percentage: trendPercentage,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
  } else {
    // Create new tracking entry
    await supabase.from('url_tracking').insert({
      user_id: userId,
      url,
      total_scans: 1,
      last_scan_id: scanId,
      last_scan_at: new Date().toISOString(),
      last_violation_count: violationCount,
      last_compliance_score: complianceScore,
      best_score: complianceScore,
      worst_score: complianceScore,
      average_score: complianceScore,
      trend_direction: 'stable',
      trend_percentage: 0
    });
  }
}

/**
 * Create an alert for regression
 */
async function createAlert(
  userId: string,
  scanId: string,
  url: string,
  reasons: string[],
  newViolations: A11yViolation[],
  trend: string
): Promise<void> {
  const supabase = getSupabaseClient();
  
  const criticalCount = newViolations.filter(v => v.impact === 'critical').length;
  const seriousCount = newViolations.filter(v => v.impact === 'serious').length;
  
  let alertType = 'regression';
  if (criticalCount > 0) alertType = 'new_critical';
  else if (trend === 'improving') alertType = 'improvement';
  
  const title = criticalCount > 0 
    ? `🚨 ${criticalCount} neue kritische Verstöße auf ${new URL(url).hostname}`
    : `⚠️ Accessibility-Regression auf ${new URL(url).hostname}`;
  
  const message = reasons.join('. ') + '.';
  
  await supabase.from('accessibility_alerts').insert({
    user_id: userId,
    alert_type: alertType,
    scan_id: scanId,
    url,
    title,
    message,
    details: {
      new_violations_count: newViolations.length,
      critical_count: criticalCount,
      serious_count: seriousCount,
      reasons,
      trend
    }
  });
}

/**
 * Get scan history for a URL
 */
export async function getScanHistory(
  userId: string,
  url: string,
  days: number = 30
): Promise<TrendDataPoint[]> {
  const supabase = getSupabaseClient();
  
  const { data } = await supabase
    .from('scan_history_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('url', url)
    .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true });
  
  if (!data) return [];
  
  return data.map((row: any) => ({
    date: row.created_at,
    scanId: row.scan_id,
    totalViolations: row.total_violations,
    criticalCount: row.critical_count,
    seriousCount: row.serious_count,
    complianceScore: Math.max(0, 100 - (row.total_violations * 5))
  }));
}

/**
 * Get all tracked URLs for a user
 */
export async function getTrackedURLs(userId: string): Promise<URLTrackingStatus[]> {
  const supabase = getSupabaseClient();
  
  const { data } = await supabase
    .from('url_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false });
  
  if (!data) return [];
  
  return data.map((row: any) => ({
    url: row.url,
    urlHash: row.url_hash,
    totalScans: row.total_scans,
    lastScanId: row.last_scan_id,
    lastScanAt: row.last_scan_at,
    lastViolationCount: row.last_violation_count,
    lastComplianceScore: row.last_compliance_score,
    bestScore: row.best_score,
    worstScore: row.worst_score,
    averageScore: row.average_score,
    trendDirection: row.trend_direction,
    trendPercentage: row.trend_percentage
  }));
}

/**
 * Get trend analysis for a URL
 */
export async function getTrendAnalysis(
  userId: string,
  url: string,
  days: number = 30
): Promise<{
  history: TrendDataPoint[];
  trend: 'improving' | 'worsening' | 'stable';
  totalChange: number;
  percentageChange: number;
}> {
  const history = await getScanHistory(userId, url, days);
  
  if (history.length < 2) {
    return {
      history,
      trend: 'stable',
      totalChange: 0,
      percentageChange: 0
    };
  }
  
  const first = history[0];
  const last = history[history.length - 1];
  
  const totalChange = first.totalViolations - last.totalViolations;
  const percentageChange = first.totalViolations > 0
    ? (totalChange / first.totalViolations) * 100
    : 0;
  
  const trend = totalChange > 0 ? 'improving' : 
                totalChange < 0 ? 'worsening' : 'stable';
  
  return {
    history,
    trend,
    totalChange,
    percentageChange
  };
}

/**
 * Get unread alerts for a user
 */
export async function getUnreadAlerts(userId: string): Promise<Array<{
  id: string;
  type: string;
  title: string;
  message: string;
  url: string;
  createdAt: string;
  details: any;
}>> {
  const supabase = getSupabaseClient();
  
  const { data } = await supabase
    .from('accessibility_alerts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_read', false)
    .order('created_at', { ascending: false });
  
  if (!data) return [];
  
  return data.map((row: any) => ({
    id: row.id,
    type: row.alert_type,
    title: row.title,
    message: row.message,
    url: row.url,
    createdAt: row.created_at,
    details: row.details
  }));
}

/**
 * Mark alert as read
 */
export async function markAlertAsRead(userId: string, alertId: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  await supabase
    .from('accessibility_alerts')
    .update({
      is_read: true,
      read_at: new Date().toISOString()
    })
    .eq('id', alertId)
    .eq('user_id', userId);
}

/**
 * Start tracking a URL
 */
export async function startTrackingURL(
  userId: string,
  url: string,
  options: {
    notifyOnRegression?: boolean;
    notifyOnImprovement?: boolean;
    notifyOnNewCritical?: boolean;
  } = {}
): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { data: existing } = await supabase
    .from('url_tracking')
    .select('id')
    .eq('user_id', userId)
    .eq('url', url)
    .single();
  
  if (existing) {
    // Update existing
    await supabase
      .from('url_tracking')
      .update({
        is_active: true,
        notify_on_regression: options.notifyOnRegression ?? true,
        notify_on_improvement: options.notifyOnImprovement ?? false,
        notify_on_new_critical: options.notifyOnNewCritical ?? true,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
  } else {
    // Create new
    await supabase.from('url_tracking').insert({
      user_id: userId,
      url,
      is_active: true,
      notify_on_regression: options.notifyOnRegression ?? true,
      notify_on_improvement: options.notifyOnImprovement ?? false,
      notify_on_new_critical: options.notifyOnNewCritical ?? true
    });
  }
}

/**
 * Stop tracking a URL
 */
export async function stopTrackingURL(userId: string, url: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  await supabase
    .from('url_tracking')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('url', url);
}

/**
 * Get compliance score trend over time
 */
export function calculateComplianceTrend(history: TrendDataPoint[]): {
  currentScore: number;
  previousScore: number | null;
  change: number;
  trend: 'improving' | 'worsening' | 'stable';
} {
  if (history.length === 0) {
    return {
      currentScore: 0,
      previousScore: null,
      change: 0,
      trend: 'stable'
    };
  }
  
  const current = history[history.length - 1];
  const previous = history.length > 1 ? history[history.length - 2] : null;
  
  const currentScore = current.complianceScore;
  const previousScore = previous?.complianceScore || null;
  
  const change = previousScore !== null ? currentScore - previousScore : 0;
  
  const trend = change > 5 ? 'improving' : 
                change < -5 ? 'worsening' : 'stable';
  
  return {
    currentScore,
    previousScore,
    change,
    trend
  };
}
