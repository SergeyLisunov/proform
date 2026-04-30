-- ──────────────────────────────────────────────────────────────────────────
-- 049_wellness_checkins.sql
-- Sprint Week 1, Day 3 — Daily Wellness Check-in.
--
-- Атлет каждый день за 30 секунд отвечает: настроение, сон, болезненность,
-- энергия. Эти данные:
--   1. Дают тренеру ранний сигнал о перетренированности (до того, как
--      ACWR попадёт в красную зону).
--   2. Питают AI endpoint'ы (coach-briefing, anomaly-check, adaptive-plan)
--      — сейчас они смотрят только на workout.mood post-factum, а wellness
--      даёт pre-workout signal.
--   3. Создают daily engagement loop — ритуал, который атлет открывает
--      приложение каждое утро.
--
-- Уникальность по (athlete_id, date) — один чек-ин в день. Повторное
-- сохранение в этот же день делает UPSERT (через ON CONFLICT в service
-- layer).
--
-- RLS:
--   - athlete: full CRUD on own rows
--   - coach: SELECT for athletes via active trainer_athletes link
--   - doctor/specialist: SELECT for athletes via active connections.doctor_athlete
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wellness_checkins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            date NOT NULL,
  -- Mood 1 (terrible) – 5 (great)
  mood            smallint CHECK (mood IS NULL OR mood BETWEEN 1 AND 5),
  -- Sleep duration in hours, 0–14 (decimal allowed: 7.5)
  sleep_hours     numeric(4,2) CHECK (sleep_hours IS NULL OR (sleep_hours >= 0 AND sleep_hours <= 14)),
  -- Sleep quality 1 (worst) – 5 (best)
  sleep_quality   smallint CHECK (sleep_quality IS NULL OR sleep_quality BETWEEN 1 AND 5),
  -- Soreness 0 (none) – 10 (severe)
  soreness        smallint CHECK (soreness IS NULL OR soreness BETWEEN 0 AND 10),
  -- Energy 1 (drained) – 5 (energized)
  energy          smallint CHECK (energy IS NULL OR energy BETWEEN 1 AND 5),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, date)
);

CREATE INDEX IF NOT EXISTS idx_wellness_checkins_athlete_date
  ON wellness_checkins(athlete_id, date DESC);

ALTER TABLE wellness_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wellness_checkins_athlete_all ON wellness_checkins;
CREATE POLICY wellness_checkins_athlete_all ON wellness_checkins
  FOR ALL USING (athlete_id = (SELECT get_my_user_id()))
           WITH CHECK (athlete_id = (SELECT get_my_user_id()));

DROP POLICY IF EXISTS wellness_checkins_coach_read ON wellness_checkins;
CREATE POLICY wellness_checkins_coach_read ON wellness_checkins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trainer_athletes ta
       WHERE ta.trainer_id = (SELECT get_my_user_id())
         AND ta.athlete_id = wellness_checkins.athlete_id
         AND ta.status = 'accepted'
    )
  );

DROP POLICY IF EXISTS wellness_checkins_doctor_read ON wellness_checkins;
CREATE POLICY wellness_checkins_doctor_read ON wellness_checkins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM connections c
       WHERE c.connection_type = 'doctor_athlete'
         AND c.status = 'active'
         AND (
           (c.initiator_id = (SELECT get_my_user_id()) AND c.recipient_id = wellness_checkins.athlete_id)
           OR
           (c.recipient_id = (SELECT get_my_user_id()) AND c.initiator_id = wellness_checkins.athlete_id)
         )
    )
  );

CREATE OR REPLACE FUNCTION trg_wellness_checkins_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_wellness_checkins_updated_at ON wellness_checkins;
CREATE TRIGGER trg_wellness_checkins_updated_at BEFORE UPDATE ON wellness_checkins
  FOR EACH ROW EXECUTE FUNCTION trg_wellness_checkins_updated_at();

NOTIFY pgrst, 'reload schema';
