-- ============================================
-- Phase 3: Integrations (Slack, Email)
-- ============================================

-- User Integrations Table (Slack, Email)
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Slack Integration
  slack_webhook_url TEXT,
  slack_channel TEXT,
  slack_enabled BOOLEAN DEFAULT false,
  
  -- Email Integration (Resend/SendGrid)
  email_enabled BOOLEAN DEFAULT false,
  email_address TEXT,
  notify_on_scan_complete BOOLEAN DEFAULT true,
  notify_on_new_issues BOOLEAN DEFAULT true,
  notify_on_scheduled_scan BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON user_integrations(user_id);

-- RLS
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrations" ON user_integrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own integrations" ON user_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations" ON user_integrations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations" ON user_integrations
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Phase 3: Team/Workspace
-- ============================================

-- Workspaces Table
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logo_url TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);

-- RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view workspaces they are members of" ON workspaces
  FOR SELECT USING (
    auth.uid() = owner_id OR 
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_id = workspaces.id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Only owners can update workspace" ON workspaces
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Only owners can delete workspace" ON workspaces
  FOR DELETE USING (auth.uid() = owner_id);

-- Workspace Members Table
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- admin, member, viewer
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  joined_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending', -- pending, active, inactive
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_status ON workspace_members(status);

-- RLS
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace members" ON workspace_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
    ) OR 
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = workspace_members.workspace_id
      AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins and owners can manage members" ON workspace_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('admin', 'owner')
    ) OR 
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = workspace_members.workspace_id
      AND w.owner_id = auth.uid()
    )
  );

-- Workspace Scans (Shared Scan History)
CREATE TABLE IF NOT EXISTS workspace_scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  result JSONB NOT NULL,
  violation_count INTEGER DEFAULT 0,
  scan_mode TEXT DEFAULT 'quick',
  shared_with_workspace BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_workspace_scans_workspace_id ON workspace_scans(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_scans_created_at ON workspace_scans(created_at DESC);

-- RLS
ALTER TABLE workspace_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view shared scans" ON workspace_scans
  FOR SELECT USING (
    shared_with_workspace = true AND (
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = workspace_scans.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
      ) OR 
      EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = workspace_scans.workspace_id
        AND w.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Members can create workspace scans" ON workspace_scans
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_scans.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.status = 'active'
      AND wm.role IN ('admin', 'member')
    ) OR 
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = workspace_scans.workspace_id
      AND w.owner_id = auth.uid()
    )
  );

-- Team API Keys (Shared within workspace)
CREATE TABLE IF NOT EXISTS team_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  rate_limit INTEGER DEFAULT 1000,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  permissions JSONB DEFAULT '["scan", "read"]'::jsonb, -- scan, read, admin
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_team_api_keys_workspace_id ON team_api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_team_api_keys_key_hash ON team_api_keys(key_hash);

-- RLS
ALTER TABLE team_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace admins can view team API keys" ON team_api_keys
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = team_api_keys.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.status = 'active'
      AND wm.role IN ('admin', 'owner')
    ) OR 
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = team_api_keys.workspace_id
      AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage team API keys" ON team_api_keys
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = team_api_keys.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.status = 'active'
      AND wm.role IN ('admin', 'owner')
    ) OR 
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = team_api_keys.workspace_id
      AND w.owner_id = auth.uid()
    )
  );

-- ============================================
-- Phase 3: User Preferences (Dark Mode, Onboarding)
-- ============================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Theme
  theme TEXT DEFAULT 'system', -- light, dark, system
  
  -- Onboarding
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_step INTEGER DEFAULT 0,
  
  -- Dashboard
  dashboard_layout JSONB DEFAULT '{}'::jsonb,
  
  -- Tour/Tooltips
  tour_completed BOOLEAN DEFAULT false,
  dismissed_tips TEXT[] DEFAULT '{}'::text[],
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Phase 3: Notification Queue (for email/slack)
-- ============================================

CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- email, slack
  channel TEXT NOT NULL, -- scan_complete, new_issues, scheduled_scan
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, sent, failed
  retry_count INTEGER DEFAULT 0,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_created_at ON notification_queue(created_at);

-- RLS
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notification_queue
  FOR SELECT USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_integrations_updated_at
  BEFORE UPDATE ON user_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
