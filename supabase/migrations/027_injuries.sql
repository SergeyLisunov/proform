-- ──────────────────────────────────────────────────────────────────────────
-- 027_injuries.sql
-- Lightweight injury log for athletes. Coach and doctor connected to the
-- athlete can read and write too (e.g. coach logs a strain reported in
-- training; doctor updates status as rehab progresses).
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS injuries (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_by             uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  onset_date              date NOT NULL,
  body_part               varchar(60) NOT NULL,
  side                    varchar(10) NOT NULL DEFAULT 'n/a'
                           CHECK (side IN ('left','right','both','n/a')),
  severity                varchar(20) NOT NULL DEFAULT 'moderate'
                           CHECK (severity IN ('minor','moderate','severe')),
  mechanism               varchar(20) NOT NULL DEFAULT 'unknown'
                           CHECK (mechanism IN ('acute','overuse','contact','unknown')),
  status                  varchar(20) NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','recovering','recovered')),
  description             text,
  expected_recovery_days  int,
  recovered_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_injuries_athlete_status ON injuries(athlete_id, status);
CREATE INDEX IF NOT EXISTS idx_injuries_athlete_onset  ON injuries(athlete_id, onset_date DESC);

ALTER TABLE injuries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS injuries_athlete_all ON injuries;
CREATE POLICY injuries_athlete_all ON injuries
  FOR ALL USING (athlete_id = get_my_user_id())
           WITH CHECK (athlete_id = get_my_user_id());

DROP POLICY IF EXISTS injuries_coach_rw ON injuries;
CREATE POLICY injuries_coach_rw ON injuries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM trainer_athletes ta
       WHERE ta.trainer_id = get_my_user_id()
         AND ta.athlete_id = injuries.athlete_id
         AND ta.status = 'accepted'
    )
  ) WITH CHECK (
    reported_by = get_my_user_id()
    AND EXISTS (
      SELECT 1 FROM trainer_athletes ta
       WHERE ta.trainer_id = get_my_user_id()
         AND ta.athlete_id = injuries.athlete_id
         AND ta.status = 'accepted'
    )
  );

DROP POLICY IF EXISTS injuries_doctor_rw ON injuries;
CREATE POLICY injuries_doctor_rw ON injuries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM connections c
       WHERE c.connection_type = 'doctor_athlete'
         AND c.status = 'active'
         AND ((c.initiator_id = get_my_user_id() AND c.recipient_id = injuries.athlete_id)
           OR (c.recipient_id = get_my_user_id() AND c.initiator_id = injuries.athlete_id))
    )
  ) WITH CHECK (
    reported_by = get_my_user_id()
    AND EXISTS (
      SELECT 1 FROM connections c
       WHERE c.connection_type = 'doctor_athlete'
         AND c.status = 'active'
         AND ((c.initiator_id = get_my_user_id() AND c.recipient_id = injuries.athlete_id)
           OR (c.recipient_id = get_my_user_id() AND c.initiator_id = injuries.athlete_id))
    )
  );

CREATE OR REPLACE FUNCTION trg_injuries_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_injuries_updated_at ON injuries;
CREATE TRIGGER trg_injuries_updated_at BEFORE UPDATE ON injuries
  FOR EACH ROW EXECUTE FUNCTION trg_injuries_updated_at();

NOTIFY pgrst, 'reload schema';
