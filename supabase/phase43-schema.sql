-- ============================================
-- Phase 4.3: Advanced Accessibility Features
-- ============================================

-- ============================================
-- 1. Screen-Reader Simulation Results
-- ============================================

CREATE TABLE IF NOT EXISTS screen_reader_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- ARIA Analysis
  aria_issues JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ element: string, issue: string, severity: 'critical'|'warning'|'info', suggestion: string }]
  
  -- Missing Labels
  missing_labels JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ element: string, html: string, context: string }]
  
  -- Empty Headings
  empty_headings JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ level: number, html: string, text: string }]
  
  -- Heading Structure Issues
  heading_structure_issues JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ issue: string, details: string }]
  
  -- Form Accessibility
  form_issues JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ element: string, issue: string, suggestion: string }]
  
  -- Link Issues
  link_issues JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ html: string, issue: 'empty'|'generic'|'context', text: string }]
  
  -- Landmark Issues
  landmark_issues JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ issue: string, suggestion: string }]
  
  -- Overall Score (0-100)
  screen_reader_score INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_screen_reader_scan_id ON screen_reader_results(scan_id);
CREATE INDEX IF NOT EXISTS idx_screen_reader_user_id ON screen_reader_results(user_id);

-- RLS
ALTER TABLE screen_reader_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own screen reader results" ON screen_reader_results
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own screen reader results" ON screen_reader_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 2. Mobile Accessibility Results
-- ============================================

CREATE TABLE IF NOT EXISTS mobile_accessibility_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Touch Target Analysis
  touch_targets JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ 
  --   element: string, 
  --   html: string, 
  --   width: number, 
  --   height: number, 
  --   compliant: boolean,
  --   recommendedSize: string 
  -- }]
  
  -- Viewport Configuration
  viewport_issues JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ issue: string, current: string, recommended: string }]
  
  -- Zoom/Scale Issues
  zoom_issues JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ issue: string, meta: string, suggestion: string }]
  
  -- Touch Action Issues
  touch_action_issues JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ element: string, issue: string, suggestion: string }]
  
  -- Mobile-Specific WCAG Issues
  mobile_wcag_issues JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ criterion: string, issue: string, impact: string }]
  
  -- Device Simulation Results
  device_tests JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ device: string, width: number, height: number, issues: [] }]
  
  -- Overall Score (0-100)
  mobile_score INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_mobile_scan_id ON mobile_accessibility_results(scan_id);
CREATE INDEX IF NOT EXISTS idx_mobile_user_id ON mobile_accessibility_results(user_id);

-- RLS
ALTER TABLE mobile_accessibility_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mobile results" ON mobile_accessibility_results
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own mobile results" ON mobile_accessibility_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 3. AI Fix Suggestions (Enhanced)
-- ============================================

CREATE TABLE IF NOT EXISTS ai_fix_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Violation Reference
  violation_id TEXT NOT NULL,
  violation_type TEXT NOT NULL,
  impact TEXT NOT NULL, -- critical, serious, moderate, minor
  
  -- Original Code
  original_code TEXT NOT NULL,
  original_html TEXT,
  
  -- AI-Generated Fix
  fixed_code TEXT NOT NULL,
  
  -- Explanation
  explanation TEXT NOT NULL,
  explanation_detailed TEXT, -- Longer explanation with WCAG references
  
  -- Code Examples
  code_examples JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ title: string, code: string, language: 'html'|'css'|'js'|'react'|'vue' }]
  
  -- WCAG Reference
  wcag_criterion TEXT, -- e.g., "1.1.1 Non-text Content"
  wcag_level TEXT, -- A, AA, AAA
  wcag_url TEXT,
  
  -- Additional Resources
  resources JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ title: string, url: string, type: 'mdn'|'wcag'|'article'|'tool' }]
  
  -- Fix Metadata
  confidence_score INTEGER, -- 0-100 AI confidence
  complexity TEXT, -- 'simple', 'moderate', 'complex'
  estimated_time TEXT, -- e.g., "5 minutes", "30 minutes"
  
  -- User Feedback
  was_helpful BOOLEAN,
  was_applied BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_ai_fix_scan_id ON ai_fix_suggestions(scan_id);
