/*
# Content Automation Dashboard - Core Schema

1. Purpose
   Single-tenant content automation platform for a creator managing AI-generated
   video series. No sign-in screen, so all policies use `TO anon, authenticated`.

2. New Tables
   - `series`: High-level show/container with synopsis, tone, visual theme, duration.
   - `episodes`: Individual episodes belonging to a series. Holds script, variants,
     status, scheduling, publish info, video/thumbnail URLs.
   - `characters`: Face identity lock registry, voice-clone map, costume matrix,
     visual consistency anchors — scoped to a series.
   - `analytics`: 50+ factor tracking core. One row per (episode, metric) pair with
     value + recorded_at, plus a baseline flag.
   - `logs`: Terminal-style ambient backend state stream. level, source, message,
     details (jsonb), retryable flag.
   - `tasks`: Daily action checklist + scheduled automation tasks. type, status,
     scheduled_at, completed_at, payload (jsonb).
   - `settings`: Key-value singleton store for theme personalization, API vault
     (encrypted keys stored as jsonb), automation config.

3. Security
   - RLS enabled on every table.
   - All policies `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`
     because this is a single-tenant app with no sign-in screen; data is intentionally
     shared/public within the app.

4. Notes
   - `script_variants` on episodes is jsonb so multiple script iterations can be
     stored and toggled via the Quick Script Variant Switcher.
   - `payload` on tasks is jsonb for flexible task-specific data.
   - `value` on settings is jsonb to support complex config objects (theme presets,
     encrypted API key vault, etc.).
   - `details` on logs is jsonb for structured error info.
*/

