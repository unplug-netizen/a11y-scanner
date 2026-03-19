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
