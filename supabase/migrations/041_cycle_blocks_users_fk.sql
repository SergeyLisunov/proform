-- ──────────────────────────────────────────────────────────────────────────
-- 041_cycle_blocks_users_fk.sql
-- Fix CLAUDE.md invariant violation in 009_cycle_blocks.sql:
--   "Все FK используют users.id (не auth.uid())"
--
-- Migration 009 created cycle_blocks.user_id and cycle_days.user_id with
-- FKs pointing at auth.users(id). RLS policies relied on user_id = auth.uid().
-- This migration:
--   (1) Backfills existing rows so user_id stores users.id (translates
--       through users.auth_id = auth.users.id).
--   (2) Drops the old auth.users FKs and adds new FKs to users(id).
--   (3) Replaces the bare-auth.uid() RLS policies with the project-wide
--       get_my_user_id() pattern, wrapped in (SELECT …) per migration 031
--       (initplan optimisation).
--   (4) NOTIFY pgrst so PostgREST re-introspects the new constraints.
--
-- Idempotent: every step uses IF EXISTS / IF NOT EXISTS / ON CONFLICT-style
-- guards. Safe to re-apply.
-- ──────────────────────────────────────────────────────────────────────────

-- (1) Backfill — translate any auth.users.id values currently in user_id
-- columns to the corresponding users.id. Rows whose user_id already matches
-- a users.id are left untouched (the JOIN simply doesn't match for them
-- because users.auth_id won't equal a users.id by accident).
UPDATE cycle_blocks AS cb
   SET user_id = u.id
  FROM users u
 WHERE cb.user_id = u.auth_id
   AND cb.user_id <> u.id;

UPDATE cycle_days AS cd
   SET user_id = u.id
  FROM users u
 WHERE cd.user_id = u.auth_id
   AND cd.user_id <> u.id;

-- Any cycle_blocks/cycle_days rows that still reference an auth.users.id
-- without a matching users row would block the new FK. Surface them by
-- failing fast — operator must reconcile manually before re-applying.
DO $$
DECLARE
  orphan_blocks int;
  orphan_days   int;
BEGIN
  SELECT COUNT(*) INTO orphan_blocks
    FROM cycle_blocks cb
   WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = cb.user_id);
  SELECT COUNT(*) INTO orphan_days
    FROM cycle_days cd
   WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = cd.user_id);
  IF orphan_blocks > 0 OR orphan_days > 0 THEN
    RAISE EXCEPTION
      'Orphan rows after backfill: cycle_blocks=%, cycle_days=%. Reconcile before re-running migration 041.',
      orphan_blocks, orphan_days;
  END IF;
END $$;

-- (2) Swap the FK targets. Drop by name as defined in migration 009 (Postgres
-- auto-names them <table>_<column>_fkey when no constraint name is given).
ALTER TABLE cycle_blocks DROP CONSTRAINT IF EXISTS cycle_blocks_user_id_fkey;
ALTER TABLE cycle_days   DROP CONSTRAINT IF EXISTS cycle_days_user_id_fkey;

ALTER TABLE cycle_blocks
  ADD CONSTRAINT cycle_blocks_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE cycle_days
  ADD CONSTRAINT cycle_days_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- (3) Replace bare auth.uid() RLS policies with the wrapped
-- get_my_user_id() pattern. Names match those introduced in migration 009.
DROP POLICY IF EXISTS "cycle_blocks_select" ON cycle_blocks;
DROP POLICY IF EXISTS "cycle_blocks_insert" ON cycle_blocks;
DROP POLICY IF EXISTS "cycle_blocks_update" ON cycle_blocks;
DROP POLICY IF EXISTS "cycle_blocks_delete" ON cycle_blocks;

CREATE POLICY "cycle_blocks_select" ON cycle_blocks
  FOR SELECT USING (user_id = (SELECT get_my_user_id()));

CREATE POLICY "cycle_blocks_insert" ON cycle_blocks
  FOR INSERT WITH CHECK (user_id = (SELECT get_my_user_id()));

CREATE POLICY "cycle_blocks_update" ON cycle_blocks
  FOR UPDATE USING (user_id = (SELECT get_my_user_id()))
             WITH CHECK (user_id = (SELECT get_my_user_id()));

CREATE POLICY "cycle_blocks_delete" ON cycle_blocks
  FOR DELETE USING (user_id = (SELECT get_my_user_id()));

DROP POLICY IF EXISTS "cycle_days_select" ON cycle_days;
DROP POLICY IF EXISTS "cycle_days_insert" ON cycle_days;
DROP POLICY IF EXISTS "cycle_days_update" ON cycle_days;
DROP POLICY IF EXISTS "cycle_days_delete" ON cycle_days;

CREATE POLICY "cycle_days_select" ON cycle_days
  FOR SELECT USING (user_id = (SELECT get_my_user_id()));

CREATE POLICY "cycle_days_insert" ON cycle_days
  FOR INSERT WITH CHECK (user_id = (SELECT get_my_user_id()));

CREATE POLICY "cycle_days_update" ON cycle_days
  FOR UPDATE USING (user_id = (SELECT get_my_user_id()))
             WITH CHECK (user_id = (SELECT get_my_user_id()));

CREATE POLICY "cycle_days_delete" ON cycle_days
  FOR DELETE USING (user_id = (SELECT get_my_user_id()));

-- (4) Reload PostgREST so the swapped FKs and policies become visible
-- to the API layer.
NOTIFY pgrst, 'reload schema';
