-- ──────────────────────────────────────────────────────────────────────────
-- 102_fix_event_type_checks.sql — CHECK-констрейнты отставали от кода.
--
-- Найдено живым ролевым смоуком (QA-сеть падала на вставках):
--
-- 1. workouts.event_type разрешал только ('workout','competition'), а код
--    пишет 'prescribed' в ДВУХ местах — services/prescribed-workouts
--    (тренер назначает тренировку) и services/workout-plans (назначение
--    плана целиком). Обе операции молча падали в проде (supabase-js не
--    бросает, ошибка уходила в console.warn) → в базе 70 тренировок и
--    НИ ОДНОЙ prescribed. Мертва была вся ветка «назначенные тренировки»:
--    план недели атлета, стрик с мед-заморозкой, adherence-nudge,
--    уведомления тренеру о выполнении, prescribed-контекст AI-ассистента.
--
-- 2. calendar_events.event_type не знал 'medical_appointment' (создаётся
--    из медицинского дневника врача) и 'coach_plan' (из дневника тренера)
--    — те же молчаливые отказы при авто-создании событий календаря.
--
-- Изменение аддитивное: существующие значения остаются валидными.
-- Applied to prod.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.workouts DROP CONSTRAINT IF EXISTS workouts_event_type_check;
ALTER TABLE public.workouts ADD CONSTRAINT workouts_event_type_check
  CHECK (event_type = ANY (ARRAY['workout'::text, 'competition'::text, 'prescribed'::text]));

ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_event_type_check;
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'workout'::text, 'competition'::text, 'rest'::text, 'note'::text,
    'travel'::text, 'medical'::text, 'test'::text, 'camp'::text, 'other'::text,
    'medical_appointment'::text, 'coach_plan'::text
  ]));

NOTIFY pgrst, 'reload schema';
