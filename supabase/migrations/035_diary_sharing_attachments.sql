-- ──────────────────────────────────────────────────────────────────────────
-- 035_diary_sharing_attachments.sql
-- Две новые возможности для дневника тренера:
--   1. Шэринг записи с атлетом (is_shared_with_athlete). Когда флаг
--      включён, запись видна атлету через отдельную RLS-политику.
--   2. Вложения (attachments: jsonb массив {name, url, type, size}).
-- Applied to prod.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE observation_diary
  ADD COLUMN IF NOT EXISTS is_shared_with_athlete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attachments            jsonb;

CREATE INDEX IF NOT EXISTS idx_obs_diary_athlete_shared
  ON observation_diary(athlete_id, date DESC)
  WHERE is_shared_with_athlete = true AND athlete_id IS NOT NULL;

DROP POLICY IF EXISTS obs_diary_shared_to_athlete ON observation_diary;
CREATE POLICY obs_diary_shared_to_athlete ON observation_diary
  FOR SELECT USING (
    is_shared_with_athlete = true
    AND athlete_id = (SELECT get_my_user_id())
  );

NOTIFY pgrst, 'reload schema';
