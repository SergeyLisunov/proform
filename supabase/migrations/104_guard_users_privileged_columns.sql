-- ──────────────────────────────────────────────────────────────────────────
-- 104_guard_users_privileged_columns.sql — P0: ЭСКАЛАЦИЯ ПРИВИЛЕГИЙ.
--
-- Найдено ролевым RLS-зондом (qa/ralph/rls-probe.mjs, проверка WR-02):
-- обычный спортсмен своим собственным токеном выполняет
--   PATCH /rest/v1/users?id=eq.<свой id>  {"role":"admin"}
-- и получает 200 + роль admin. Дальше он админ платформы:
--   • users_select_own даёт чтение ВСЕХ пользователей (ветка get_my_role()='admin');
--   • политика «org_members: admin all» даёт полный доступ к составу ЛЮБОЙ
--     организации (подтверждено проверкой WR-03: вставка себя org_admin'ом
--     в чужой клуб прошла со статусом 201 — но только уже будучи админом);
--   • открываются админ-разделы и внутренняя CRM.
-- Компрометация платформы из любого рядового аккаунта.
--
-- Причина: политика users_update_own объявлена как
--   USING (auth_id = auth.uid() OR get_my_role() = 'admin')  -- WITH CHECK отсутствует
-- Когда у UPDATE-политики нет WITH CHECK, Postgres проверяет новую строку тем
-- же USING-выражением. Оно смотрит только на auth_id, который при смене роли
-- не меняется, — значит пользователю разрешено переписать ЛЮБУЮ колонку своей
-- строки, включая role и verification-поля. RLS не умеет ограничивать
-- КОЛОНКИ, поэтому одной политикой это не чинится.
--
-- Решение: BEFORE UPDATE триггер, запрещающий менять привилегированные
-- колонки всем, кроме админов платформы и серверных ключей (service_role).
-- Триггер, а не column-level GRANT: новые колонки не будут молча ломаться,
-- а список защищаемых полей виден в одном месте.
--
-- Клиентский сообщник дефекта — мёртвая функция useUser().switchRole,
-- позволявшая сменить себе роль из браузера, — удалена в этом же изменении.
--
-- Регрессия: qa/ralph/rls-probe.mjs (WR-02, WR-03) + lib/db/users-guard.test.ts
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_users_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_jwt_role text;
BEGIN
  -- Роль соединения из JWT: 'authenticated' | 'anon' у клиентов,
  -- 'service_role' у серверных ключей, NULL у прямых подключений
  -- (миграции, cron, psql) — тем ограничения не нужны.
  v_jwt_role := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';

  IF v_jwt_role IS NULL OR v_jwt_role NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- Админ платформы вправе менять роли и verification-статусы
  -- (используется страницей /admin).
  IF public.get_my_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Смена собственной роли запрещена' USING ERRCODE = '42501';
  END IF;

  IF NEW.auth_id IS DISTINCT FROM OLD.auth_id THEN
    RAISE EXCEPTION 'Смена auth_id запрещена' USING ERRCODE = '42501';
  END IF;

  IF NEW.is_verified        IS DISTINCT FROM OLD.is_verified
  OR NEW.verified_at        IS DISTINCT FROM OLD.verified_at
  OR NEW.verified_by        IS DISTINCT FROM OLD.verified_by
  OR NEW.verification_notes IS DISTINCT FROM OLD.verification_notes THEN
    RAISE EXCEPTION 'Изменение статуса верификации доступно только администратору'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.is_demo IS DISTINCT FROM OLD.is_demo
  OR NEW.is_featured IS DISTINCT FROM OLD.is_featured THEN
    RAISE EXCEPTION 'Изменение служебных флагов доступно только администратору'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_users_privileged_columns ON public.users;
CREATE TRIGGER trg_guard_users_privileged_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_users_privileged_columns();

COMMENT ON FUNCTION public.guard_users_privileged_columns() IS
  'P0-защита: запрещает обычному пользователю менять свои role/auth_id/verification/служебные флаги. RLS не ограничивает колонки — поэтому триггер.';

NOTIFY pgrst, 'reload schema';
