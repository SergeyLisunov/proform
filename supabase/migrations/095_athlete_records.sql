-- 095 — athlete_records: личные рекорды (P1 соц-ядро).
--
-- Стратегия ролей 2026-07: авто-детект ЛР из данных дневника + празднование.
-- Mastery-ориентация (соревнование с собой) — научно самый безопасный
-- мотиватор для детей (в отличие от ego-рейтингов «кто кого обогнал»).
--
-- Дизайн: храним ТЕКУЩИЙ рекорд per (athlete, kind) — UPSERT при побитии.
-- Детект — app-side в момент записи тренировки (services/personal-records).
--
-- Виды (из честно имеющихся данных дневника):
--   longest_workout      — самая длинная тренировка, мин
--   best_week_volume     — лучший недельный объём, мин (ISO-неделя)
--   training_streak_days — серия дней с тренировками подряд

CREATE TABLE public.athlete_records (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN
                ('longest_workout','best_week_volume','training_streak_days')),
  value       numeric NOT NULL CHECK (value > 0),
  workout_id  uuid REFERENCES public.workouts(id) ON DELETE SET NULL,
  achieved_on date NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, kind)
);

CREATE INDEX athlete_records_athlete_idx ON public.athlete_records (athlete_id);

ALTER TABLE public.athlete_records ENABLE ROW LEVEL SECURITY;

-- Читают: сам атлет, его тренер, его родитель. Пишет — только сам атлет
-- (детект выполняется в его клиенте после его же тренировки).
CREATE POLICY athlete_records_select ON public.athlete_records
FOR SELECT USING (
  athlete_id = get_my_user_id()
  OR EXISTS (
       SELECT 1 FROM public.trainer_athletes ta
       WHERE ta.athlete_id = athlete_records.athlete_id
         AND ta.trainer_id = get_my_user_id()
         AND ta.status = 'accepted')
  OR is_parent_of(get_my_user_id(), athlete_id)
);

CREATE POLICY athlete_records_insert ON public.athlete_records
FOR INSERT WITH CHECK (athlete_id = get_my_user_id());

CREATE POLICY athlete_records_update ON public.athlete_records
FOR UPDATE USING (athlete_id = get_my_user_id())
WITH CHECK (athlete_id = get_my_user_id());

NOTIFY pgrst, 'reload schema';
