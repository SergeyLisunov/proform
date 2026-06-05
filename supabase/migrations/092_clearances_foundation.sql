-- 092_clearances_foundation — tenant refactor #светофор-1 (P3 moat).
--
-- Дискретный канал «допуск к нагрузке» от доктора к тренеру. Тренер видит
-- состояние (можно / частично / нельзя), но НЕ диагноз. Привязано к атлету
-- как «текущий допуск».
--
-- Принятые решения (05.06.2026, docs/policy/clearance-traffic-light-design.md):
--   * 4 состояния: full / limited / light_only / banned
--   * append-only journal (каждое изменение = новая строка; current = LATEST)
--   * valid_until обязателен для не-full состояний (default 30 дней; делает UI,
--     не CHECK, т.к. doctor может явно задать другую длительность)
--   * после истечения valid_until — view возвращает review_needed=true
--   * RLS: athlete видит свой, doctor видит/пишет для connected athletes,
--     coach видит через trainer_athletes (#085), parent через parent_links (#089)

CREATE TABLE IF NOT EXISTS public.clearances (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id  uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  doctor_id   uuid        NOT NULL REFERENCES public.users(id),
  status      text        NOT NULL CHECK (status IN ('full', 'limited', 'light_only', 'banned')),
  note        text,
  valid_from  timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clearances_athlete_latest ON public.clearances(athlete_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clearances_doctor         ON public.clearances(doctor_id);

ALTER TABLE public.clearances ENABLE ROW LEVEL SECURITY;

CREATE POLICY clearances_athlete_select ON public.clearances
  FOR SELECT TO public
  USING (athlete_id = (SELECT public.get_my_user_id()));

CREATE POLICY clearances_doctor_select ON public.clearances
  FOR SELECT TO public
  USING (
    doctor_id = (SELECT public.get_my_user_id())
    OR EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.connection_type = 'doctor_athlete'
        AND c.status = 'active'
        AND ((c.initiator_id = (SELECT public.get_my_user_id()) AND c.recipient_id = public.clearances.athlete_id)
          OR (c.recipient_id = (SELECT public.get_my_user_id()) AND c.initiator_id = public.clearances.athlete_id))
    )
  );

CREATE POLICY clearances_doctor_insert ON public.clearances
  FOR INSERT TO public
  WITH CHECK (
    doctor_id = (SELECT public.get_my_user_id())
    AND public.get_my_role() = 'doctor'
    AND EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.connection_type = 'doctor_athlete'
        AND c.status = 'active'
        AND ((c.initiator_id = (SELECT public.get_my_user_id()) AND c.recipient_id = public.clearances.athlete_id)
          OR (c.recipient_id = (SELECT public.get_my_user_id()) AND c.initiator_id = public.clearances.athlete_id))
    )
  );

CREATE POLICY clearances_coach_select ON public.clearances
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.trainer_athletes ta
      WHERE ta.trainer_id = (SELECT public.get_my_user_id())
        AND ta.athlete_id = public.clearances.athlete_id
        AND ta.status = 'accepted'
    )
  );

CREATE POLICY clearances_parent_select ON public.clearances
  FOR SELECT TO public
  USING (public.is_parent_of((SELECT public.get_my_user_id()), public.clearances.athlete_id));

CREATE POLICY clearances_admin_all ON public.clearances
  FOR ALL TO public
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- View: LATEST clearance per athlete + derived `review_needed` flag.
-- security_invoker=true → inherits RLS from clearances table.
CREATE OR REPLACE VIEW public.current_clearances WITH (security_invoker = true) AS
  SELECT DISTINCT ON (athlete_id)
    id,
    athlete_id,
    doctor_id,
    status,
    note,
    valid_from,
    valid_until,
    created_at,
    CASE
      WHEN status = 'full'                                          THEN false
      WHEN valid_until IS NOT NULL AND valid_until <= now()         THEN true
      ELSE false
    END AS review_needed
  FROM public.clearances
  ORDER BY athlete_id, created_at DESC;

NOTIFY pgrst, 'reload schema';
