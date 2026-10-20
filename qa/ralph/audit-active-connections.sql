-- ──────────────────────────────────────────────────────────────────────────
-- Аудит активных связей, которые могли появиться в обход согласия.
-- ТОЛЬКО ЧТЕНИЕ. Запускать в SQL-редакторе Supabase после миграции 115.
--
-- Триггер 115 проверяет только новые и изменённые строки. Активная связь,
-- подделанная прямым запросом в PostgREST до него, осталась бы в базе и
-- продолжала бы давать доступ: врачу — к записи медданных (105, 114),
-- тренеру — к trainer_athletes (085). Запрос показывает подозрительные
-- строки. Что с ними делать (разорвать или оставить) — решение человека,
-- запрос ничего не меняет.
--
-- В выводе только идентификаторы и роли — без имён и почты.
-- ──────────────────────────────────────────────────────────────────────────

WITH combos(connection_type, r1, r2) AS (
  VALUES
    ('coach_athlete',  'coach',        'athlete'),
    ('org_coach',      'organization', 'coach'),
    ('org_athlete',    'organization', 'athlete'),
    ('doctor_athlete', 'doctor',       'athlete'),
    ('coach_doctor',   'coach',        'doctor'),
    ('org_doctor',     'organization', 'doctor'),
    ('admin_doctor',   'admin',        'doctor')
)
SELECT
  c.id,
  c.connection_type,
  c.initiator_id,
  ui.role AS initiator_role,
  c.recipient_id,
  ur.role AS recipient_role,
  c.initiated_at,
  c.responded_at,
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM combos k
      WHERE k.connection_type = c.connection_type
        AND ((ui.role = k.r1 AND ur.role = k.r2) OR (ui.role = k.r2 AND ur.role = k.r1))
    ) THEN 'роли не подходят к типу связи'
    -- Принятие (PATCH /api/connections/[id]), приглашение и назначение
    -- клубом всегда ставят responded_at. Активная связь без него не прошла
    -- ни через один из этих путей.
    WHEN c.responded_at IS NULL THEN 'активна без ответа получателя'
  END AS reason
FROM public.connections c
JOIN public.users ui ON ui.id = c.initiator_id
JOIN public.users ur ON ur.id = c.recipient_id
WHERE c.status = 'active'
  AND (
    c.responded_at IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM combos k
      WHERE k.connection_type = c.connection_type
        AND ((ui.role = k.r1 AND ur.role = k.r2) OR (ui.role = k.r2 AND ur.role = k.r1))
    )
  )
ORDER BY c.connection_type, c.initiated_at;

-- Связи QA-фикстур (qa/ralph/seed.sql) создаются сразу активными без
-- responded_at и попадут в вывод — это ожидаемо.
