-- Phase 4.2 Migration: Neue Tabellen für Webhooks, Focus Scans und False Positive Rules
-- Ausführen im Supabase SQL Editor

-- ============================================
-- Webhooks Table
-- ============================================
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index für faster lookups
CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(is_active) WHERE is_active = true;

-- Row Level Security policies
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhooks_select_policy ON webhooks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY webhooks_insert_policy ON webhooks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY webhooks_update_policy ON webhooks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY webhooks_delete_policy ON webhooks
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Focus Scans Table
-- ============================================
CREATE TABLE IF NOT EXISTS focus_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  result JSONB NOT NULL,
  issue_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index für faster lookups
CREATE INDEX IF NOT EXISTS idx_focus_scans_user_id ON focus_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_scans_created_at ON focus_scans(created_at);

-- Row Level Security policies
ALTER TABLE focus_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY focus_scans_select_policy ON focus_scans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY focus_scans_insert_policy ON focus_scans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY focus_scans_delete_policy ON focus_scans
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- False Positive Rules Table
-- ============================================
CREATE TABLE IF NOT EXISTS false_positive_rules (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  violation_id TEXT NOT NULL,
  url_pattern TEXT,
  selector_pattern TEXT,
  html_pattern TEXT,
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index für faster lookups
CREATE INDEX IF NOT EXISTS idx_false_positive_rules_user_id ON false_positive_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_false_positive_rules_violation_id ON false_positive_rules(violation_id);

-- Row Level Security policies
ALTER TABLE false_positive_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY false_positive_rules_select_policy ON false_positive_rules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY false_positive_rules_insert_policy ON false_positive_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY false_positive_rules_delete_policy ON false_positive_rules
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Helper Function für updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger für webhooks
DROP TRIGGER IF EXISTS update_webhooks_updated_at ON webhooks;
CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
