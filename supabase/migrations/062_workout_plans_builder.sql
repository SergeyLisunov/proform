-- Sprint W5 Day 24 (PR #40) — Coach Workout Builder.
--
-- Новые таблицы для re-usable weekly plans (отличаются от существующего
-- workout_templates из migration 012 — то для single-workout templates,
-- здесь для multi-day plans 1-12 weeks).
--
-- Architecture:
--   workout_plans: re-usable templates (coach owns; can be is_public для org share)
--   workout_plan_items: per-day items (день недели 0-83 для 12 недель,
--     order_in_day для multiple workouts in one day,
--     activity_type + duration + intensity + notes)
--
-- Assign-to-athlete flow:
--   POST /api/coach/plans/[id]/assign { athlete_id, start_date }
--   → создаёт N workouts (per item) с event_type='prescribed'
--
-- RLS:
--   workout_plans: coach own + others' if is_public
--   workout_plan_items: inherits parent plan policy
--
-- Применено через Supabase MCP 2026-05-12.

-- ── workout_plans ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workout_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            varchar(160) NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  description     text,
  sport           varchar(60),
  duration_weeks  smallint NOT NULL DEFAULT 1 CHECK (duration_weeks BETWEEN 1 AND 12),
  is_public       boolean NOT NULL DEFAULT false,
  is_archived     boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_plans_coach
  ON workout_plans (coach_id, created_at DESC)
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_workout_plans_public
  ON workout_plans (sport, created_at DESC)
  WHERE is_public = true AND is_archived = false;

-- ── workout_plan_items ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workout_plan_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id             uuid NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  day_index           smallint NOT NULL CHECK (day_index BETWEEN 0 AND 83), -- 12 weeks × 7 days
  order_in_day        smallint NOT NULL DEFAULT 0,
  activity_type       varchar(40) NOT NULL,
  name                varchar(160),
  duration_min        smallint CHECK (duration_min BETWEEN 0 AND 600),
  intensity           varchar(20) CHECK (intensity IS NULL OR intensity IN ('easy','moderate','hard','rest')),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, day_index, order_in_day)
);

CREATE INDEX IF NOT EXISTS idx_workout_plan_items_plan
  ON workout_plan_items (plan_id, day_index, order_in_day);

-- ── Updated_at trigger ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_workout_plans_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workout_plans_updated_at ON workout_plans;
CREATE TRIGGER trg_workout_plans_updated_at
BEFORE UPDATE ON workout_plans
FOR EACH ROW EXECUTE FUNCTION trg_workout_plans_set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────
ALTER TABLE workout_plans       ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_plan_items  ENABLE ROW LEVEL SECURITY;

CREATE POLICY workout_plans_read_own_or_public
ON workout_plans FOR SELECT
USING (
  coach_id = get_my_user_id()
  OR is_public = true
);

CREATE POLICY workout_plans_insert_own
ON workout_plans FOR INSERT
WITH CHECK (coach_id = get_my_user_id());

CREATE POLICY workout_plans_update_own
ON workout_plans FOR UPDATE
USING (coach_id = get_my_user_id())
WITH CHECK (coach_id = get_my_user_id());

CREATE POLICY workout_plans_delete_own
ON workout_plans FOR DELETE
USING (coach_id = get_my_user_id());

CREATE POLICY workout_plan_items_read_via_plan
ON workout_plan_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM workout_plans wp
  WHERE wp.id = workout_plan_items.plan_id
    AND (wp.coach_id = get_my_user_id() OR wp.is_public = true)
));

CREATE POLICY workout_plan_items_write_via_plan
ON workout_plan_items FOR ALL
USING (EXISTS (
  SELECT 1 FROM workout_plans wp
  WHERE wp.id = workout_plan_items.plan_id
    AND wp.coach_id = get_my_user_id()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM workout_plans wp
  WHERE wp.id = workout_plan_items.plan_id
    AND wp.coach_id = get_my_user_id()
));

NOTIFY pgrst, 'reload schema';
