-- ──────────────────────────────────────────────────────────────────────────
-- 023_medical_checkups.sql
-- Doctor toolkit: medical checkups linked to athletes.
-- Applied to prod via Supabase migration (project hhyjihbctidtucvpgjzv).
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS medical_checkups (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  athlete_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkup_date      date NOT NULL,
  start_time        time,
  end_time          time,
  checkup_type      varchar(40) NOT NULL DEFAULT 'general'
                     CHECK (checkup_type IN ('general','cardiology','blood','injury','mobility','return_to_sport','nutrition','other')),
  status            varchar(20) NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  location          varchar(160),
  findings          text,
  recommendations   text,
  follow_up_date    date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_med_checkups_doctor_date  ON medical_checkups(doctor_id, checkup_date);
CREATE INDEX IF NOT EXISTS idx_med_checkups_athlete_date ON medical_checkups(athlete_id, checkup_date);

ALTER TABLE medical_checkups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS med_checkups_doctor_all ON medical_checkups;
CREATE POLICY med_checkups_doctor_all ON medical_checkups
  FOR ALL USING (doctor_id = get_my_user_id()) WITH CHECK (doctor_id = get_my_user_id());

DROP POLICY IF EXISTS med_checkups_athlete_select ON medical_checkups;
CREATE POLICY med_checkups_athlete_select ON medical_checkups
  FOR SELECT USING (athlete_id = get_my_user_id());

DROP TRIGGER IF EXISTS trg_med_checkups_updated ON medical_checkups;
CREATE TRIGGER trg_med_checkups_updated BEFORE UPDATE ON medical_checkups
  FOR EACH ROW EXECUTE FUNCTION _touch_updated_at();

NOTIFY pgrst, 'reload schema';
