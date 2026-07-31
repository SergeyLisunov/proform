-- ──────────────────────────────────────────────────────────────────────────
-- 105_p0_signup_role_and_medical_scope.sql
--
-- Два P0, найденных ролевым QA (Ralph-итерации 3–4).
--
-- ── P0-A. Саморегистрация в роли администратора платформы ─────────────────
-- Триггер handle_new_auth_user берёт роль из raw_user_meta_data — это
-- КЛИЕНТСКИЕ данные (supabase.auth.signUp({ options: { data } })), и его
-- allowlist содержал 'admin'. Значит любой, кто вызовет публичный
-- /auth/v1/signup с {"role":"admin"} (anon-ключ публичен по определению),
-- получал роль admin: чтение всех пользователей, доступ к /admin и
-- внутренней CRM, полный доступ к составу любой организации.
-- Воспроизведено на живой базе (INSERT в auth.users с role=admin в
-- метаданных → public.users.role='admin'), транзакция откачена.
--
-- Правка: привилегированные роли нельзя назначить себе при регистрации.
-- Самостоятельно доступны только продуктовые роли; всё остальное
-- приземляется в 'athlete'. Роль admin выдаётся только существующим
-- админом через /api/admin/users/role (с записью в audit_logs).
-- Легаси-значение 'trainer' нормализуется в 'coach' — оно не покрыто
-- типами TS и раньше создавало пользователей, невидимых для ролевых
-- фильтров интерфейса.
--
-- ── P0-B. Рекомендация врача любому спортсмену платформы ──────────────────
-- POST /api/recommendations проверял только роль автора ('doctor'), а
-- athlete_id брал из тела запроса. RLS-политика recommendations_doctor_all
-- (миграция 052) тоже не требовала связи. Итог: врач одного клуба заводил
-- медицинскую рекомендацию спортсмену другого клуба — запись с
-- клиническим текстом появлялась у чужого спортсмена и его тренера.
--
-- Правка: INSERT в recommendations требует активной связи врач↔пациент
-- (connections.connection_type='doctor_athlete', status='active').
-- Серверная проверка добавлена параллельно в app/api/recommendations/route.ts —
-- БД остаётся последним рубежом.
--
-- Регрессия: qa/ralph/rls-probe.mjs (проверки SIGNUP-01, MED-07)
-- ──────────────────────────────────────────────────────────────────────────

-- ── P0-A ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role        TEXT;
  v_new_user_id uuid;
  v_email_lower text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'athlete');

  -- Легаси-синоним
  IF v_role = 'trainer' THEN
    v_role := 'coach';
  END IF;

  -- P0: 'admin' НЕ входит в список — привилегию нельзя выдать себе самому
  -- при регистрации. Всё непредусмотренное становится обычным спортсменом.
  IF v_role NOT IN ('coach', 'athlete', 'organization', 'doctor', 'specialist') THEN
    v_role := 'athlete';
  END IF;

  INSERT INTO public.users (
    auth_id, email, name, role,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    signup_referrer
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    v_role,
    NULLIF(NEW.raw_user_meta_data->>'utm_source',   ''),
    NULLIF(NEW.raw_user_meta_data->>'utm_medium',   ''),
    NULLIF(NEW.raw_user_meta_data->>'utm_campaign', ''),
    NULLIF(NEW.raw_user_meta_data->>'utm_content',  ''),
    NULLIF(NEW.raw_user_meta_data->>'utm_term',     ''),
    NULLIF(NEW.raw_user_meta_data->>'signup_referrer', '')
  )
  ON CONFLICT (auth_id) DO NOTHING
  RETURNING id INTO v_new_user_id;

  IF v_new_user_id IS NULL THEN
    SELECT id INTO v_new_user_id FROM public.users WHERE auth_id = NEW.id;
  END IF;

  IF v_new_user_id IS NOT NULL THEN
    v_email_lower := lower(NEW.email);
    UPDATE public.tool_leads
    SET user_id      = v_new_user_id,
        converted_at = COALESCE(converted_at, now())
    WHERE lower(email) = v_email_lower
      AND user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_new_auth_user() IS
  'Создаёт public.users при регистрации. P0-защита: роль admin недоступна для самостоятельного назначения через клиентские метаданные signUp.';

-- ── P0-B ──────────────────────────────────────────────────────────────────
-- Заменяем «сплошную» политику врача на команды по отдельности: чтение и
-- изменение остаются как были (по doctor_id), а вот СОЗДАНИЕ требует
-- подтверждённой связи с пациентом.
DROP POLICY IF EXISTS recommendations_doctor_all ON public.recommendations;

CREATE POLICY recommendations_doctor_select ON public.recommendations
  FOR SELECT USING (doctor_id = public.get_my_user_id());

CREATE POLICY recommendations_doctor_update ON public.recommendations
  FOR UPDATE USING (doctor_id = public.get_my_user_id())
  WITH CHECK (doctor_id = public.get_my_user_id());

CREATE POLICY recommendations_doctor_delete ON public.recommendations
  FOR DELETE USING (doctor_id = public.get_my_user_id());

CREATE POLICY recommendations_doctor_insert ON public.recommendations
  FOR INSERT
  WITH CHECK (
    doctor_id = public.get_my_user_id()
    AND EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.connection_type = 'doctor_athlete'
        AND c.status = 'active'
        AND (
          (c.initiator_id = public.get_my_user_id() AND c.recipient_id = recommendations.athlete_id)
         OR (c.recipient_id = public.get_my_user_id() AND c.initiator_id = recommendations.athlete_id)
        )
    )
  );

NOTIFY pgrst, 'reload schema';
