-- ──────────────────────────────────────────────────────────────────────────
-- 106_p1_security_scopes.sql — шесть дефектов P1 с последствиями для
-- безопасности, найденных ролевым QA (см. qa/ralph/BUG_BACKLOG.md).
--
-- Общий мотив: политики написаны как FOR ALL или без WITH CHECK. USING
-- решает, какие строки ВИДНЫ, а WITH CHECK — какими они станут ПОСЛЕ
-- записи. Когда WITH CHECK отсутствует, Postgres на UPDATE подставляет
-- USING, и получается «вижу строку → могу переписать её во что угодно»,
-- включая перенос сущности в чужую организацию. На DELETE WITH CHECK не
-- применяется вовсе, поэтому «видно» означает «можно удалить».
--
-- Регрессия: qa/ralph/rls-probe.mjs (проверки INQ-01, INJ-01…03, CH-01, GRP-01/02)
-- ──────────────────────────────────────────────────────────────────────────

-- ── 1. doctor_inquiries: тренер спрашивал врача о ЛЮБОМ спортсмене ────────
-- Политика doctor_inquiries_coach_own (FOR ALL) требовала лишь
-- coach_id = get_my_user_id(), то есть «я автор». Принадлежность спортсмена
-- этому тренеру не проверялась: запрос уходил врачам вместе с именем
-- спортсмена и клиническим вопросом.
DROP POLICY IF EXISTS doctor_inquiries_coach_own ON public.doctor_inquiries;

CREATE POLICY doctor_inquiries_coach_select ON public.doctor_inquiries
  FOR SELECT USING (coach_id = public.get_my_user_id());

CREATE POLICY doctor_inquiries_coach_update ON public.doctor_inquiries
  FOR UPDATE USING (coach_id = public.get_my_user_id())
  WITH CHECK (coach_id = public.get_my_user_id());

CREATE POLICY doctor_inquiries_coach_delete ON public.doctor_inquiries
  FOR DELETE USING (coach_id = public.get_my_user_id());

CREATE POLICY doctor_inquiries_coach_insert ON public.doctor_inquiries
  FOR INSERT
  WITH CHECK (
    coach_id = public.get_my_user_id()
    AND EXISTS (
      SELECT 1 FROM public.trainer_athletes ta
      WHERE ta.trainer_id = public.get_my_user_id()
        AND ta.athlete_id = doctor_inquiries.athlete_id
        AND ta.status = 'accepted'
    )
  );

-- ── 2. injuries: тренер удалял и присваивал записи врача ──────────────────
-- injuries_coach_rw и injuries_doctor_rw объявлены FOR ALL. USING проверяет
-- только наличие связи со спортсменом, значит:
--   • DELETE (где WITH CHECK не действует) позволял тренеру стереть запись,
--     внесённую врачом, и наоборот;
--   • UPDATE проходил, если переписать reported_by на себя — то есть
--     присвоить чужую запись.
-- Разделяем по командам: читать — по связи, менять и удалять — только своё.
DROP POLICY IF EXISTS injuries_coach_rw ON public.injuries;
DROP POLICY IF EXISTS injuries_doctor_rw ON public.injuries;

CREATE POLICY injuries_coach_select ON public.injuries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.trainer_athletes ta
      WHERE ta.trainer_id = public.get_my_user_id()
        AND ta.athlete_id = injuries.athlete_id
        AND ta.status = 'accepted'
    )
  );

CREATE POLICY injuries_coach_insert ON public.injuries
  FOR INSERT WITH CHECK (
    reported_by = public.get_my_user_id()
    AND EXISTS (
      SELECT 1 FROM public.trainer_athletes ta
      WHERE ta.trainer_id = public.get_my_user_id()
        AND ta.athlete_id = injuries.athlete_id
        AND ta.status = 'accepted'
    )
  );

CREATE POLICY injuries_coach_update ON public.injuries
  FOR UPDATE USING (reported_by = public.get_my_user_id())
  WITH CHECK (reported_by = public.get_my_user_id());

CREATE POLICY injuries_coach_delete ON public.injuries
  FOR DELETE USING (reported_by = public.get_my_user_id());

CREATE POLICY injuries_doctor_select ON public.injuries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.connection_type = 'doctor_athlete' AND c.status = 'active'
        AND ((c.initiator_id = public.get_my_user_id() AND c.recipient_id = injuries.athlete_id)
          OR (c.recipient_id = public.get_my_user_id() AND c.initiator_id = injuries.athlete_id))
    )
  );

