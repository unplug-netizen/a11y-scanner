-- Focus scans table for storing focus order analysis results
CREATE TABLE IF NOT EXISTS focus_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  result JSONB NOT NULL,
  issue_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_focus_scans_user_id ON focus_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_scans_created_at ON focus_scans(created_at);

-- Row Level Security policies
ALTER TABLE focus_scans ENABLE ROW LEVEL SECURITY;

-- Users can only see their own focus scans
CREATE POLICY focus_scans_select_policy ON focus_scans
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own focus scans
CREATE POLICY focus_scans_insert_policy ON focus_scans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own focus scans
CREATE POLICY focus_scans_delete_policy ON focus_scans
  FOR DELETE USING (auth.uid() = user_id);
