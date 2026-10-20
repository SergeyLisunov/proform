-- ──────────────────────────────────────────────────────────────────────────
-- 119_specialist_connections.sql
--
-- Связь «специалист — спортсмен» (specialist_athlete).
--
-- ЗАЧЕМ. Специалист работает со спортсменом только с его согласия, как врач:
-- отправляет запрос, спортсмен принимает. Триггер согласия из 115 сверяет
-- роли сторон с типом связи по жёсткому списку, и specialist_athlete в нём
-- нет — такой запрос он отклонил бы. Права на данные спортсмена эта
-- миграция НЕ даёт: что видит и пишет специалист по связи, решают
-- следующие миграции.
--
-- ЧТО ДЕЛАЕМ. Список «тип связи → роли сторон» выносим в функцию
-- connection_type_roles(): триггер берёт его оттуда, новый тип добавляется
-- в одном месте. Тот же список в приложении — CONNECTION_TYPE_ROLES в
-- lib/connections/types.ts; тест сверяет их между собой.
--
-- Сам триггер не меняется по смыслу: тело из 115, кроме источника списка.
--
-- Приглашения по почте (email_invites) держат свой CHECK по типу связи
-- (025, 090) — добавляем туда specialist_athlete, иначе приглашение от
-- специалиста упало бы на вставке. Если такой же CHECK есть у connections
-- (таблицу создавали в панели, по репозиторию не проверить), он
-- пересоздаётся с полным списком; NOT VALID — старые строки не мешают
-- применить миграцию, проверяются только новые.
-- ──────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.connection_type_roles()
RETURNS TABLE (connection_type text, first_role text, second_role text)
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  VALUES
    ('coach_athlete',      'coach',        'athlete'),
    ('org_coach',          'organization', 'coach'),
    ('org_athlete',        'organization', 'athlete'),
    ('doctor_athlete',     'doctor',       'athlete'),
    ('coach_doctor',       'coach',        'doctor'),
    ('org_doctor',         'organization', 'doctor'),
    ('admin_doctor',       'admin',        'doctor'),
    ('specialist_athlete', 'specialist',   'athlete')
$$;

COMMENT ON FUNCTION public.connection_type_roles() IS
  'Допустимые типы связи и роли их сторон. Зеркало — CONNECTION_TYPE_ROLES в lib/connections/types.ts.';

CREATE OR REPLACE FUNCTION public.trg_connections_consent_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_role  text := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  me          uuid;
  new_request boolean;
  role_a      text;
  role_b      text;
BEGIN
  IF v_jwt_role IS NULL OR v_jwt_role NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  me := public.get_my_user_id();
  IF me IS NULL THEN
    RAISE EXCEPTION 'Нет профиля пользователя' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'active' AND (
       NEW.initiator_id    IS DISTINCT FROM OLD.initiator_id
    OR NEW.recipient_id    IS DISTINCT FROM OLD.recipient_id
    OR NEW.connection_type IS DISTINCT FROM OLD.connection_type) THEN
    RAISE EXCEPTION 'Активную связь нельзя переписать на другого человека — сначала разорвите её'
      USING ERRCODE = '42501';
  END IF;

  new_request := TG_OP = 'INSERT'
    OR NEW.initiator_id    IS DISTINCT FROM OLD.initiator_id
    OR NEW.recipient_id    IS DISTINCT FROM OLD.recipient_id
    OR NEW.connection_type IS DISTINCT FROM OLD.connection_type
    OR (NEW.status = 'pending' AND OLD.status IS DISTINCT FROM 'pending');

  IF new_request THEN
    IF NEW.initiator_id IS DISTINCT FROM me THEN
      RAISE EXCEPTION 'Запрос на связь отправляется только от своего имени'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.status = 'active' THEN
      RAISE EXCEPTION 'Связь становится активной только после согласия второй стороны'
        USING ERRCODE = '42501';
    END IF;

    SELECT role INTO role_a FROM public.users WHERE id = NEW.initiator_id;
    SELECT role INTO role_b FROM public.users WHERE id = NEW.recipient_id;

    IF NOT EXISTS (
      SELECT 1 FROM public.connection_type_roles() AS combo
      WHERE combo.connection_type = NEW.connection_type
        AND ((role_a = combo.first_role AND role_b = combo.second_role)
          OR (role_a = combo.second_role AND role_b = combo.first_role))
    ) THEN
      RAISE EXCEPTION 'Роли сторон не подходят к типу связи %', NEW.connection_type
        USING ERRCODE = '42501';
    END IF;

  ELSIF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    IF OLD.status IS DISTINCT FROM 'pending' OR OLD.recipient_id IS DISTINCT FROM me THEN
      RAISE EXCEPTION 'Принять запрос на связь может только его получатель'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_connections_consent_guard() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.email_invites DROP CONSTRAINT IF EXISTS email_invites_connection_type_check;
ALTER TABLE public.email_invites ADD CONSTRAINT email_invites_connection_type_check
  CHECK (connection_type IN (
    'coach_athlete', 'org_coach', 'org_athlete', 'doctor_athlete',
    'coach_doctor',  'org_doctor', 'admin_doctor',
    'specialist_athlete',
    'parent_link'
  ));

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.connections'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%connection_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.connections DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.connections ADD CONSTRAINT connections_connection_type_check
  CHECK (connection_type IN (
    'coach_athlete', 'org_coach', 'org_athlete', 'doctor_athlete',
    'coach_doctor',  'org_doctor', 'admin_doctor',
    'specialist_athlete'
  )) NOT VALID;

COMMIT;

NOTIFY pgrst, 'reload schema';
