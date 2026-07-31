-- ============================================================================
-- Sporteo QA seed — синтетические организации Alpha и Beta + владелец платформы.
--
-- ПОВТОРЯЕМЫЙ (idempotent): повторный запуск не создаёт дубликатов.
-- СЕКРЕТОВ НЕТ: пароль не хранится здесь — bcrypt-хеш копируется из уже
--   существующего аккаунта qa.coach@sporteo-qa.dev (единый QA-пароль).
--   Если базовый аккаунт отсутствует, seed прерывается с понятной ошибкой.
--
-- ВАЖНО (дефект QA-001, найден Ralph-итерацией 1): token-колонки auth.users
--   должны быть '' , а НЕ NULL. GoTrue сканирует их в Go-строки и при NULL
--   отдаёт «Database error querying schema» — вход невозможен для всех
--   аккаунтов, созданных прямым INSERT.
--
-- Очистка: qa/ralph/seed-cleanup.sql
-- ============================================================================

DO $$
DECLARE
  v_pw_hash text;
  v_emails  text[] := ARRAY[
    'qa.owner.alpha@sporteo-qa.dev','qa.coach.alpha1@sporteo-qa.dev','qa.coach.alpha2@sporteo-qa.dev',
    'qa.doctor.alpha@sporteo-qa.dev','qa.athlete.alpha1@sporteo-qa.dev','qa.athlete.alpha2@sporteo-qa.dev',
    'qa.owner.beta@sporteo-qa.dev','qa.coach.beta@sporteo-qa.dev','qa.doctor.beta@sporteo-qa.dev',
    'qa.athlete.beta@sporteo-qa.dev','qa.platform.owner@sporteo-qa.dev'
  ];
  v_roles   text[] := ARRAY[
    'organization','coach','coach','doctor','athlete','athlete',
    'organization','coach','doctor','athlete','admin'
  ];
  v_names   text[] := ARRAY[
    'QA Владелец Альфа','QA Тренер Альфа-1','QA Тренер Альфа-2','QA Врач Альфа',
    'QA Спортсмен Альфа-1','QA Спортсмен Альфа-2',
    'QA Владелец Бета','QA Тренер Бета','QA Врач Бета','QA Спортсмен Бета',
    'QA Владелец платформы'
  ];
  i         int;
  v_auth_id uuid;
BEGIN
  SELECT encrypted_password INTO v_pw_hash
  FROM auth.users WHERE email = 'qa.coach@sporteo-qa.dev';
  IF v_pw_hash IS NULL THEN
    RAISE EXCEPTION 'Базовый QA-аккаунт qa.coach@sporteo-qa.dev не найден — seed не может взять хеш пароля';
  END IF;

  FOR i IN 1..array_length(v_emails, 1) LOOP
    SELECT id INTO v_auth_id FROM auth.users WHERE email = v_emails[i];

    IF v_auth_id IS NULL THEN
      v_auth_id := gen_random_uuid();

      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        -- Пустые строки, НЕ NULL (см. QA-001)
        confirmation_token, recovery_token, email_change, email_change_token_new,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_auth_id, 'authenticated', 'authenticated',
        v_emails[i], v_pw_hash, now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', v_names[i], 'role', v_roles[i]),
        now(), now(),
        '', '', '', '', '', '', '', ''
      );

      INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
      VALUES (gen_random_uuid(), v_auth_id, v_auth_id::text,
              jsonb_build_object('sub', v_auth_id::text, 'email', v_emails[i], 'email_verified', true),
              'email', now(), now(), now());
    END IF;

    -- Роль и завершённый онбординг (страховка: триггер мог отработать раньше
    -- или роль могла разойтись при повторном прогоне).
    UPDATE public.users
    SET role = v_roles[i],
        name = v_names[i],
        onboarding_state = jsonb_build_object('completed', true, 'qa_seed', true)
    WHERE auth_id = v_auth_id;
  END LOOP;
END $$;

-- ── Организации ─────────────────────────────────────────────────────────────
-- ВНИМАНИЕ (дефект QA-002): organizations.id НЕ имеет DEFAULT gen_random_uuid(),
-- поэтому id обязан передаваться явно любым, кто вставляет организацию.
INSERT INTO organizations (id, org_name, org_slug, owner_id, sport_type, city, country, profile_public)
SELECT gen_random_uuid(), 'QA Клуб Альфа', 'qa-club-alpha', u.id, 'Лёгкая атлетика', 'Москва', 'RU', false
FROM users u WHERE u.email = 'qa.owner.alpha@sporteo-qa.dev'
  AND NOT EXISTS (SELECT 1 FROM organizations WHERE org_slug = 'qa-club-alpha');

-- ВНИМАНИЕ (дефект QA-002): organizations.id НЕ имеет DEFAULT gen_random_uuid(),
-- поэтому id обязан передаваться явно любым, кто вставляет организацию.
INSERT INTO organizations (id, org_name, org_slug, owner_id, sport_type, city, country, profile_public)
SELECT gen_random_uuid(), 'QA Клуб Бета', 'qa-club-beta', u.id, 'Плавание', 'Казань', 'RU', false
FROM users u WHERE u.email = 'qa.owner.beta@sporteo-qa.dev'
  AND NOT EXISTS (SELECT 1 FROM organizations WHERE org_slug = 'qa-club-beta');

