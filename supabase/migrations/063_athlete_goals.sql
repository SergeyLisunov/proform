-- Sprint W5 Day 25 (PR #41) — Athlete Goals & Progress.
--
-- Athlete-side goals tracking. Coach может set goals для своих athletes
-- (через trainer_athletes accepted link). Athlete видит own goals + progress
-- chart на /athlete/goals + /athlete/progress.
--
-- Metric types (free text, не enum — позволяет custom metrics):
--   'pb_5k'           — личный рекорд 5к (минуты)
--   'pb_10k'          — личный рекорд 10к
--   'weekly_volume'   — weekly training hours
--   'weight_kg'       — target weight
--   'monthly_sessions'— target sessions per month
--   'custom'          — free text + numeric value
--
-- RLS:
--   Athlete: read+write own goals (athlete_id = me)
--   Coach с trainer_athletes accepted link: read+write athlete's goals
--   Doctor: NO access
--   Org admin/owner: read-only через org_members
--
-- Применено через Supabase MCP 2026-05-12.

CREATE TABLE IF NOT EXISTS athlete_goals (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  set_by_user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  metric             varchar(60) NOT NULL,
  metric_label       varchar(160) NOT NULL,
  target_value       numeric(10,2),
  target_unit        varchar(20),
  target_date        date,
  current_value      numeric(10,2),
  status             varchar(20) NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','achieved','abandoned')),
  achieved_at        timestamptz,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_athlete_goals_athlete_status
  ON athlete_goals (athlete_id, status, target_date)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_athlete_goals_set_by
  ON athlete_goals (set_by_user_id, created_at DESC)
  WHERE set_by_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION trg_athlete_goals_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.status = 'achieved' AND OLD.status <> 'achieved') THEN
    NEW.achieved_at := COALESCE(NEW.achieved_at, now());
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_athlete_goals_updated_at ON athlete_goals;
CREATE TRIGGER trg_athlete_goals_updated_at
BEFORE UPDATE ON athlete_goals
FOR EACH ROW EXECUTE FUNCTION trg_athlete_goals_set_updated_at();

ALTER TABLE athlete_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY athlete_goals_athlete_own
ON athlete_goals FOR ALL
USING (athlete_id = get_my_user_id())
WITH CHECK (athlete_id = get_my_user_id());

CREATE POLICY athlete_goals_coach_assigned
ON athlete_goals FOR ALL
USING (EXISTS (
  SELECT 1 FROM trainer_athletes ta
  WHERE ta.trainer_id = get_my_user_id()
    AND ta.athlete_id = athlete_goals.athlete_id
    AND ta.status = 'accepted'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM trainer_athletes ta
  WHERE ta.trainer_id = get_my_user_id()
    AND ta.athlete_id = athlete_goals.athlete_id
    AND ta.status = 'accepted'
));

CREATE POLICY athlete_goals_org_admin_read
ON athlete_goals FOR SELECT
USING (EXISTS (
  SELECT 1 FROM org_members om
  WHERE om.user_id = athlete_goals.athlete_id
    AND om.status = 'active'
    AND om.org_id IN (
      SELECT id FROM users WHERE id = get_my_user_id() AND role = 'organization'
    )
));

NOTIFY pgrst, 'reload schema';
