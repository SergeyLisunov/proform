-- ============================================================================
-- Sporteo QA seed cleanup — удаляет ТОЛЬКО синтетические данные тестирования.
--
-- Безопасность: все условия привязаны к домену @sporteo-qa.dev и к
-- slug'ам qa-club-*. Реальные пользователи и клубы не затрагиваются.
-- Перед удалением стоит убедиться, что счётчики совпадают с ожидаемыми
-- (запрос в конце файла показывает, что будет удалено).
--
-- Порядок: сначала зависимые сущности, затем org_members/organizations,
-- затем public.users (каскадом от auth.users).
-- ============================================================================

-- Что будет удалено (запустите отдельно ДО удаления):
--   SELECT count(*) FROM auth.users WHERE email LIKE 'qa.%@sporteo-qa.dev';
--   SELECT org_slug FROM organizations WHERE org_slug LIKE 'qa-club-%';

BEGIN;

WITH qa AS (SELECT id FROM users WHERE email LIKE 'qa.%@sporteo-qa.dev')
DELETE FROM recommendations r WHERE r.athlete_id IN (SELECT id FROM qa)
   OR r.doctor_id IN (SELECT id FROM qa) OR r.coach_id IN (SELECT id FROM qa);

WITH qa AS (SELECT id FROM users WHERE email LIKE 'qa.%@sporteo-qa.dev')
DELETE FROM athlete_goals WHERE athlete_id IN (SELECT id FROM qa);

WITH qa AS (SELECT id FROM users WHERE email LIKE 'qa.%@sporteo-qa.dev')
DELETE FROM wellness_checkins WHERE athlete_id IN (SELECT id FROM qa);

WITH qa AS (SELECT id FROM users WHERE email LIKE 'qa.%@sporteo-qa.dev')
DELETE FROM workouts WHERE athlete_id IN (SELECT id FROM qa);

WITH qa AS (SELECT id FROM users WHERE email LIKE 'qa.%@sporteo-qa.dev')
DELETE FROM connections WHERE initiator_id IN (SELECT id FROM qa) OR recipient_id IN (SELECT id FROM qa);

WITH qa AS (SELECT id FROM users WHERE email LIKE 'qa.%@sporteo-qa.dev')
DELETE FROM trainer_athletes WHERE trainer_id IN (SELECT id FROM qa) OR athlete_id IN (SELECT id FROM qa);

WITH qa AS (SELECT id FROM users WHERE email LIKE 'qa.%@sporteo-qa.dev')
DELETE FROM ai_messages WHERE conversation_id IN (
  SELECT id FROM ai_conversations WHERE user_id IN (SELECT id FROM qa)
);

WITH qa AS (SELECT id FROM users WHERE email LIKE 'qa.%@sporteo-qa.dev')
DELETE FROM ai_conversations WHERE user_id IN (SELECT id FROM qa);

WITH qa AS (SELECT id FROM users WHERE email LIKE 'qa.%@sporteo-qa.dev')
DELETE FROM notifications WHERE user_id IN (SELECT id FROM qa) OR from_user_id IN (SELECT id FROM qa);

DELETE FROM org_members WHERE org_id IN (SELECT id FROM organizations WHERE org_slug LIKE 'qa-club-%');
DELETE FROM organizations WHERE org_slug LIKE 'qa-club-%';

-- public.users удалится каскадом по auth_id → auth.users
DELETE FROM auth.users WHERE email LIKE 'qa.%@sporteo-qa.dev';

COMMIT;

SELECT
  (SELECT count(*) FROM auth.users WHERE email LIKE 'qa.%@sporteo-qa.dev') AS осталось_auth,
  (SELECT count(*) FROM users WHERE email LIKE 'qa.%@sporteo-qa.dev')      AS осталось_users,
  (SELECT count(*) FROM organizations WHERE org_slug LIKE 'qa-club-%')     AS осталось_org;
