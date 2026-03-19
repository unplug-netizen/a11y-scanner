-- False positive rules table for storing user-defined filters
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

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_false_positive_rules_user_id ON false_positive_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_false_positive_rules_violation_id ON false_positive_rules(violation_id);

-- Row Level Security policies
ALTER TABLE false_positive_rules ENABLE ROW LEVEL SECURITY;

-- Users can only see their own rules
CREATE POLICY false_positive_rules_select_policy ON false_positive_rules
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own rules
CREATE POLICY false_positive_rules_insert_policy ON false_positive_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own rules
CREATE POLICY false_positive_rules_delete_policy ON false_positive_rules
  FOR DELETE USING (auth.uid() = user_id);
