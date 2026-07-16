-- 093 — child privacy defaults (P1, стратегия ролей 2026-07).
--
-- Политика docs/policy/child-privacy-defaults.md: аккаунт ребёнка
-- (users + активная parent_links) приватен по умолчанию. Разрыв: у
-- users.is_searchable DB-default TRUE — дети, созданные до этого фикса,
-- находимы в поиске собеседника в /messages любым пользователем платформы
-- (нарушение принципа «никаких DM ребёнок ↔ незнакомец»).
--
-- Forward-фикс в коде: app/api/parent/register-child теперь выставляет
-- is_searchable=false при создании. Эта миграция — data-fix для уже
-- существующих детских аккаунтов.
--
-- Скоуп: только дети с АКТИВНОЙ родительской связью. Ребёнок, забравший
-- аккаунт (claim) и отвязавшийся, под политику не попадает; включить
-- обратно можно в настройках приватности.

UPDATE public.users u
SET    is_searchable = false
WHERE  u.is_searchable = true
  AND  EXISTS (
         SELECT 1 FROM public.parent_links pl
         WHERE  pl.child_id = u.id
           AND  pl.status   = 'active'
       );

NOTIFY pgrst, 'reload schema';
