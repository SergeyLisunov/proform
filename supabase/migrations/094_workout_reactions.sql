-- 094 — workout_reactions: «респект» к тренировке (P1 соц-ядро, лента клуба).
--
-- Стратегия ролей 2026-07: тренировка в дневнике = пост в закрытой ленте
-- клуба; реакция («респект») от тренера, одноклубников, родителя — базовая
-- социальная валидация усилия (Strava-модель kudos, реакция тренера =
-- главный сигнал для юного атлета).
--
-- Дизайн:
--   * один вид реакции 'respect' (CHECK) — расширение видов позже без
--     смены схемы;
--   * UNIQUE(workout_id, user_id) — один респект от человека на тренировку,
--     toggle = INSERT/DELETE;
--   * предикат «может взаимодействовать с тренировкой» един для SELECT и
--     INSERT: владелец, его тренер (accepted), его родитель (is_parent_of),
--     одноклубник (общая активная организация). Никаких публичных реакций —
--     лента закрытая (policy child-privacy-defaults, принцип 3-4).
--   * Счётчики популярности НЕ публичны: RLS не даёт читать реакции вне
--     клуба/care team.

CREATE TABLE public.workout_reactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  kind       text NOT NULL DEFAULT 'respect' CHECK (kind IN ('respect')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workout_id, user_id)
);

CREATE INDEX workout_reactions_workout_idx ON public.workout_reactions (workout_id);
CREATE INDEX workout_reactions_user_idx    ON public.workout_reactions (user_id);

ALTER TABLE public.workout_reactions ENABLE ROW LEVEL SECURITY;

-- Единый engage-предикат (inline в обеих политиках):
--   владелец тренировки / тренер / родитель / одноклубник.

CREATE POLICY workout_reactions_select ON public.workout_reactions
FOR SELECT USING (
  user_id = get_my_user_id()
  OR EXISTS (
       SELECT 1 FROM public.workouts w
       WHERE w.id = workout_id AND w.athlete_id = get_my_user_id())
  OR EXISTS (
       SELECT 1 FROM public.workouts w
       JOIN public.trainer_athletes ta
         ON ta.athlete_id = w.athlete_id AND ta.status = 'accepted'
       WHERE w.id = workout_id AND ta.trainer_id = get_my_user_id())
  OR EXISTS (
       SELECT 1 FROM public.workouts w
       WHERE w.id = workout_id AND is_parent_of(get_my_user_id(), w.athlete_id))
  OR EXISTS (
       SELECT 1 FROM public.workouts w
       JOIN public.org_members om_me
         ON om_me.user_id = get_my_user_id() AND om_me.status = 'active'
       JOIN public.org_members om_owner
         ON om_owner.org_id = om_me.org_id
        AND om_owner.user_id = w.athlete_id
        AND om_owner.status = 'active'
       WHERE w.id = workout_id)
);

CREATE POLICY workout_reactions_insert ON public.workout_reactions
FOR INSERT WITH CHECK (
  user_id = get_my_user_id()
  AND (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_id AND w.athlete_id = get_my_user_id())
    OR EXISTS (
      SELECT 1 FROM public.workouts w
      JOIN public.trainer_athletes ta
        ON ta.athlete_id = w.athlete_id AND ta.status = 'accepted'
      WHERE w.id = workout_id AND ta.trainer_id = get_my_user_id())
    OR EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_id AND is_parent_of(get_my_user_id(), w.athlete_id))
    OR EXISTS (
      SELECT 1 FROM public.workouts w
      JOIN public.org_members om_me
        ON om_me.user_id = get_my_user_id() AND om_me.status = 'active'
      JOIN public.org_members om_owner
        ON om_owner.org_id = om_me.org_id
       AND om_owner.user_id = w.athlete_id
       AND om_owner.status = 'active'
      WHERE w.id = workout_id)
  )
);

CREATE POLICY workout_reactions_delete ON public.workout_reactions
FOR DELETE USING (user_id = get_my_user_id());

NOTIFY pgrst, 'reload schema';
