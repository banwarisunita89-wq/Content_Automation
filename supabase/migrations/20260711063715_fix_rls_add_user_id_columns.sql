/*
# Fix RLS Policies: Add Ownership Scoping to All Tables (Step 1 - Add Columns)

## Problem
All 7 tables had RLS policies using `USING (true)` / `WITH CHECK (true)` which
bypass row-level security entirely.

## Solution (Step 1 — Add user_id columns)
Add `user_id` columns to standalone tables (series, tasks, logs, settings).
Child tables (episodes, characters, analytics) are scoped via parent ownership.
Existing rows get a temporary nullable column — backfilled in Step 2.

## Tables Modified
- `series`: Added `user_id uuid DEFAULT auth.uid()` (nullable for now)
- `tasks`: Added `user_id uuid DEFAULT auth.uid()` (nullable for now)
- `logs`: Added `user_id uuid DEFAULT auth.uid()` (nullable for now)
- `settings`: Added `user_id uuid DEFAULT auth.uid()` (nullable for now)
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series' AND column_name = 'user_id') THEN
    ALTER TABLE series ADD COLUMN user_id uuid DEFAULT auth.uid();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'user_id') THEN
    ALTER TABLE tasks ADD COLUMN user_id uuid DEFAULT auth.uid();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logs' AND column_name = 'user_id') THEN
    ALTER TABLE logs ADD COLUMN user_id uuid DEFAULT auth.uid();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'user_id') THEN
    ALTER TABLE settings ADD COLUMN user_id uuid DEFAULT auth.uid();
  END IF;
END $$;
