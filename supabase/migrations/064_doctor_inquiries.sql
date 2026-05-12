-- Sprint W5 Day 26 (PR #43) — Doctor → Coach Inquiry workflow.
--
-- Killer feature for medical-coach integration. Differentiator vs
-- TrainingPeaks/TeamSnap (нет doctor module в той же плоскости).
--
-- Flow:
--   1. Coach видит athlete с risk flag → "Ask doctor" UI
--   2. Submits question (5 types: general / load_clearance / injury_review /
--      return_to_play / red_flag) + urgency (routine / urgent / red_flag)
--   3. Inquiry → doctor_inquiries row + Resend email to doctor
--   4. Doctor opens /doctor/inquiries → queue с pending inquiries → replies
--   5. status='answered' + responded_at → Coach получает notification
--   6. Coach может optionally создать recommendation entity для long-term
--      restriction propagation
--   7. Cron auto-closes inquiries старше expires_at (default 7d; urgent=72h;
--      red_flag=24h)
--
-- Применено через Supabase MCP 2026-05-12.

CREATE TABLE IF NOT EXISTS doctor_inquiries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  athlete_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  question        text NOT NULL CHECK (char_length(question) BETWEEN 10 AND 2000),
  question_type   varchar(40) NOT NULL DEFAULT 'general'
                    CHECK (question_type IN ('general','load_clearance','injury_review','return_to_play','red_flag')),
  urgency         varchar(20) NOT NULL DEFAULT 'routine'
                    CHECK (urgency IN ('routine','urgent','red_flag')),
  response        text CHECK (response IS NULL OR char_length(response) BETWEEN 5 AND 4000),
  status          varchar(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','answered','expired','cancelled')),
  responded_at    timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doctor_inquiries_doctor_pending
  ON doctor_inquiries (doctor_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_doctor_inquiries_coach
  ON doctor_inquiries (coach_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_doctor_inquiries_athlete
  ON doctor_inquiries (athlete_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_doctor_inquiries_expire_pending
  ON doctor_inquiries (expires_at)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION trg_doctor_inquiries_set_meta()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.urgency = 'red_flag' THEN
      NEW.expires_at := now() + interval '24 hours';
    ELSIF NEW.urgency = 'urgent' THEN
      NEW.expires_at := now() + interval '72 hours';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'answered' AND OLD.status <> 'answered' THEN
    NEW.responded_at := COALESCE(NEW.responded_at, now());
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_doctor_inquiries_meta ON doctor_inquiries;
CREATE TRIGGER trg_doctor_inquiries_meta
BEFORE INSERT OR UPDATE ON doctor_inquiries
FOR EACH ROW EXECUTE FUNCTION trg_doctor_inquiries_set_meta();

ALTER TABLE doctor_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY doctor_inquiries_coach_own
ON doctor_inquiries FOR ALL
USING (coach_id = get_my_user_id())
WITH CHECK (coach_id = get_my_user_id());

CREATE POLICY doctor_inquiries_doctor_read
ON doctor_inquiries FOR SELECT
USING (
  doctor_id = get_my_user_id()
  OR (doctor_id IS NULL AND EXISTS (
    SELECT 1 FROM users WHERE id = get_my_user_id() AND role = 'doctor'
  ))
);

CREATE POLICY doctor_inquiries_doctor_update
ON doctor_inquiries FOR UPDATE
USING (
  (doctor_id = get_my_user_id() AND status IN ('pending','answered'))
  OR (doctor_id IS NULL AND EXISTS (
    SELECT 1 FROM users WHERE id = get_my_user_id() AND role = 'doctor'
  ))
)
WITH CHECK (
  doctor_id = get_my_user_id() OR doctor_id IS NULL
);

CREATE POLICY doctor_inquiries_athlete_read
ON doctor_inquiries FOR SELECT
USING (athlete_id = get_my_user_id());

NOTIFY pgrst, 'reload schema';
