-- Supabase Schema für A11y Scanner
-- Führe dies im Supabase SQL Editor aus

-- Scans Tabelle
CREATE TABLE IF NOT EXISTS scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  result JSONB NOT NULL,
  violation_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index für schnelle Abfragen nach user_id
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);

-- Index für Sortierung nach Datum
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);

-- Row Level Security (RLS) aktivieren
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

-- Policy: User können nur ihre eigenen Scans sehen
CREATE POLICY "Users can view own scans" ON scans
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: User können nur ihre eigenen Scans erstellen
CREATE POLICY "Users can create own scans" ON scans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: User können nur ihre eigenen Scans löschen
CREATE POLICY "Users can delete own scans" ON scans
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Phase 2: Bulk Scans
-- ============================================

-- Bulk Scans Tabelle
CREATE TABLE IF NOT EXISTS bulk_scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  urls TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
  results JSONB DEFAULT '[]'::jsonb,
  total_urls INTEGER NOT NULL,
  completed_urls INTEGER DEFAULT 0,
  failed_urls INTEGER DEFAULT 0,
  aggregate_report JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Index für Bulk Scans
CREATE INDEX IF NOT EXISTS idx_bulk_scans_user_id ON bulk_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_bulk_scans_status ON bulk_scans(status);
CREATE INDEX IF NOT EXISTS idx_bulk_scans_created_at ON bulk_scans(created_at DESC);

-- RLS für Bulk Scans
ALTER TABLE bulk_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bulk scans" ON bulk_scans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own bulk scans" ON bulk_scans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bulk scans" ON bulk_scans
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Phase 2: Scheduled Scans
-- ============================================

-- Scheduled Scans Tabelle
CREATE TABLE IF NOT EXISTS scheduled_scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  frequency TEXT NOT NULL, -- daily, weekly, monthly
  email_notifications BOOLEAN DEFAULT true,
  notify_on_new_issues_only BOOLEAN DEFAULT true,
  last_scan_at TIMESTAMP WITH TIME ZONE,
  next_scan_at TIMESTAMP WITH TIME ZONE,
  last_result JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index für Scheduled Scans
CREATE INDEX IF NOT EXISTS idx_scheduled_scans_user_id ON scheduled_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_scans_next_scan ON scheduled_scans(next_scan_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_scans_active ON scheduled_scans(is_active);

-- RLS für Scheduled Scans
ALTER TABLE scheduled_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scheduled scans" ON scheduled_scans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own scheduled scans" ON scheduled_scans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled scans" ON scheduled_scans
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scheduled scans" ON scheduled_scans
  FOR DELETE USING (auth.uid() = user_id);

-- Scheduled Scan History (für Trend-Analyse)
CREATE TABLE IF NOT EXISTS scheduled_scan_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scheduled_scan_id UUID NOT NULL REFERENCES scheduled_scans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  result JSONB NOT NULL,
  violation_count INTEGER DEFAULT 0,
  new_violations JSONB DEFAULT '[]'::jsonb,
  fixed_violations JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index für History
CREATE INDEX IF NOT EXISTS idx_scheduled_scan_history_scan_id ON scheduled_scan_history(scheduled_scan_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_scan_history_created_at ON scheduled_scan_history(created_at DESC);

-- RLS für History
ALTER TABLE scheduled_scan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scan history" ON scheduled_scan_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own scan history" ON scheduled_scan_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Phase 2: Developer API Keys
-- ============================================

-- API Keys Tabelle
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL, -- First 8 chars for display
  rate_limit INTEGER DEFAULT 100, -- requests per hour
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index für API Keys
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);

-- RLS für API Keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api keys" ON api_keys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own api keys" ON api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own api keys" ON api_keys
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own api keys" ON api_keys
  FOR DELETE USING (auth.uid() = user_id);

-- API Usage Logs (für Rate Limiting und Analytics)
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index für Usage Logs
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_key_id ON api_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON api_usage_logs(created_at);

-- RLS für Usage Logs
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api usage" ON api_usage_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Function to get API usage in last hour (for rate limiting)
CREATE OR REPLACE FUNCTION get_api_usage_last_hour(p_api_key_id UUID)
RETURNS INTEGER AS $$
DECLARE
  usage_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO usage_count
  FROM api_usage_logs
  WHERE api_key_id = p_api_key_id
    AND created_at > NOW() - INTERVAL '1 hour';
  RETURN usage_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
