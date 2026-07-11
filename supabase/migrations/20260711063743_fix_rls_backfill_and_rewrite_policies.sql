/*
# Fix RLS Policies: Backfill user_id and Rewrite All Policies (Step 2)

## Problem
All 7 tables had RLS policies using `USING (true)` / `WITH CHECK (true)` which
bypass row-level security entirely for INSERT, UPDATE, DELETE.

## Solution (Step 2 — Backfill + Policy Rewrite)
1. Backfill any NULL user_id values with the first authenticated user's ID
   (or a sentinel UUID if no users exist yet).
2. Set user_id columns to NOT NULL with DEFAULT auth.uid().
3. Drop ALL old `anon_*` policies that used `true`.
4. Create new ownership-scoped policies using `auth.uid()` checks:
   - Standalone tables (series, tasks, logs, settings): direct `auth.uid() = user_id`
   - Child tables (episodes, characters): scoped via series parent ownership
   - Analytics: scoped via episodes → series parent ownership chain
5. All policies scoped to `TO authenticated` — anon role can no longer bypass RLS.

## Security Changes
- All 28 old `anon_*` policies dropped.
- 28 new policies created with proper `auth.uid()` ownership checks.
- No policy uses `USING (true)` or `WITH CHECK (true)`.
- All policies require `authenticated` role.
*/

-- ═══════════════════════════════════════════
-- Step 1: Backfill NULL user_id values
-- ═══════════════════════════════════════════

-- Backfill with the first registered user's ID, or a sentinel UUID if no users exist
DO $$
DECLARE
  first_user uuid;
BEGIN
  SELECT id INTO first_user FROM auth.users ORDER BY created_at LIMIT 1;
  IF first_user IS NULL THEN
    -- No users yet — use a sentinel so NOT NULL constraint passes;
    -- new rows will get auth.uid() via DEFAULT
    first_user := '00000000-0000-0000-0000-000000000000';
  END IF;

  UPDATE series SET user_id = first_user WHERE user_id IS NULL;
  UPDATE tasks SET user_id = first_user WHERE user_id IS NULL;
  UPDATE logs SET user_id = first_user WHERE user_id IS NULL;
  UPDATE settings SET user_id = first_user WHERE user_id IS NULL;
END $$;

-- ═══════════════════════════════════════════
-- Step 2: Set columns to NOT NULL with DEFAULT auth.uid()
-- ═══════════════════════════════════════════

ALTER TABLE series ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE series ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE tasks ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE logs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE logs ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE settings ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE settings ALTER COLUMN user_id SET DEFAULT auth.uid();

-- ═══════════════════════════════════════════
-- Step 3: Drop ALL old policies
-- ═══════════════════════════════════════════

DROP POLICY IF EXISTS "anon_select_analytics" ON analytics;
DROP POLICY IF EXISTS "anon_insert_analytics" ON analytics;
DROP POLICY IF EXISTS "anon_update_analytics" ON analytics;
DROP POLICY IF EXISTS "anon_delete_analytics" ON analytics;

DROP POLICY IF EXISTS "anon_select_characters" ON characters;
DROP POLICY IF EXISTS "anon_insert_characters" ON characters;
DROP POLICY IF EXISTS "anon_update_characters" ON characters;
DROP POLICY IF EXISTS "anon_delete_characters" ON characters;

DROP POLICY IF EXISTS "anon_select_episodes" ON episodes;
DROP POLICY IF EXISTS "anon_insert_episodes" ON episodes;
DROP POLICY IF EXISTS "anon_update_episodes" ON episodes;
DROP POLICY IF EXISTS "anon_delete_episodes" ON episodes;

DROP POLICY IF EXISTS "anon_select_logs" ON logs;
DROP POLICY IF EXISTS "anon_insert_logs" ON logs;
DROP POLICY IF EXISTS "anon_update_logs" ON logs;
DROP POLICY IF EXISTS "anon_delete_logs" ON logs;

DROP POLICY IF EXISTS "anon_select_series" ON series;
DROP POLICY IF EXISTS "anon_insert_series" ON series;
DROP POLICY IF EXISTS "anon_update_series" ON series;
DROP POLICY IF EXISTS "anon_delete_series" ON series;

