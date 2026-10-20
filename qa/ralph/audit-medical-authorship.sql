-- ──────────────────────────────────────────────────────────────────────────
-- Аудит медзаписей, которые могли быть подделаны до миграции 114.
-- ТОЛЬКО ЧТЕНИЕ. Запускать в SQL-редакторе Supabase.
--
-- До 114 осмотр (medical_checkups) и запись медицинского дневника
-- (medical_diary) мог создать о любом спортсмене любой вошедший
-- пользователь; рекомендацию (recommendations) до 114 мог выписать пациент
-- своему врачу. 114 проверяет только новые записи — уже созданные остаются
-- видны спортсмену и его тренерам. Запрос показывает подозрительные строки.
-- Что с ними делать — решение человека, запрос ничего не меняет.
--
-- Подозрительна запись, если:
--   • автор (doctor_id) — не врач;
--   • адресат (athlete_id) — не спортсмен;
--   • между автором и адресатом НИКОГДА не было связи doctor_athlete — ни
--     активной, ни разорванной.
--
-- В выводе только идентификаторы, роли и даты — без текста записей.
-- ──────────────────────────────────────────────────────────────────────────

WITH rows_to_check AS (
  SELECT 'medical_checkups' AS source, id, doctor_id, athlete_id, created_at FROM public.medical_checkups
  UNION ALL
  SELECT 'medical_diary', id, doctor_id, athlete_id, created_at FROM public.medical_diary
   WHERE athlete_id IS NOT NULL
  UNION ALL
  SELECT 'recommendations', id, doctor_id, athlete_id, created_at FROM public.recommendations
),
checked AS (
  SELECT
    r.*,
    ud.role AS author_role,
    ua.role AS athlete_role,
    EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.connection_type = 'doctor_athlete'
        AND ((c.initiator_id = r.doctor_id AND c.recipient_id = r.athlete_id)
          OR (c.initiator_id = r.athlete_id AND c.recipient_id = r.doctor_id))
    ) AS ever_linked
  FROM rows_to_check r
  LEFT JOIN public.users ud ON ud.id = r.doctor_id
  LEFT JOIN public.users ua ON ua.id = r.athlete_id
)
SELECT
  source, id, doctor_id, author_role, athlete_id, athlete_role, created_at,
  concat_ws('; ',
    CASE WHEN author_role IS DISTINCT FROM 'doctor'  THEN 'автор не врач' END,
    CASE WHEN athlete_role IS DISTINCT FROM 'athlete' THEN 'адресат не спортсмен' END,
    CASE WHEN NOT ever_linked THEN 'связи врач — пациент не было никогда' END
  ) AS reason
FROM checked
WHERE author_role IS DISTINCT FROM 'doctor'
   OR athlete_role IS DISTINCT FROM 'athlete'
   OR NOT ever_linked
ORDER BY source, created_at;
