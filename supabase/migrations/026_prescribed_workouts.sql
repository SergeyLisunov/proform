-- ──────────────────────────────────────────────────────────────────────────
-- 026_prescribed_workouts.sql
-- Coaches can pre-create a workout for their athletes. The athlete then
-- sees it as "to-do" and can mark it completed / skipped.
--
-- Non-destructive: adds nullable columns + RLS for the coach ↔ athlete edge.
-- Existing workouts (where prescribed_by IS NULL) are unaffected.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS prescribed_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prescribed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS prescribed_note text,
  ADD COLUMN IF NOT EXISTS completion_status varchar(20) DEFAULT NULL
    CHECK (completion_status IN ('pending','completed','skipped'));

CREATE INDEX IF NOT EXISTS idx_workouts_prescribed_by
  ON workouts(prescribed_by) WHERE prescribed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workouts_prescribed_athlete_date
  ON workouts(athlete_id, event_date) WHERE prescribed_by IS NOT NULL;

DROP POLICY IF EXISTS workouts_coach_prescribe ON workouts;
CREATE POLICY workouts_coach_prescribe ON workouts
  FOR INSERT WITH CHECK (
    prescribed_by = get_my_user_id()
    AND EXISTS (
      SELECT 1 FROM trainer_athletes ta
       WHERE ta.trainer_id = get_my_user_id()
         AND ta.athlete_id = workouts.athlete_id
         AND ta.status = 'accepted'
    )
  );

DROP POLICY IF EXISTS workouts_coach_update_prescribed ON workouts;
CREATE POLICY workouts_coach_update_prescribed ON workouts
  FOR UPDATE USING (prescribed_by = get_my_user_id())
  WITH CHECK (prescribed_by = get_my_user_id());

DROP POLICY IF EXISTS workouts_coach_select_prescribed ON workouts;
CREATE POLICY workouts_coach_select_prescribed ON workouts
  FOR SELECT USING (prescribed_by = get_my_user_id());

NOTIFY pgrst, 'reload schema';