DROP POLICY IF EXISTS "anon_select_settings" ON settings;
DROP POLICY IF EXISTS "anon_insert_settings" ON settings;
DROP POLICY IF EXISTS "anon_update_settings" ON settings;
DROP POLICY IF EXISTS "anon_delete_settings" ON settings;

DROP POLICY IF EXISTS "anon_select_tasks" ON tasks;
DROP POLICY IF EXISTS "anon_insert_tasks" ON tasks;
DROP POLICY IF EXISTS "anon_update_tasks" ON tasks;
DROP POLICY IF EXISTS "anon_delete_tasks" ON tasks;

-- ═══════════════════════════════════════════
-- Step 4: Create new ownership-scoped policies
-- ═══════════════════════════════════════════

-- ─── Series (standalone, direct user_id) ───
CREATE POLICY "select_own_series" ON series FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_series" ON series FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_series" ON series FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_series" ON series FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─── Episodes (child of series, scoped via parent) ───
CREATE POLICY "select_own_episodes" ON episodes FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM series WHERE series.id = episodes.series_id AND series.user_id = auth.uid())
  );
CREATE POLICY "insert_own_episodes" ON episodes FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM series WHERE series.id = episodes.series_id AND series.user_id = auth.uid())
  );
CREATE POLICY "update_own_episodes" ON episodes FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM series WHERE series.id = episodes.series_id AND series.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM series WHERE series.id = episodes.series_id AND series.user_id = auth.uid())
  );
CREATE POLICY "delete_own_episodes" ON episodes FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM series WHERE series.id = episodes.series_id AND series.user_id = auth.uid())
  );

-- ─── Characters (child of series, scoped via parent) ───
CREATE POLICY "select_own_characters" ON characters FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM series WHERE series.id = characters.series_id AND series.user_id = auth.uid())
  );
CREATE POLICY "insert_own_characters" ON characters FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM series WHERE series.id = characters.series_id AND series.user_id = auth.uid())
  );
CREATE POLICY "update_own_characters" ON characters FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM series WHERE series.id = characters.series_id AND series.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM series WHERE series.id = characters.series_id AND series.user_id = auth.uid())
  );
CREATE POLICY "delete_own_characters" ON characters FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM series WHERE series.id = characters.series_id AND series.user_id = auth.uid())
  );

-- ─── Analytics (child of episodes → series, scoped through both) ───
CREATE POLICY "select_own_analytics" ON analytics FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = analytics.episode_id
      AND EXISTS (
        SELECT 1 FROM series
        WHERE series.id = episodes.series_id
        AND series.user_id = auth.uid()
      )
    )
  );
CREATE POLICY "insert_own_analytics" ON analytics FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = analytics.episode_id
      AND EXISTS (
        SELECT 1 FROM series
        WHERE series.id = episodes.series_id
        AND series.user_id = auth.uid()
      )
    )
  );
CREATE POLICY "update_own_analytics" ON analytics FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = analytics.episode_id
      AND EXISTS (
        SELECT 1 FROM series
        WHERE series.id = episodes.series_id
        AND series.user_id = auth.uid()
      )
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = analytics.episode_id
      AND EXISTS (
        SELECT 1 FROM series
        WHERE series.id = episodes.series_id
        AND series.user_id = auth.uid()
      )
    )
  );
CREATE POLICY "delete_own_analytics" ON analytics FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = analytics.episode_id
      AND EXISTS (
        SELECT 1 FROM series
        WHERE series.id = episodes.series_id
        AND series.user_id = auth.uid()
      )
    )
  );

-- ─── Tasks (standalone, direct user_id) ───
CREATE POLICY "select_own_tasks" ON tasks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_tasks" ON tasks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_tasks" ON tasks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_tasks" ON tasks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─── Logs (standalone, direct user_id) ───
CREATE POLICY "select_own_logs" ON logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_logs" ON logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_logs" ON logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_logs" ON logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─── Settings (standalone, direct user_id) ───
CREATE POLICY "select_own_settings" ON settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_settings" ON settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_settings" ON settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_settings" ON settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
