-- ──────────────────────────────────────────────────────────────────────────
-- 113_drop_dead_org_members_policies.sql — удаление двух мёртвых политик.
--
-- На public.org_members висели политики, которые не срабатывают НИКОГДА,
-- потому что сравнивают идентификаторы из разных пространств:
--
--   org_members_own_read   USING (user_id = auth.uid())
--   org_members_org_manage USING (org_id = auth.uid()
--                                 AND EXISTS (SELECT 1 FROM users
--                                             WHERE users.id = auth.uid() ...))
--
-- В этой схеме auth.uid() — это auth.users.id, а org_members.user_id и
-- org_members.org_id ссылаются на public.users.id. Это разные значения:
-- связь между ними — колонка users.auth_id.
--
-- Доказательство мёртвости (живая база на момент миграции):
--   SELECT count(*) FROM users;                      -- 30
--   SELECT count(*) FROM users WHERE id = auth_id;   --  0
--   SELECT count(*) FROM org_members;                -- 16
--   ... WHERE m.org_id = u.auth_id;                  --  0
-- Ни одной строки, на которой предикат мог бы стать истинным.
--
-- Доступа они не дают и не отнимают, но обходятся дорого: при каждом
-- разборе прав их приходится читать и доказывать, что они ничего не
-- значат. Рабочие аналоги существуют и остаются:
--   «org_members: member read own» — чтение своей строки, через
--     user_id IN (SELECT users.id WHERE auth_id = auth.uid());
--   «org_members: org full access» — полный доступ аккаунта-организации;
--   org_members_manager_* (миграция 110) — доступ управляющих клуба.
--
-- Регрессия: qa/ralph/rls-probe.mjs — 31 проверка изоляции должна остаться
-- зелёной ПОСЛЕ удаления; если что-то отвалится, значит политика была жива.
-- ──────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS org_members_own_read   ON public.org_members;
DROP POLICY IF EXISTS org_members_org_manage ON public.org_members;

NOTIFY pgrst, 'reload schema';
