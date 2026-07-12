-- ═══════════════════════════════════════════════════════════════════════════
-- ContentOps — Full Database Schema & RLS Policies
-- ═══════════════════════════════════════════════════════════════════════════
-- Copy-paste this entire file into the Supabase SQL Editor to set up all
-- tables, indexes, and Row Level Security (RLS) policies.
--
-- This schema is multi-user: each authenticated user sees only their own data.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Extensions ───
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. SERIES — Top-level content series
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS series (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title         text NOT NULL,
  synopsis     text,
  tone          text,
  visual_theme  text,
  status        text NOT NULL DEFAULT 'active',
  start_date    date,
  end_date      date,
  duration_days integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_series" ON series;
CREATE POLICY "select_own_series" ON series FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_series" ON series FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_series" ON series FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_series" ON series FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_series_user_id ON series(user_id);
CREATE INDEX IF NOT EXISTS idx_series_created_at ON series(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. EPISODES — Individual episodes within a series
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS episodes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id            uuid REFERENCES series(id) ON DELETE CASCADE,
  episode_number       integer NOT NULL DEFAULT 1,
  title                text,
  script               jsonb,
  script_variants      jsonb NOT NULL DEFAULT '[]',
  active_variant_index integer NOT NULL DEFAULT 0,
  status               text NOT NULL DEFAULT 'draft',
  scheduled_at         timestamptz,
  published_at        timestamptz,
  video_url            text,
  thumbnail_url        text,
  metadata             jsonb NOT NULL DEFAULT '{}',
  virality_score       jsonb NOT NULL DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;

-- Episodes are scoped through the parent series ownership
DROP POLICY IF EXISTS "select_own_episodes" ON episodes;
CREATE POLICY "select_own_episodes" ON episodes FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM series WHERE series.id = episodes.series_id AND series.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_episodes" ON episodes FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM series WHERE series.id = episodes.series_id AND series.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_episodes" ON episodes FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM series WHERE series.id = episodes.series_id AND series.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM series WHERE series.id = episodes.series_id AND series.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_episodes" ON episodes FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM series WHERE series.id = episodes.series_id AND series.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_episodes_series_id ON episodes(series_id);
CREATE INDEX IF NOT EXISTS idx_episodes_status ON episodes(status);
CREATE INDEX IF NOT EXISTS idx_episodes_created_at ON episodes(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. CHARACTERS — Character profiles with face identity lock data
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS characters (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id           uuid REFERENCES series(id) ON DELETE CASCADE,
  name                text NOT NULL,
  description         text,
  face_metrics        jsonb NOT NULL DEFAULT '{}',
  voice_id            text,
  costume             jsonb NOT NULL DEFAULT '{}',
  visual_anchors      text,
  reference_image_url text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_characters" ON characters;
CREATE POLICY "select_own_characters" ON characters FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM series WHERE series.id = characters.series_id AND series.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_characters" ON characters FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM series WHERE series.id = characters.series_id AND series.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_characters" ON characters FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM series WHERE series.id = characters.series_id AND series.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM series WHERE series.id = characters.series_id AND series.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_characters" ON characters FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM series WHERE series.id = characters.series_id AND series.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_characters_series_id ON characters(series_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. ANALYTICS — Performance metrics per episode
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS analytics (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id   uuid REFERENCES episodes(id) ON DELETE CASCADE,
  metric_name  text NOT NULL,
  metric_value numeric,
  baseline     boolean NOT NULL DEFAULT false,
  recorded_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_analytics" ON analytics;
CREATE POLICY "select_own_analytics" ON analytics FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM episodes
      JOIN series ON series.id = episodes.series_id
      WHERE episodes.id = analytics.episode_id AND series.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_analytics" ON analytics FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM episodes
      JOIN series ON series.id = episodes.series_id
      WHERE episodes.id = analytics.episode_id AND series.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_analytics" ON analytics FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM episodes
      JOIN series ON series.id = episodes.series_id
      WHERE episodes.id = analytics.episode_id AND series.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM episodes
      JOIN series ON series.id = episodes.series_id
      WHERE episodes.id = analytics.episode_id AND series.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_analytics" ON analytics FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM episodes
      JOIN series ON series.id = episodes.series_id
      WHERE episodes.id = analytics.episode_id AND series.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_analytics_episode_id ON analytics(episode_id);
CREATE INDEX IF NOT EXISTS idx_analytics_recorded_at ON analytics(recorded_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. LOGS — System event logs for the Ambient Console
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  level      text NOT NULL DEFAULT 'info',
  source     text NOT NULL,
  message    text NOT NULL,
  details    jsonb NOT NULL DEFAULT '{}',
  retryable  boolean NOT NULL DEFAULT false,
  resolved   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_logs" ON logs;
CREATE POLICY "select_own_logs" ON logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_logs" ON logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_logs" ON logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_logs" ON logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. TASKS — Scheduled tasks for the automation queue
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  type         text NOT NULL,
  status       text NOT NULL DEFAULT 'pending',
  scheduled_at timestamptz,
  completed_at timestamptz,
  payload      jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tasks" ON tasks;
CREATE POLICY "select_own_tasks" ON tasks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tasks" ON tasks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tasks" ON tasks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tasks" ON tasks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_at ON tasks(scheduled_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. SETTINGS — User-scoped key-value settings store
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS settings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  key        text NOT NULL,
  value      jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, key)
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_settings" ON settings;
CREATE POLICY "select_own_settings" ON settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_settings" ON settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_settings" ON settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_settings" ON settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. updated_at TRIGGER — Auto-update updated_at on row modification
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_series_updated_at ON series;
CREATE TRIGGER update_series_updated_at BEFORE UPDATE ON series
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_episodes_updated_at ON episodes;
CREATE TRIGGER update_episodes_updated_at BEFORE UPDATE ON episodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_characters_updated_at ON characters;
CREATE TRIGGER update_characters_updated_at BEFORE UPDATE ON characters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE — All tables, indexes, RLS policies, and triggers are now active.
-- ═══════════════════════════════════════════════════════════════════════════
