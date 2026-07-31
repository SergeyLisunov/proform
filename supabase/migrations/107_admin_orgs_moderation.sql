-- ──────────────────────────────────────────────────────────────────────────
-- 107_admin_orgs_moderation.sql — экран /admin/orgs не видел ни одной
-- организации на модерации, а кнопка «Верифицировать» ничего не меняла.
--
-- Симптом: у админа в шапке «Всего 0 / Ожидают 0 / Проверено 0», хотя в
-- public.organizations лежат 4 неверифицированные организации.
--
-- Причина. На public.organizations включён RLS, но admin-политики нет —
-- ни на чтение, ни на запись (для public.users такая политика есть, см.
-- 072 и 103). Реально на таблице висели только два вида предикатов:
--   • «публичная витрина» — USING (is_verified = true), продублированный
--     ШЕСТЬ раз под разными именами;
--   • «своя организация» — FOR ALL, четыре штуки, из которых три сравнивали
--     auth.uid() с organizations.id, то есть auth.users.id с users.id. Это
--     разные идентификаторы (проверено: в users нет ни одной строки, где
--     id = auth_id), так что три политики из четырёх мертвы.
-- Итог для админа: SELECT возвращает только уже верифицированные строки —
-- именно те, которых на модерации быть не может, поэтому список «Ожидают
-- проверки» пуст по построению. UPDATE не проходит ни по одной политике,
-- строк меняется 0, а PostgREST при этом отдаёт 204 без ошибки (RLS не
-- «запрещает», а просто не находит строку) — UI считал верификацию удачной.
--
-- Побочный дефект той же таблицы, найденный при разборе: у анонима падал
-- ЛЮБОЙ запрос к organizations —
--   ERROR 42501: permission denied for function get_my_role
-- Живая политика «org: own access» подзапросом читает public.users, а на
-- users висит users_select_own с вызовом get_my_role(); EXECUTE на эту
-- функцию у anon отозван миграцией 042. Ломался публичный каталог клубов
-- (/api/directory?type=organization отдавал server_error разлогиненным).
--
-- Что делает миграция:
--   1) схлопывает шесть одинаковых «public read» в одну политику и четыре
--      «own access» — в одну рабочую, без подзапроса к users;
--   2) добавляет admin-политики на SELECT и UPDATE через get_my_role();
--   3) все политики с вызовом SECURITY DEFINER-функций объявлены
--      TO authenticated — anon не имеет EXECUTE и получил бы 42501 при
--      вычислении OR-ветки (см. побочный дефект выше). Анониму остаётся
--      только предикат is_verified = true, без вызовов функций.
--
-- Предикаты обёрнуты в (SELECT ...) — InitPlan, вычисляется один раз на
-- запрос, а не на строку (соглашение из 031_rls_initplan_wrap).
--
-- НЕ ПРИМЕНЕНО к проду — только файл.
-- ──────────────────────────────────────────────────────────────────────────

-- ── 1. Дубли публичного чтения: шесть политик с одинаковым USING ──────────
DROP POLICY IF EXISTS "org: public read"                  ON public.organizations;
DROP POLICY IF EXISTS "org: public read verified"         ON public.organizations;
DROP POLICY IF EXISTS "org: public verified read"         ON public.organizations;
DROP POLICY IF EXISTS "organizations: public read"        ON public.organizations;
DROP POLICY IF EXISTS "organizations: public read verified" ON public.organizations;
DROP POLICY IF EXISTS organizations_public_read           ON public.organizations;

-- ── 2. Четыре политики «своя организация», три из них мертвы ──────────────
DROP POLICY IF EXISTS "org: own access"                   ON public.organizations;
DROP POLICY IF EXISTS "org: own full access"              ON public.organizations;
DROP POLICY IF EXISTS "organizations: own access"         ON public.organizations;
DROP POLICY IF EXISTS organizations_own_access            ON public.organizations;

DROP POLICY IF EXISTS organizations_owner_all             ON public.organizations;
DROP POLICY IF EXISTS organizations_admin_read            ON public.organizations;
DROP POLICY IF EXISTS organizations_admin_update          ON public.organizations;

