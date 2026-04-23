-- ──────────────────────────────────────────────────────────────────────────
-- 036_medical_diary.sql
-- Отдельный медицинский журнал для роли doctor. Специфичные типы
-- записей (консультация, прогресс реабилитации, рецепт, анализы,
-- план питания, запись о травме, свободное наблюдение, плановый
-- приём — с автосинком в календарь), а также медицинские поля:
-- severity, body_part, pain_level (0–10), витальные показатели
-- (vitals jsonb: BP/HR/temp/SpO2/weight), рецепт (prescription_data),
-- лабораторные (lab_data), реабилитация (rehab_data).
--
-- Данные намеренно в отдельной таблице от observation_diary:
-- разные домены (медицинское наблюдение vs тренерское), разные роли
-- и RLS, разные жизненные циклы.
-- Applied to prod.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS medical_diary (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  athlete_id              uuid REFERENCES users(id) ON DELETE SET NULL,
  date                    date NOT NULL,
  entry_type              varchar(24) NOT NULL DEFAULT 'observation'
                           CHECK (entry_type IN (
                             'consultation','rehab_progress','prescription',
                             'lab_results','nutrition_plan','injury_note',
                             'observation','schedule'
                           )),
  title                   text,
  note                    text NOT NULL,
  tags                    text[],
  severity                varchar(20) CHECK (severity IS NULL OR severity IN ('low','moderate','high','critical')),
  body_part               varchar(60),
  mood                    smallint CHECK (mood IS NULL OR mood BETWEEN 1 AND 5),
  pain_level              smallint CHECK (pain_level IS NULL OR pain_level BETWEEN 0 AND 10),
  vitals                  jsonb,
  prescription_data       jsonb,
  lab_data                jsonb,
  rehab_data              jsonb,
  schedule_data           jsonb,
  attachments             jsonb,
  is_shared_with_athlete  boolean NOT NULL DEFAULT false,
  calendar_event_id       uuid REFERENCES calendar_events(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_medical_diary_doctor_date
  ON medical_diary(doctor_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_medical_diary_athlete_date
  ON medical_diary(athlete_id, date DESC) WHERE athlete_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_medical_diary_athlete_shared
  ON medical_diary(athlete_id, date DESC)
  WHERE is_shared_with_athlete = true AND athlete_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_medical_diary_calendar_event
  ON medical_diary(calendar_event_id) WHERE calendar_event_id IS NOT NULL;

ALTER TABLE medical_diary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medical_diary_doctor_all ON medical_diary;
CREATE POLICY medical_diary_doctor_all ON medical_diary
  FOR ALL USING (doctor_id = (SELECT get_my_user_id()))
           WITH CHECK (doctor_id = (SELECT get_my_user_id()));

DROP POLICY IF EXISTS medical_diary_athlete_shared ON medical_diary;
CREATE POLICY medical_diary_athlete_shared ON medical_diary
  FOR SELECT USING (
    is_shared_with_athlete = true
    AND athlete_id = (SELECT get_my_user_id())
  );

CREATE OR REPLACE FUNCTION trg_medical_diary_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_medical_diary_updated_at ON medical_diary;
CREATE TRIGGER trg_medical_diary_updated_at BEFORE UPDATE ON medical_diary
  FOR EACH ROW EXECUTE FUNCTION trg_medical_diary_updated_at();

NOTIFY pgrst, 'reload schema';