CREATE POLICY injuries_doctor_insert ON public.injuries
  FOR INSERT WITH CHECK (
    reported_by = public.get_my_user_id()
    AND EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.connection_type = 'doctor_athlete' AND c.status = 'active'
        AND ((c.initiator_id = public.get_my_user_id() AND c.recipient_id = injuries.athlete_id)
          OR (c.recipient_id = public.get_my_user_id() AND c.initiator_id = injuries.athlete_id))
    )
  );

-- UPDATE/DELETE врача покрыты политиками injuries_coach_update /
-- injuries_coach_delete: они не про роль, а про авторство (reported_by),
-- и одинаково защищают записи обеих сторон.

-- ── 3. channel_posts: автор переносил свой пост в чужой канал ─────────────
-- У channel_posts_update не было WITH CHECK, поэтому UPDATE мог сменить
-- channel_id на канал другого клуба (в том числе тренерский) и закрепить
-- там запись. Проверяем НОВЫЙ channel_id тем же предикатом, что и вставку.
DROP POLICY IF EXISTS channel_posts_update ON public.channel_posts;

CREATE POLICY channel_posts_update ON public.channel_posts
  FOR UPDATE
  USING (
    author_id = (SELECT public.get_my_user_id())
    OR public.is_channel_moderator(channel_id)
  )
  WITH CHECK (
    (author_id = (SELECT public.get_my_user_id()) OR public.is_channel_moderator(channel_id))
    AND public.can_post_channel(channel_id)
  );

-- ── 4. channels: модератор переназначал канал в другую организацию ────────
-- WITH CHECK здесь не спасает: is_channel_moderator(id) проверяет тот же
-- самый канал, а меняется org_id. Нужен запрет на изменение колонок
-- принадлежности — как в миграции 104.
CREATE OR REPLACE FUNCTION public.guard_channel_immutable_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_jwt_role text;
BEGIN
  v_jwt_role := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  IF v_jwt_role IS NULL OR v_jwt_role NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'Перенос канала в другую организацию запрещён' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_channel_immutable_columns ON public.channels;
CREATE TRIGGER trg_guard_channel_immutable_columns
  BEFORE UPDATE ON public.channels
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_channel_immutable_columns();

-- ── 5. org_groups: главный тренер переносил команду в чужой клуб ──────────
-- org_groups_head_coach_update проверял только head_coach_id = я, ничего не
-- говоря об organization_id. Требуем, чтобы новая организация была той, где
-- пользователь реально состоит.
DROP POLICY IF EXISTS org_groups_head_coach_update ON public.org_groups;

CREATE POLICY org_groups_head_coach_update ON public.org_groups
  FOR UPDATE
  USING (head_coach_id = (SELECT public.get_my_user_id()))
  WITH CHECK (
    head_coach_id = (SELECT public.get_my_user_id())
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_groups.organization_id
        AND om.user_id = (SELECT public.get_my_user_id())
        AND om.status = 'active'
    )
  );

-- ── 6. org_group_members: в команду добавляли чужого спортсмена ───────────
-- Политика проверяла только права вызывающего на группу, но не то, состоит
-- ли добавляемый спортсмен в этой организации. Админ клуба мог втянуть в
-- свою команду спортсмена другого клуба и получить доступ к его данным
-- через командные представления.
DROP POLICY IF EXISTS org_group_members_admin_write ON public.org_group_members;

CREATE POLICY org_group_members_admin_write ON public.org_group_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.org_groups og
      JOIN public.org_members om ON om.org_id = og.organization_id
      WHERE og.id = org_group_members.group_id
        AND om.user_id = (SELECT public.get_my_user_id())
        AND om.status = 'active'
        AND om.member_role = ANY (ARRAY['org_owner', 'org_admin'])
    )
    OR EXISTS (
      SELECT 1 FROM public.org_groups og
      WHERE og.id = org_group_members.group_id
        AND og.head_coach_id = (SELECT public.get_my_user_id())
    )
  )
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM public.org_groups og
        JOIN public.org_members om ON om.org_id = og.organization_id
        WHERE og.id = org_group_members.group_id
          AND om.user_id = (SELECT public.get_my_user_id())
          AND om.status = 'active'
          AND om.member_role = ANY (ARRAY['org_owner', 'org_admin'])
      )
      OR EXISTS (
        SELECT 1 FROM public.org_groups og
        WHERE og.id = org_group_members.group_id
          AND og.head_coach_id = (SELECT public.get_my_user_id())
      )
    )
    -- Спортсмен обязан состоять в той же организации, что и команда.
    AND EXISTS (
      SELECT 1 FROM public.org_groups og
      JOIN public.org_members om_a ON om_a.org_id = og.organization_id
      WHERE og.id = org_group_members.group_id
        AND om_a.user_id = org_group_members.athlete_id
        AND om_a.status = 'active'
    )
  );

NOTIFY pgrst, 'reload schema';