CREATE TABLE IF NOT EXISTS series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  synopsis text,
  tone text,
  visual_theme text,
  status text NOT NULL DEFAULT 'active',
  start_date date DEFAULT CURRENT_DATE,
  end_date date,
  duration_days integer NOT NULL DEFAULT 30,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid REFERENCES series(id) ON DELETE CASCADE,
  episode_number integer NOT NULL DEFAULT 1,
  title text,
  script jsonb,
  script_variants jsonb DEFAULT '[]'::jsonb,
  active_variant_index integer DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  video_url text,
  thumbnail_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  virality_score jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid REFERENCES series(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  face_metrics jsonb DEFAULT '{}'::jsonb,
  voice_id text,
  costume jsonb DEFAULT '{}'::jsonb,
  visual_anchors text,
  reference_image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid REFERENCES episodes(id) ON DELETE CASCADE,
  metric_name text NOT NULL,
  metric_value numeric,
  baseline boolean DEFAULT false,
  recorded_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL DEFAULT 'info',
  source text NOT NULL DEFAULT 'system',
  message text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  retryable boolean DEFAULT false,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL DEFAULT 'daily',
  status text NOT NULL DEFAULT 'pending',
  scheduled_at timestamptz,
  completed_at timestamptz,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_episodes_series_id ON episodes(series_id);
CREATE INDEX IF NOT EXISTS idx_episodes_status ON episodes(status);
CREATE INDEX IF NOT EXISTS idx_episodes_scheduled_at ON episodes(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_characters_series_id ON characters(series_id);
CREATE INDEX IF NOT EXISTS idx_analytics_episode_id ON analytics(episode_id);
CREATE INDEX IF NOT EXISTS idx_analytics_metric_name ON analytics(metric_name);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_at ON tasks(scheduled_at);

-- Enable RLS on all tables
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Series policies (single-tenant: anon + authenticated, public/shared data)
DROP POLICY IF EXISTS "anon_select_series" ON series;
CREATE POLICY "anon_select_series" ON series FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_series" ON series;
CREATE POLICY "anon_insert_series" ON series FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_series" ON series;
CREATE POLICY "anon_update_series" ON series FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_series" ON series;
CREATE POLICY "anon_delete_series" ON series FOR DELETE
  TO anon, authenticated USING (true);

-- Episodes policies
DROP POLICY IF EXISTS "anon_select_episodes" ON episodes;
CREATE POLICY "anon_select_episodes" ON episodes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_episodes" ON episodes;
CREATE POLICY "anon_insert_episodes" ON episodes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_episodes" ON episodes;
CREATE POLICY "anon_update_episodes" ON episodes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_episodes" ON episodes;
CREATE POLICY "anon_delete_episodes" ON episodes FOR DELETE
  TO anon, authenticated USING (true);

-- Characters policies
DROP POLICY IF EXISTS "anon_select_characters" ON characters;
CREATE POLICY "anon_select_characters" ON characters FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_characters" ON characters;
CREATE POLICY "anon_insert_characters" ON characters FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_characters" ON characters;
CREATE POLICY "anon_update_characters" ON characters FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_characters" ON characters;
CREATE POLICY "anon_delete_characters" ON characters FOR DELETE
  TO anon, authenticated USING (true);

-- Analytics policies
DROP POLICY IF EXISTS "anon_select_analytics" ON analytics;
CREATE POLICY "anon_select_analytics" ON analytics FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_analytics" ON analytics;
CREATE POLICY "anon_insert_analytics" ON analytics FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_analytics" ON analytics;
CREATE POLICY "anon_update_analytics" ON analytics FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_analytics" ON analytics;
CREATE POLICY "anon_delete_analytics" ON analytics FOR DELETE
  TO anon, authenticated USING (true);

-- Logs policies
DROP POLICY IF EXISTS "anon_select_logs" ON logs;
CREATE POLICY "anon_select_logs" ON logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_logs" ON logs;
CREATE POLICY "anon_insert_logs" ON logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_logs" ON logs;
CREATE POLICY "anon_update_logs" ON logs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_logs" ON logs;
CREATE POLICY "anon_delete_logs" ON logs FOR DELETE
  TO anon, authenticated USING (true);

-- Tasks policies
DROP POLICY IF EXISTS "anon_select_tasks" ON tasks;
CREATE POLICY "anon_select_tasks" ON tasks FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_tasks" ON tasks;
CREATE POLICY "anon_insert_tasks" ON tasks FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_tasks" ON tasks;
CREATE POLICY "anon_update_tasks" ON tasks FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_tasks" ON tasks;
CREATE POLICY "anon_delete_tasks" ON tasks FOR DELETE
  TO anon, authenticated USING (true);

-- Settings policies
DROP POLICY IF EXISTS "anon_select_settings" ON settings;
CREATE POLICY "anon_select_settings" ON settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_settings" ON settings;
CREATE POLICY "anon_insert_settings" ON settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_settings" ON settings;
CREATE POLICY "anon_update_settings" ON settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_settings" ON settings;
CREATE POLICY "anon_delete_settings" ON settings FOR DELETE
  TO anon, authenticated USING (true);

-- Seed default settings rows
INSERT INTO settings (key, value) VALUES
  ('theme', '{"accent": "#00d4ff", "radius": 12, "preset": "midnight"}'::jsonb),
  ('api_vault', '{}'::jsonb),
  ('automation', '{"publish_time": "07:00", "auto_timing": true, "comment_automation": true}'::jsonb),
  ('social', '{"instagram": {"handle": "aicartoonwallah", "status": "disconnected"}, "youtube": {"handle": "Edit with Me", "status": "disconnected"}, "facebook": {"handle": "", "status": "disconnected"}}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Seed a default active series
INSERT INTO series (title, synopsis, tone, visual_theme, status)
SELECT 'AI Cartoon Wallah', 'A daily AI-generated animated series following whimsical characters through heartwarming adventures, optimized for short-form viral distribution across Instagram Reels and YouTube Shorts.', 'Heartwarming, humorous, cinematic', 'Disney Pixar 3D style, octane render, volumetric lighting, rich bokeh', 'active'
WHERE NOT EXISTS (SELECT 1 FROM series WHERE status = 'active');
