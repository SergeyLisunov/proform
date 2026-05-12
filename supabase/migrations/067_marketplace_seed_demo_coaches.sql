-- Sprint W6 Day 32 — Marketplace seeding + A/B test infrastructure.
--
-- Part 1: structural additions to users
-- Part 2: 5 demo coach accounts (locked passwords — no login)
-- Part 3: enrich public.users with demo flags + bio fields
-- Part 4: 2 coach_services per demo coach
--
-- Why "demo" rows live in production:
-- Marketplace lands dead-on-arrival without any sellers. Seeding gives
-- new users something to browse on day-1. The `is_demo=true` flag lets
-- us strip them from analytics + show a clear "Demo profile — coming
-- soon" tooltip when we're ready to swap for real sellers.

-- ── Part 1: structural additions ────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_demo     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_featured_coaches
  ON public.users (is_featured DESC, created_at DESC)
  WHERE role = 'coach' OR role = 'doctor' OR role = 'specialist';

COMMENT ON COLUMN public.users.is_demo IS
  'Sprint W6 Day 32: marker for seeded demo profiles in /marketplace catalog. Filter with WHERE is_demo=false for real-only analytics.';
COMMENT ON COLUMN public.users.is_featured IS
  'Sprint W6 Day 32: surface row on /marketplace featured carousel.';

-- ── Part 2: insert auth.users (trigger handle_new_auth_user creates
--    public.users automatically) ──────────────────────────────────────

DO $$
DECLARE
  seed JSONB := '[
    {"id":"d3000001-0000-4000-8000-000000000001","email":"demo-marathon@proform.test","name":"Анна Петрова",   "spec":"Бег на длинные дистанции, марафон, полумарафон","sport":"running","featured":true},
    {"id":"d3000001-0000-4000-8000-000000000002","email":"demo-swimming@proform.test","name":"Олег Кузнецов","spec":"Плавание вольный стиль, открытая вода","sport":"swimming","featured":true},
    {"id":"d3000001-0000-4000-8000-000000000003","email":"demo-strength@proform.test","name":"Михаил Соколов","spec":"Силовая подготовка, пауэрлифтинг","sport":"strength","featured":false},
    {"id":"d3000001-0000-4000-8000-000000000004","email":"demo-yoga@proform.test","name":"Елена Орлова",   "spec":"Йога, mindfulness, восстановление атлетов","sport":"yoga","featured":false},
    {"id":"d3000001-0000-4000-8000-000000000005","email":"demo-triathlon@proform.test","name":"Сергей Иванов","spec":"Триатлон Olympic/Half/Full distance","sport":"triathlon","featured":false}
  ]'::jsonb;
  c JSONB;
BEGIN
  FOR c IN SELECT jsonb_array_elements(seed) LOOP
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      (c->>'id')::uuid,
      'authenticated', 'authenticated',
      c->>'email',
      crypt('LOCKED-' || md5(c->>'email'), gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', c->>'name', 'role', 'coach'),
      now(), now(), '', '', '', ''
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;
END
$$;

-- ── Part 3: enrich public.users with demo flags + bio fields ────────

DO $$
DECLARE
  seed JSONB := '[
    {"id":"d3000001-0000-4000-8000-000000000001","spec":"Бег на длинные дистанции, марафон, полумарафон","sport":"running",  "featured":true},
    {"id":"d3000001-0000-4000-8000-000000000002","spec":"Плавание вольный стиль, открытая вода",        "sport":"swimming", "featured":true},
    {"id":"d3000001-0000-4000-8000-000000000003","spec":"Силовая подготовка, пауэрлифтинг",             "sport":"strength", "featured":false},
    {"id":"d3000001-0000-4000-8000-000000000004","spec":"Йога, mindfulness, восстановление атлетов",    "sport":"yoga",     "featured":false},
    {"id":"d3000001-0000-4000-8000-000000000005","spec":"Триатлон Olympic/Half/Full distance",          "sport":"triathlon","featured":false}
  ]'::jsonb;
  c JSONB;
BEGIN
  FOR c IN SELECT jsonb_array_elements(seed) LOOP
    UPDATE public.users
       SET coach_specialization = c->>'spec',
           sport                = c->>'sport',
           is_demo              = true,
           is_featured          = (c->>'featured')::boolean,
           bio                  = '[Demo профиль] ' || (c->>'spec') || '. Скоро здесь будут реальные тренеры.'
     WHERE auth_id = (c->>'id')::uuid;
  END LOOP;
END
$$;

-- ── Part 4: seed coach_services (2 services per coach) ───────────────

INSERT INTO public.coach_services (coach_id, title, description, price_amount, currency, service_type, format, duration_days, seller_role)
SELECT u.id,
       'Разовая консультация · ' || split_part(u.name, ' ', 1),
       'Видео-разбор тренировочной программы и плана подготовки. 60 минут.',
       3500, 'RUB', 'consultation', 'online', NULL, 'coach'
FROM public.users u
WHERE u.is_demo = true AND u.role = 'coach'
ON CONFLICT DO NOTHING;

INSERT INTO public.coach_services (coach_id, title, description, price_amount, currency, service_type, format, duration_days, seller_role)
SELECT u.id,
       'Месячный план тренировок · ' || split_part(u.name, ' ', 1),
       'Индивидуальная программа на 4 недели + еженедельные правки. ' || COALESCE(u.coach_specialization, ''),
       12000, 'RUB', 'training_pack', 'online', 30, 'coach'
FROM public.users u
WHERE u.is_demo = true AND u.role = 'coach'
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