CREATE INDEX IF NOT EXISTS idx_ai_fix_user_id ON ai_fix_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_fix_violation_id ON ai_fix_suggestions(violation_id);

-- RLS
ALTER TABLE ai_fix_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI fixes" ON ai_fix_suggestions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own AI fixes" ON ai_fix_suggestions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own AI fixes" ON ai_fix_suggestions
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- 4. Visual Highlight Overlays (Screenshots with Annotations)
-- ============================================

CREATE TABLE IF NOT EXISTS visual_overlays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Screenshot Info
  screenshot_url TEXT, -- URL to stored screenshot
  screenshot_data TEXT, -- Base64 encoded screenshot (optional, for small images)
  page_url TEXT NOT NULL,
  viewport_width INTEGER,
  viewport_height INTEGER,
  
  -- Violation Highlights
  highlights JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{
  --   id: string,
  --   violation_id: string,
  --   type: 'critical'|'serious'|'moderate'|'minor',
  --   x: number,
  --   y: number,
  --   width: number,
  --   height: number,
  --   element_html: string,
  --   message: string,
  --   help_url: string
  -- }]
  
  -- Overlay Settings
  overlay_config JSONB DEFAULT '{}'::jsonb,
  -- Structure: { showLabels: boolean, colorScheme: string, opacity: number }
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_visual_overlay_scan_id ON visual_overlays(scan_id);
CREATE INDEX IF NOT EXISTS idx_visual_overlay_user_id ON visual_overlays(user_id);

-- RLS
ALTER TABLE visual_overlays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own visual overlays" ON visual_overlays
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own visual overlays" ON visual_overlays
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 5. Scan History & Regression Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS scan_history_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- URL being tracked
  url TEXT NOT NULL,
  url_hash TEXT GENERATED ALWAYS AS (md5(url)) STORED,
  
  -- Scan Reference
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  
  -- Violation Summary
  total_violations INTEGER DEFAULT 0,
  critical_count INTEGER DEFAULT 0,
  serious_count INTEGER DEFAULT 0,
  moderate_count INTEGER DEFAULT 0,
  minor_count INTEGER DEFAULT 0,
  
  -- Regression Analysis
  new_violations JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ violation_id: string, description: string, impact: string }]
  
  fixed_violations JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ violation_id: string, description: string, impact: string }]
  
  unchanged_violations JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ violation_id: string, description: string, impact: string }]
  
  -- Trend
  trend TEXT, -- 'improving', 'worsening', 'stable', 'new'
  trend_score INTEGER, -- Change in violation count (+/-)
  
  -- Comparison with previous scan
  previous_scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
  previous_scan_at TIMESTAMP WITH TIME ZONE,
  
  -- Alert Status
  alert_triggered BOOLEAN DEFAULT false,
  alert_sent BOOLEAN DEFAULT false,
  alert_sent_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_scan_history_user_id ON scan_history_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_url_hash ON scan_history_tracking(url_hash);
