-- ──────────────────────────────────────────────────────────────────────────
-- 110_org_admin_scopes.sql — вторая половина дефекта «роль org_admin не работает».
--
-- В интерфейсе гейты страниц /org/* переведены с глобальной роли на
-- фактическое членство (canManage). Но RLS осталась прежней: все клубные
-- политики требуют users.role = 'organization', то есть аккаунт-организацию.
-- Ревью показало, к чему это приводит для админа клуба:
--   • состав клуба урезан до ОДНОЙ строки — единственная подходящая политика
--     «org_members: member read own» отдаёт только его собственное членство;
--     из-за этого же пусты счётчики на /org и /org/analytics;
--   • профиль клуба не читается вовсе (organizations пускает либо по
--     is_verified = true, либо сам аккаунт-организацию), поэтому страницы,
--     гейтящие рендер на `!org`, показывают «клуб не найден»;
--   • запись молча не проходит: UPDATE под RLS не находит строк, PostgREST
--     отвечает без ошибки, а интерфейс рапортует «Сохранено».
-- Последнее опаснее исходного дефекта: раньше админ честно не входил,
-- теперь получал бы ложное подтверждение.
--
-- РЕКУРСИЯ. Политику на org_members нельзя писать подзапросом к org_members —
-- подзапрос сам пройдёт RLS той же таблицы (ровно так получили 42P17 на
-- users в миграции 103). Поэтому предикаты вынесены в SECURITY DEFINER
-- функции: внутри них RLS не применяется.
--
-- Регрессия: qa/ralph/rls-probe.mjs — проверки OA-01…OA-05.
-- ──────────────────────────────────────────────────────────────────────────

-- ── Предикаты членства ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_org_member_of(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = p_org
      AND m.user_id = public.get_my_user_id()
      AND m.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_manager_of(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = p_org
      AND m.user_id = public.get_my_user_id()
      AND m.status = 'active'
      AND m.member_role IN ('org_owner', 'org_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner_of(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = p_org
      AND m.user_id = public.get_my_user_id()
      AND m.status = 'active'
      AND m.member_role = 'org_owner'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_org_member_of(uuid)  FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_manager_of(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_owner_of(uuid)   FROM anon;

-- ── Профиль своего клуба виден его участникам ─────────────────────────────
DROP POLICY IF EXISTS organizations_member_read ON public.organizations;
CREATE POLICY organizations_member_read ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member_of(id));

-- ── Состав клуба: читают управляющие, а не только «сам себя» ──────────────
DROP POLICY IF EXISTS org_members_manager_read ON public.org_members;
CREATE POLICY org_members_manager_read ON public.org_members
  FOR SELECT TO authenticated
  USING (public.is_org_manager_of(org_id));

-- ── Управление составом: приглашения, статусы, роли ───────────────────────
-- Ограничение внутри клуба: назначить кого-либо ВЛАДЕЛЬЦЕМ может только
-- владелец. Иначе org_admin повышал бы себя до org_owner прямым PATCH'ем,
-- минуя серверный маршрут /api/org/members/role с его canAssignOrgAdmin.
DROP POLICY IF EXISTS org_members_manager_insert ON public.org_members;
CREATE POLICY org_members_manager_insert ON public.org_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_manager_of(org_id)
    AND (member_role <> 'org_owner' OR public.is_org_owner_of(org_id))
  );

DROP POLICY IF EXISTS org_members_manager_update ON public.org_members;
CREATE POLICY org_members_manager_update ON public.org_members
  FOR UPDATE TO authenticated
  USING (public.is_org_manager_of(org_id))
  WITH CHECK (
    public.is_org_manager_of(org_id)
    AND (member_role <> 'org_owner' OR public.is_org_owner_of(org_id))
  );

DROP POLICY IF EXISTS org_members_owner_delete ON public.org_members;
CREATE POLICY org_members_owner_delete ON public.org_members
  FOR DELETE TO authenticated
  USING (public.is_org_manager_of(org_id));

-- ── Стена клуба и рассылки: управляющие, а не только аккаунт-организация ──
DROP POLICY IF EXISTS wall_posts_manager_manage ON public.wall_posts;
CREATE POLICY wall_posts_manager_manage ON public.wall_posts
  FOR ALL TO authenticated
  USING (public.is_org_manager_of(org_id))
  WITH CHECK (public.is_org_manager_of(org_id));

DROP POLICY IF EXISTS newsletters_manager_manage ON public.newsletters;
CREATE POLICY newsletters_manager_manage ON public.newsletters
  FOR ALL TO authenticated
  USING (public.is_org_manager_of(org_id))
  WITH CHECK (public.is_org_manager_of(org_id));

NOTIFY pgrst, 'reload schema';