-- ── Публичная витрина ─────────────────────────────────────────────────────
-- Единственный предикат, доступный анониму. Никаких вызовов функций, иначе
-- вернётся 42501 и публичный каталог клубов снова ляжет.
CREATE POLICY organizations_public_read ON public.organizations
  FOR SELECT TO anon, authenticated
  USING (is_verified = true);

-- ── Своя организация ──────────────────────────────────────────────────────
-- Равносильно рабочей политике «org: own access», но через
-- get_my_user_id() (STABLE SECURITY DEFINER) вместо подзапроса к users:
-- функция читает users в обход RLS, поэтому не тащит за собой чужие
-- политики. owner_id добавлен как основной признак владения из 088 —
-- сейчас он всегда равен id, но связь id↔владелец может быть расщеплена.
-- WITH CHECK повторяет USING: у прежней FOR ALL политики with_check был
-- NULL, и Postgres подставлял USING — права не меняются.
CREATE POLICY organizations_owner_all ON public.organizations
  FOR ALL TO authenticated
  USING (
    id       = (SELECT public.get_my_user_id())
    OR owner_id = (SELECT public.get_my_user_id())
  )
  WITH CHECK (
    -- ПРАВКА ПОСЛЕ РЕВЬЮ: ветка owner_id здесь была дырой.
    -- Для INSERT Postgres проверяет ТОЛЬКО WITH CHECK (USING не применяется),
    -- поэтому любой аутентифицированный пользователь мог создать строку
    -- organizations с id ЧУЖОГО аккаунта и owner_id = собственным, получив на
    -- неё постоянные права. Для UPDATE та же ветка разрешала перекеивание:
    -- сменить organizations.id на чужой users.id, оставив owner_id своим.
    -- Право на запись выводится ровно из тождества organizations.id = users.id
    -- аккаунта-организации; owner_id остаётся признаком только для чтения.
    id = (SELECT public.get_my_user_id())
  );

-- ── Модерация: админ видит все организации и переключает верификацию ──────
-- Тот же приём, что в 103: предикат через get_my_role(), а не прямым
-- подзапросом к users — подзапрос проходил бы RLS users и на самой users
-- давал рекурсию 42P17.
CREATE POLICY organizations_admin_read ON public.organizations
  FOR SELECT TO authenticated
  USING ((SELECT public.get_my_role()) = 'admin');

CREATE POLICY organizations_admin_update ON public.organizations
  FOR UPDATE TO authenticated
  USING      ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');

-- ── Самоверификация запрещена (находка ревью) ─────────────────────────────
-- organizations_owner_all даёт клубу UPDATE на ВСЕ колонки своей строки,
-- включая is_verified, а колоночного гарда на таблице нет. Без этого клуб
-- своим же токеном делает PATCH {"is_verified": true}: исчезает из списка
-- «Ожидают проверки» и попадает в публичный каталог как проверенный, минуя
-- модерацию целиком. RLS не ограничивает колонки — нужен триггер, тот же
-- приём, что в миграции 104 для users.role.
CREATE OR REPLACE FUNCTION public.guard_org_verification_columns()
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

  IF (SELECT public.get_my_role()) = 'admin' THEN
    RETURN NEW;
  END IF;

  -- ВНИМАНИЕ: у organizations есть только is_verified. Колонок verified_at /
  -- verified_by здесь НЕТ (они на users) — первая версия триггера ссылалась
  -- на них и роняла ЛЮБОЙ UPDATE организации с 42703 «record new has no
  -- field». Поймано живой проверкой перед коммитом, а не тестом: тестов на
  -- редактирование клуба нет.
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    RAISE EXCEPTION 'Верификация организации доступна только администратору платформы'
      USING ERRCODE = '42501';
  END IF;

  -- id организации — тождество с аккаунтом: его смена превращает право на
  -- свою строку в право на чужую.
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Смена идентификатора организации запрещена' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_org_verification_columns ON public.organizations;
CREATE TRIGGER trg_guard_org_verification_columns
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_org_verification_columns();

NOTIFY pgrst, 'reload schema';
