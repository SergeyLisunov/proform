-- Sprint W8 Day 40 — Workout adherence nudge log.
--
-- Purpose: prevent duplicate adherence-nudge emails to the same athlete
-- within a short window. /api/cron/adherence-nudge runs daily, but
-- nudge fatigue is real — we don't want to ping the same athlete every
-- morning. Lookup on (athlete_id, nudge_type) sent within last 7 days
-- gates the send.
--
-- Nudge types:
--   missed_workouts    — athlete prescribed ≥3 workouts in past 7d, completed ≤1
--   expiring_pass      — athlete has an active pass expiring within 7 days
--   (future) at_risk_acwr, recovery_low, etc.

CREATE TABLE IF NOT EXISTS public.workout_nudges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nudge_type  text NOT NULL CHECK (nudge_type IN ('missed_workouts', 'expiring_pass', 'at_risk_acwr', 'recovery_low')),
  sent_at     timestamptz NOT NULL DEFAULT now(),
  /** Optional context — e.g. for missed_workouts: {missed: 3, scheduled: 5}. */
  payload     jsonb
);

-- Cron iterator hot path: "did we nudge this athlete in last 7d?"
CREATE INDEX IF NOT EXISTS idx_workout_nudges_dedup
  ON public.workout_nudges (athlete_id, nudge_type, sent_at DESC);

ALTER TABLE public.workout_nudges ENABLE ROW LEVEL SECURITY;

-- Athletes can see own history (transparency). Service-role inserts via cron.
DROP POLICY IF EXISTS workout_nudges_athlete_select ON public.workout_nudges;
CREATE POLICY workout_nudges_athlete_select ON public.workout_nudges
  FOR SELECT
  USING (athlete_id = (SELECT get_my_user_id()));

COMMENT ON TABLE public.workout_nudges IS
  'Sprint W8 Day 40: dedup log for adherence-nudge cron. One row per email sent.';

NOTIFY pgrst, 'reload schema';