CREATE INDEX IF NOT EXISTS idx_scan_history_scan_id ON scan_history_tracking(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_created_at ON scan_history_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_history_alert ON scan_history_tracking(alert_triggered, alert_sent);

-- RLS
ALTER TABLE scan_history_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scan history" ON scan_history_tracking
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own scan history" ON scan_history_tracking
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 6. URL Tracking (for continuous monitoring)
-- ============================================

CREATE TABLE IF NOT EXISTS url_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  url TEXT NOT NULL,
  url_hash TEXT GENERATED ALWAYS AS (md5(url)) STORED,
  
  -- Tracking Settings
  is_active BOOLEAN DEFAULT true,
  notify_on_regression BOOLEAN DEFAULT true,
  notify_on_improvement BOOLEAN DEFAULT false,
  notify_on_new_critical BOOLEAN DEFAULT true,
  
  -- Statistics
  total_scans INTEGER DEFAULT 0,
  last_scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
  last_scan_at TIMESTAMP WITH TIME ZONE,
  last_violation_count INTEGER,
  last_compliance_score INTEGER,
  
  -- Best/Worst Scores
  best_score INTEGER,
  worst_score INTEGER,
  average_score NUMERIC(5,2),
  
  -- Trend over time
  trend_direction TEXT DEFAULT 'stable', -- improving, worsening, stable
  trend_percentage NUMERIC(5,2), -- percentage change
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, url_hash)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_url_tracking_user_id ON url_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_url_tracking_url_hash ON url_tracking(url_hash);
CREATE INDEX IF NOT EXISTS idx_url_tracking_active ON url_tracking(is_active);

-- RLS
ALTER TABLE url_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own URL tracking" ON url_tracking
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own URL tracking" ON url_tracking
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own URL tracking" ON url_tracking
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own URL tracking" ON url_tracking
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 7. Alerts & Notifications
-- ============================================

CREATE TABLE IF NOT EXISTS accessibility_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Alert Type
  alert_type TEXT NOT NULL, -- 'new_critical', 'regression', 'improvement', 'threshold_exceeded'
  
  -- Related Scans
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  previous_scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
  
  -- URL
  url TEXT NOT NULL,
  
  -- Alert Details
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  -- Structure depends on alert_type
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Notification Status
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  slack_sent BOOLEAN DEFAULT false,
  slack_sent_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON accessibility_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_scan_id ON accessibility_alerts(scan_id);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON accessibility_alerts(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON accessibility_alerts(created_at DESC);

-- RLS
ALTER TABLE accessibility_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts" ON accessibility_alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts" ON accessibility_alerts
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- Functions & Triggers
-- ============================================

-- Update updated_at timestamp for tables that need it
CREATE TRIGGER update_ai_fix_suggestions_updated_at
  BEFORE UPDATE ON ai_fix_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_url_tracking_updated_at
  BEFORE UPDATE ON url_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate trend between two scans
CREATE OR REPLACE FUNCTION calculate_scan_trend(
  p_current_violations INTEGER,
  p_previous_violations INTEGER
)
RETURNS TABLE(trend TEXT, trend_score INTEGER) AS $$
BEGIN
  trend_score := p_previous_violations - p_current_violations;
  
  IF trend_score > 0 THEN
    trend := 'improving';
  ELSIF trend_score < 0 THEN
    trend := 'worsening';
  ELSE
    trend := 'stable';
  END IF;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to get violation history for a URL
CREATE OR REPLACE FUNCTION get_url_violation_history(
  p_user_id UUID,
  p_url TEXT,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE(
  scan_date TIMESTAMP WITH TIME ZONE,
  total_violations INTEGER,
  critical_count INTEGER,
  serious_count INTEGER,
  trend TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sht.created_at as scan_date,
    sht.total_violations,
    sht.critical_count,
    sht.serious_count,
    sht.trend
  FROM scan_history_tracking sht
  WHERE sht.user_id = p_user_id
    AND sht.url = p_url
    AND sht.created_at > NOW() - (p_days || ' days')::INTERVAL
  ORDER BY sht.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if alert should be triggered
CREATE OR REPLACE FUNCTION should_trigger_alert(
  p_new_violations JSONB,
  p_critical_count INTEGER,
  p_trend TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Trigger alert if:
  -- 1. New critical violations found
  -- 2. Trend is worsening and new violations exist
  -- 3. More than 5 new violations of any severity
  
  RETURN (
    p_critical_count > 0 OR
    (p_trend = 'worsening' AND jsonb_array_length(p_new_violations) > 0) OR
    jsonb_array_length(p_new_violations) >= 5
  );
END;
$$ LANGUAGE plpgsql;
