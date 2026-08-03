-- ──────────────────────────────────────────────────────────────────────────
-- 112_newsletter_deliveries_read.sql — статистика рассылки была слепой.
--
-- Что было:
--   Отправка (/api/org/newsletters/[id]/send) пишет строки в
--   newsletter_deliveries через createAdminClient() — RLS обходится, всё
--   сохраняется. А страница статистики /org/newsletters/[id]/stats читает ту
--   же таблицу обычным пользовательским клиентом
--   (services/newsletter.service.ts::getNewsletterStats). Политик было три,
--   и все три — «только своя строка»:
--     newsletter_deliveries: own read   → users.auth_id = auth.uid() AND u.id = user_id
--     newsletter_deliveries_own_read    → user_id = auth.uid()
--     nl_deliveries: own read           → user_id = auth.uid()
--   Для управляющего клубом не подходит ни одна: он не адресат рассылки.
--   Итог — sent/delivered/opened/failed всегда нули, при любом объёме
--   реально отправленных писем. Экран не «пока пустой», он структурно
--   не способен показать данные.
--
--   Вдобавок две из трёх политик сравнивают user_id с auth.uid(). В этой
--   схеме newsletter_deliveries.user_id — это users.id, а auth.uid() —
--   auth.users.id; значения разные, так что и «свою» доставку эти политики
--   не пропускали. Работала фактически одна политика из трёх, остальные
--   две — мёртвый предикат, который PostgreSQL всё равно вычисляет на
--   каждой строке.
--
-- Решение:
--   1) Схлопнуть три перекрывающиеся own-политики в одну корректную,
--      через users.auth_id (тот же приём, что и get_my_user_id()).
--   2) Добавить чтение для управляющих клуба-владельца рассылки, через
--      SECURITY DEFINER предикат is_org_manager_of(uuid) из миграции 110 —
--      он же уже охраняет newsletters (newsletters_manager_manage).
--
-- Почему предикат берётся через newsletters, а не напрямую: у
-- newsletter_deliveries нет колонки org_id, владелец определяется только
-- родительской рассылкой.
--
-- Сам аккаунт-организация тоже проходит is_org_manager_of: миграция 088
-- триггером и backfill'ом заводит ему строку org_members(org_id=user_id,
-- member_role='org_owner', status='active') — проверено на всех четырёх
-- существующих org-аккаунтах. Отдельная ветка «или ты и есть org_id» не
-- нужна и только развела бы два источника правды о владении клубом.
--
-- Рекурсии нет: политики newsletters не ссылаются на newsletter_deliveries,
-- поэтому вложенный EXISTS отрабатывает под обычными политиками newsletters.
--
-- Права остаются read-only: писать в таблицу по-прежнему может лишь
-- service_role (маршрут отправки). Управляющий видит статистику, но не
-- может подделать её из браузера.
-- ──────────────────────────────────────────────────────────────────────────

-- ── 1. Одна корректная «своя доставка» вместо трёх ────────────────────────
DROP POLICY IF EXISTS "newsletter_deliveries: own read" ON public.newsletter_deliveries;
DROP POLICY IF EXISTS newsletter_deliveries_own_read    ON public.newsletter_deliveries;
DROP POLICY IF EXISTS "nl_deliveries: own read"         ON public.newsletter_deliveries;

CREATE POLICY newsletter_deliveries_own_read ON public.newsletter_deliveries
  FOR SELECT TO authenticated
  USING (user_id = (SELECT public.get_my_user_id()));

-- ── 2. Статистика рассылки — управляющим клуба-отправителя ────────────────
DROP POLICY IF EXISTS newsletter_deliveries_manager_read ON public.newsletter_deliveries;
CREATE POLICY newsletter_deliveries_manager_read ON public.newsletter_deliveries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.newsletters n
      WHERE n.id = newsletter_deliveries.newsletter_id
        AND public.is_org_manager_of(n.org_id)
    )
  );

-- Индекс под предикат политики и под сам запрос статистики
-- (WHERE newsletter_id = $1) — без него каждая проверка это seq scan.
CREATE INDEX IF NOT EXISTS newsletter_deliveries_newsletter_idx
  ON public.newsletter_deliveries (newsletter_id);

NOTIFY pgrst, 'reload schema';
