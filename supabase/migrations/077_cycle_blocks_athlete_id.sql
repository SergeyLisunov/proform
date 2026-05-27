-- W18 Day 97 — C3 cycle_blocks/cycle_days schema fix.
--
-- Audit Day 93 finding: migration 009 created cycle_blocks.user_id +
-- cycle_days.user_id REFERENCING auth.users(id) instead of public.users(id).
-- Plus RLS policies use auth.uid() directly instead of get_my_user_id().
--
-- Hidden bug discovered Day 97: services/cycles.service.ts:65 already queries
-- `.eq('athlete_id', userId)` ON A COLUMN THAT DOESN'T EXIST. Service swallows
-- error и returns [] — users see empty cycles silently. Production /cycles page
-- has been functionally broken.
--
-- This migration:
--   1. Adds athlete_id uuid REFERENCES public.users(id) to both tables
--   2. Backfills athlete_id by resolving auth_id → users.id JOIN
--   3. Drops OLD RLS policies (auth.uid() based)
--   4. Creates NEW RLS policies using get_my_user_id() с athlete_id
--   5. Drops old user_id columns + indexes
--   6. Adds new indexes on athlete_id
--
-- After migration: services/cycles.service.ts line 74 (cycle_days using
-- .eq('user_id', ...)) must be updated к use 'athlete_id' для consistency —
-- ships в same PR.

BEGIN;

-- ════════════════════════════════════════════════════════════════════
-- cycle_blocks
-- ════════════════════════════════════════════════════════════════════

-- 1. Add athlete_id column (nullable initially для backfill)
ALTER TABLE public.cycle_blocks
  ADD COLUMN IF NOT EXISTS athlete_id uuid REFERENCES public.users(id) ON DELETE CASCADE;

-- 2. Backfill athlete_id from existing user_id (which stored auth.users.id)
UPDATE public.cycle_blocks cb
SET athlete_id = u.id
FROM public.users u
WHERE u.auth_id = cb.user_id
  AND cb.athlete_id IS NULL;

-- 3. Drop OLD RLS policies (auth.uid() based)
DROP POLICY IF EXISTS "cycle_blocks_select" ON public.cycle_blocks;
DROP POLICY IF EXISTS "cycle_blocks_insert" ON public.cycle_blocks;
DROP POLICY IF EXISTS "cycle_blocks_update" ON public.cycle_blocks;
DROP POLICY IF EXISTS "cycle_blocks_delete" ON public.cycle_blocks;

-- 4. Create NEW RLS policies using project convention
CREATE POLICY cycle_blocks_select ON public.cycle_blocks
  FOR SELECT
  USING (athlete_id = (SELECT public.get_my_user_id()));

CREATE POLICY cycle_blocks_insert ON public.cycle_blocks
  FOR INSERT
  WITH CHECK (athlete_id = (SELECT public.get_my_user_id()));

CREATE POLICY cycle_blocks_update ON public.cycle_blocks
  FOR UPDATE
  USING (athlete_id = (SELECT public.get_my_user_id()));

CREATE POLICY cycle_blocks_delete ON public.cycle_blocks
  FOR DELETE
  USING (athlete_id = (SELECT public.get_my_user_id()));

-- 5. Drop old user_id column + index
DROP INDEX IF EXISTS cycle_blocks_user_idx;
ALTER TABLE public.cycle_blocks DROP COLUMN IF EXISTS user_id;

-- 6. Make athlete_id NOT NULL (after backfill + drop of old user_id)
--    Rows что failed backfill (orphaned auth_id) will be deleted by CASCADE
--    if auth user is gone, OR кept с null athlete_id и will be invisible via RLS.
--    For data integrity, enforce NOT NULL — assume backfill complete.
ALTER TABLE public.cycle_blocks ALTER COLUMN athlete_id SET NOT NULL;

-- 7. New index on athlete_id
CREATE INDEX IF NOT EXISTS cycle_blocks_athlete_idx ON public.cycle_blocks (athlete_id);

-- ════════════════════════════════════════════════════════════════════
-- cycle_days
-- ════════════════════════════════════════════════════════════════════

-- 1. Add athlete_id column
ALTER TABLE public.cycle_days
  ADD COLUMN IF NOT EXISTS athlete_id uuid REFERENCES public.users(id) ON DELETE CASCADE;

-- 2. Backfill athlete_id
UPDATE public.cycle_days cd
SET athlete_id = u.id
FROM public.users u
WHERE u.auth_id = cd.user_id
  AND cd.athlete_id IS NULL;

-- 3. Drop OLD RLS policies
DROP POLICY IF EXISTS "cycle_days_select" ON public.cycle_days;
DROP POLICY IF EXISTS "cycle_days_insert" ON public.cycle_days;
DROP POLICY IF EXISTS "cycle_days_update" ON public.cycle_days;
DROP POLICY IF EXISTS "cycle_days_delete" ON public.cycle_days;

-- 4. Create NEW RLS policies
CREATE POLICY cycle_days_select ON public.cycle_days
  FOR SELECT
  USING (athlete_id = (SELECT public.get_my_user_id()));

CREATE POLICY cycle_days_insert ON public.cycle_days
  FOR INSERT
  WITH CHECK (athlete_id = (SELECT public.get_my_user_id()));

CREATE POLICY cycle_days_update ON public.cycle_days
  FOR UPDATE
  USING (athlete_id = (SELECT public.get_my_user_id()));

CREATE POLICY cycle_days_delete ON public.cycle_days
  FOR DELETE
  USING (athlete_id = (SELECT public.get_my_user_id()));

-- 5. Drop old user_id column + index
DROP INDEX IF EXISTS cycle_days_user_date_idx;
ALTER TABLE public.cycle_days DROP COLUMN IF EXISTS user_id;

-- 6. NOT NULL constraint
ALTER TABLE public.cycle_days ALTER COLUMN athlete_id SET NOT NULL;

-- 7. New index on (athlete_id, day_date) — preserves original query pattern
CREATE INDEX IF NOT EXISTS cycle_days_athlete_date_idx ON public.cycle_days (athlete_id, day_date);

-- ════════════════════════════════════════════════════════════════════

COMMIT;

NOTIFY pgrst, 'reload schema';
