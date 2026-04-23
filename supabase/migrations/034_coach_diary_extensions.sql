-- ──────────────────────────────────────────────────────────────────────────
-- 034_coach_diary_extensions.sql
-- Turn observation_diary into a richer coach journal with 5 entry kinds:
--   * observation       — текущая "Дневник наблюдений" запись
--   * session_summary   — разбор проведённой тренировки
--   * competition_report — отчёт о соревновании
--   * schedule          — планирование занятия; автоматически создаёт
--                         calendar_events и линкуется через calendar_event_id
--   * plan              — долгосрочный план/задача
-- Также добавляем эмоциональное состояние атлета (mood 1–5),
-- уровень энергии (1–10) и структурированные data-поля.
-- Applied to prod.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE observation_diary
  ADD COLUMN IF NOT EXISTS entry_type        varchar(24) NOT NULL DEFAULT 'observation'
                           CHECK (entry_type IN (
                             'observation','session_summary','competition_report','schedule','plan'
                           )),
  ADD COLUMN IF NOT EXISTS mood              smallint CHECK (mood IS NULL OR mood BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS energy_level      smallint CHECK (energy_level IS NULL OR energy_level BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS session_data      jsonb,
  ADD COLUMN IF NOT EXISTS competition_data  jsonb,
  ADD COLUMN IF NOT EXISTS schedule_data     jsonb,
  ADD COLUMN IF NOT EXISTS calendar_event_id uuid REFERENCES calendar_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_observation_diary_coach_date_type
  ON observation_diary(coach_id, date DESC, entry_type);
CREATE INDEX IF NOT EXISTS idx_observation_diary_calendar_event
  ON observation_diary(calendar_event_id) WHERE calendar_event_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