-- ── Членство ────────────────────────────────────────────────────────────────
INSERT INTO org_members (org_id, user_id, member_role, status, joined_at)
SELECT o.id, u.id, m.member_role, 'active', now()
FROM (VALUES
  ('qa-club-alpha','qa.owner.alpha@sporteo-qa.dev','org_owner'),
  ('qa-club-alpha','qa.coach.alpha1@sporteo-qa.dev','coach'),
  ('qa-club-alpha','qa.coach.alpha2@sporteo-qa.dev','coach'),
  ('qa-club-alpha','qa.doctor.alpha@sporteo-qa.dev','doctor'),
  ('qa-club-alpha','qa.athlete.alpha1@sporteo-qa.dev','athlete'),
  ('qa-club-alpha','qa.athlete.alpha2@sporteo-qa.dev','athlete'),
  ('qa-club-beta','qa.owner.beta@sporteo-qa.dev','org_owner'),
  ('qa-club-beta','qa.coach.beta@sporteo-qa.dev','coach'),
  ('qa-club-beta','qa.doctor.beta@sporteo-qa.dev','doctor'),
  ('qa-club-beta','qa.athlete.beta@sporteo-qa.dev','athlete')
) AS m(slug, email, member_role)
JOIN organizations o ON o.org_slug = m.slug
JOIN users u ON u.email = m.email
WHERE NOT EXISTS (SELECT 1 FROM org_members x WHERE x.org_id = o.id AND x.user_id = u.id);

-- ── Тренер → спортсмен ──────────────────────────────────────────────────────
-- Alpha-1: назначен coach1 + doctor. Alpha-2: назначен coach2, БЕЗ доктора
-- (проверка empty state и последующего назначения).
INSERT INTO trainer_athletes (trainer_id, athlete_id, status)
SELECT t.id, a.id, 'active'
FROM (VALUES
  ('qa.coach.alpha1@sporteo-qa.dev','qa.athlete.alpha1@sporteo-qa.dev'),
  ('qa.coach.alpha2@sporteo-qa.dev','qa.athlete.alpha2@sporteo-qa.dev'),
  ('qa.coach.beta@sporteo-qa.dev','qa.athlete.beta@sporteo-qa.dev')
) AS r(coach, athlete)
JOIN users t ON t.email = r.coach
JOIN users a ON a.email = r.athlete
WHERE NOT EXISTS (
  SELECT 1 FROM trainer_athletes x WHERE x.trainer_id = t.id AND x.athlete_id = a.id
);

-- ── Врач → пациент (connections.connection_type='doctor_athlete') ───────────
INSERT INTO connections (initiator_id, recipient_id, connection_type, status)
SELECT d.id, a.id, 'doctor_athlete', 'active'
FROM (VALUES
  ('qa.doctor.alpha@sporteo-qa.dev','qa.athlete.alpha1@sporteo-qa.dev'),
  ('qa.doctor.beta@sporteo-qa.dev','qa.athlete.beta@sporteo-qa.dev')
) AS r(doctor, athlete)
JOIN users d ON d.email = r.doctor
JOIN users a ON a.email = r.athlete
WHERE NOT EXISTS (
  SELECT 1 FROM connections x
  WHERE x.connection_type = 'doctor_athlete'
    AND ((x.initiator_id = d.id AND x.recipient_id = a.id)
      OR (x.initiator_id = a.id AND x.recipient_id = d.id))
);

-- ── Фикстуры Alpha-1: тренировка, самочувствие, цель, активная рекомендация ─
INSERT INTO workouts (athlete_id, event_date, event_type, activity_type, name, description, activity_duration_min)
SELECT a.id, current_date - 2, 'workout', 'Бег', 'QA: контрольная тренировка', 'Синтетические данные QA', 60
FROM users a WHERE a.email = 'qa.athlete.alpha1@sporteo-qa.dev'
  AND NOT EXISTS (SELECT 1 FROM workouts w WHERE w.athlete_id = a.id AND w.name = 'QA: контрольная тренировка');

INSERT INTO wellness_checkins (athlete_id, date, mood, energy, sleep_hours, sleep_quality, soreness)
SELECT a.id, current_date - 1, 4, 3, 7.5, 4, 3
FROM users a WHERE a.email = 'qa.athlete.alpha1@sporteo-qa.dev'
  AND NOT EXISTS (SELECT 1 FROM wellness_checkins c WHERE c.athlete_id = a.id AND c.date = current_date - 1);

INSERT INTO athlete_goals (athlete_id, metric, metric_label, target_value, status)
SELECT a.id, 'distance', 'QA: 10 км', 40, 'active'
FROM users a WHERE a.email = 'qa.athlete.alpha1@sporteo-qa.dev'
  AND NOT EXISTS (SELECT 1 FROM athlete_goals g WHERE g.athlete_id = a.id AND g.metric_label = 'QA: 10 км');

INSERT INTO recommendations (
  organization_id, athlete_id, doctor_id, coach_id, title, body,
  category, severity, visibility_level, status, valid_from, valid_until
)
SELECT o.id, a.id, d.id, c.id,
       'QA: ограничение ударной нагрузки',
       'Синтетическая рекомендация QA. Ограничить беговые объёмы на 7 дней.',
       'load_restriction', 'moderate', 'coach_and_athlete', 'active',
       current_date, current_date + 7
FROM organizations o
JOIN users a ON a.email = 'qa.athlete.alpha1@sporteo-qa.dev'
JOIN users d ON d.email = 'qa.doctor.alpha@sporteo-qa.dev'
JOIN users c ON c.email = 'qa.coach.alpha1@sporteo-qa.dev'
WHERE o.org_slug = 'qa-club-alpha'
  AND NOT EXISTS (
    SELECT 1 FROM recommendations r
    WHERE r.athlete_id = a.id AND r.title = 'QA: ограничение ударной нагрузки'
  );

-- Alpha-2 намеренно остаётся с пустой историей (empty-state сценарии).
