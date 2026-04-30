-- ──────────────────────────────────────────────────────────────────────────
-- 048_medical_diary_coach_visibility.sql
-- Sprint Week 1, Day 1 — закрыть разрыв Doctor → Coach.
--
-- До этой миграции врач/специалист (medical_specialization: physio,
-- massage, nutrition, psychiatry...) мог пометить запись в
-- medical_diary как is_shared_with_athlete, но НЕ существовало
-- канала, чтобы передать ограничение тренеру атлета. В результате
-- coach не видел "no jumping 2 weeks" от врача и продолжал назначать
-- прыжковую нагрузку. Это критический разрыв в core flow клуб-врач.
--
-- Эта миграция:
--   1. Добавляет boolean is_shared_with_coach в medical_diary
--   2. Создаёт RLS-политику: coach может SELECT записи где
--      is_shared_with_coach=true И coach ↔ athlete есть active link
--      в trainer_athletes (status='accepted').
--
-- Specialty subtype уже de-facto существует в doctor_profiles через
-- medical_specialization (physio/nutrition/psychiatry/orthopedics/etc).
-- Эта миграция НЕ трогает users.specialty — UI расширяется отдельно
-- в RoleProfile.tsx (добавляется значение 'massage' в options).
--
-- После применения: NOTIFY pgrst, 'reload schema'; (см. в конце).
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Add is_shared_with_coach column (default false — backwards compatible).
ALTER TABLE medical_diary
  ADD COLUMN IF NOT EXISTS is_shared_with_coach boolean NOT NULL DEFAULT false;

-- 2. Index for efficient coach-side query (coach typically scans recent
-- shared entries across all his athletes).
CREATE INDEX IF NOT EXISTS idx_medical_diary_athlete_shared_coach
  ON medical_diary(athlete_id, date DESC)
  WHERE is_shared_with_coach = true AND athlete_id IS NOT NULL;

-- 3. RLS: coach can SELECT shared entries for athletes they are linked to.
-- Pattern matches existing trainer_athletes RLS in 026_prescribed_workouts
-- and 027_injuries.
DROP POLICY IF EXISTS medical_diary_coach_shared ON medical_diary;
CREATE POLICY medical_diary_coach_shared ON medical_diary
  FOR SELECT USING (
    is_shared_with_coach = true
    AND athlete_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM trainer_athletes ta
       WHERE ta.trainer_id = (SELECT get_my_user_id())
         AND ta.athlete_id = medical_diary.athlete_id
         AND ta.status = 'accepted'
    )
  );

-- 4. Reload PostgREST so the new column is exposed via REST.
NOTIFY pgrst, 'reload schema';
