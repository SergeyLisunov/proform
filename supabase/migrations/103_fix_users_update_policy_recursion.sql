-- ──────────────────────────────────────────────────────────────────────────
-- 103_fix_users_update_policy_recursion.sql — КРИТИЧНО: любой UPDATE в
-- public.users падал у всех обычных пользователей.
--
-- Симптом (найден живым разбором жалобы «не могу завершить онбординг»):
--   ERROR 42P17: infinite recursion detected in policy for relation "users"
--
-- Причина: политика users_admin_update_verification (admin-переключение
-- verification-статусов) написана через ПРЯМОЙ подзапрос к самой users:
--   EXISTS (SELECT 1 FROM users me WHERE me.auth_id = auth.uid()
--                                    AND me.role = 'admin')
-- Подзапрос к users сам проходит RLS users → та же политика → рекурсия.
-- Postgres обрывает это ошибкой, и падает ВЕСЬ UPDATE-стейтмент — даже
-- когда пользователь обновляет собственную строку по users_update_own
-- (несколько PERMISSIVE-политик объединяются через OR, но выражение
-- рекурсивной политики всё равно вычисляется).
--
-- Что было сломано в проде: завершение онбординга (markOnboardingComplete
-- → «Не удалось отметить onboarding как пройденный» → пользователь заперт
-- в мастере и не может попасть в кабинет), сохранение профиля/настроек,
-- переключатели notification_prefs (включая Telegram-канал), is_searchable,
-- смена языка — всё, что пишет в users из клиента.
--
-- Исправление: тот же admin-предикат через get_my_role() — STABLE
-- SECURITY DEFINER функция (см. соседние политики users_select_own /
-- users_update_own), которая читает users в обход RLS и рекурсию не
-- создаёт. Права не меняются: админ по-прежнему может обновлять любые
-- строки, обычный пользователь — только свою.
-- Applied to prod.
-- ──────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS users_admin_update_verification ON public.users;

CREATE POLICY users_admin_update_verification ON public.users
  FOR UPDATE TO public
  USING      ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');

NOTIFY pgrst, 'reload schema';
