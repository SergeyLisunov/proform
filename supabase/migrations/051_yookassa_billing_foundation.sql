-- ──────────────────────────────────────────────────────────────────────────
-- 051_yookassa_billing_foundation.sql
-- Sprint W2 Day 7 (re-scoped from Stripe Connect to ЮKassa):
-- foundation для multi-provider billing (Stripe + ЮKassa coexist).
--
-- Что добавляется:
--   1. tariffs — каталог тарифов в БД (raw текущая модель в Paywall.tsx
--      шила tiers как const; вынесли в БД для A/B тестов цен и для
--      провайдер-агностичной логики).
--   2. subscriptions — расширена ЮKassa-специфичными полями
--      + универсальное `provider` поле + `trial_ends_at` /
--      `current_period_start` (отсутствовали).
--   3. payment_events — лог webhook-событий (idempotency на уровне БД
--      через UNIQUE на provider+event_id, как требует ЮKassa
--      retry-policy 24h).
--
-- НЕ ломает существующую Stripe-интеграцию: новые колонки nullable
-- с фолбеком на старое поведение. Существующие subscriptions row
-- получают `provider='stripe'` через DEFAULT.
--
-- 5 тарифов засеваются — соответствуют revised audit-модели
-- (4 selling personas: free, pro_athlete, pro_trainer, pro_specialist,
-- team_trainer, club). На прод деплое они появятся сразу.
--
-- Применяется к prod через Supabase MCP.
-- ──────────────────────────────────────────────────────────────────────────

-- 1. tariffs ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tariffs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  name            text NOT NULL,
  description     text,
  price_cents     integer NOT NULL CHECK (price_cents >= 0),
  currency        text NOT NULL DEFAULT 'RUB',
  billing_period  text NOT NULL CHECK (billing_period IN ('monthly','yearly','one_time')),
  trial_days      integer NOT NULL DEFAULT 0 CHECK (trial_days >= 0 AND trial_days <= 90),
  max_athletes    integer,
  max_teams       integer,
  max_coaches     integer,
  features        jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_role     text NOT NULL CHECK (target_role IN
                    ('athlete','coach','specialist','organization','any')),
  display_order   integer NOT NULL DEFAULT 100,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tariffs_active_order
  ON tariffs(is_active, display_order) WHERE is_active = true;

ALTER TABLE tariffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tariffs_public_read ON tariffs;
CREATE POLICY tariffs_public_read ON tariffs
  FOR SELECT USING (is_active = true);

-- 2. subscriptions extensions ---------------------------------------------
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS provider                       text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS yookassa_payment_method_id     text,
  ADD COLUMN IF NOT EXISTS trial_ends_at                  timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_start           timestamptz,
  ADD COLUMN IF NOT EXISTS tariff_code                    text;

ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_provider_check;
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_provider_check
  CHECK (provider IN ('stripe','yookassa','manual'));

CREATE INDEX IF NOT EXISTS idx_subscriptions_provider
  ON subscriptions(provider, status);

-- 3. payment_events --------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            text NOT NULL CHECK (provider IN ('stripe','yookassa')),
  event_type          text NOT NULL,
  provider_event_id   text NOT NULL,
  provider_payment_id text,
  payload             jsonb NOT NULL,
  processed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_events_provider_payment
  ON payment_events(provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_events_unprocessed
  ON payment_events(processed_at) WHERE processed_at IS NULL;

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
-- Service-role only writes/reads. No user-side RLS — only admin client
-- (createAdminClient) inside webhook + service worker reach this table.
DROP POLICY IF EXISTS payment_events_service_only ON payment_events;
CREATE POLICY payment_events_service_only ON payment_events
  FOR ALL USING (auth.role() = 'service_role')
           WITH CHECK (auth.role() = 'service_role');

-- 4. Seed tariffs (revised audit 6-tier model) -----------------------------
INSERT INTO tariffs (code, name, description, price_cents, currency, billing_period, trial_days, max_athletes, target_role, display_order, features)
VALUES
  ('free',           'Free',
    'Для начала. 10 тренировок в месяц, базовый профиль, базовый календарь.',
    0,      'RUB', 'monthly', 0,  NULL,  'any',          10,
    '["10 тренировок/мес","Календарь","Базовый профиль","3 AI-запроса/мес"]'::jsonb),
  ('pro_athlete',    'Pro Athlete',
    'Solo athlete: безлимит тренировок, AI-coach, wearable sync.',
    59900,  'RUB', 'monthly', 7,  NULL,  'athlete',      20,
    '["Безлимит тренировок","AI до 30/день","Wearable sync (Whoop, Apple Health)","Мессенджер с тренером","Тренировочные циклы","Экспорт данных"]'::jsonb),
  ('pro_specialist', 'Pro Specialist',
    'Solo doctor / physio / massage / nutrition: медкарта, AI-сводка, продажа консультаций.',
    99900,  'RUB', 'monthly', 7,  NULL,  'specialist',   30,
    '["Doctor Diary","AI medical-summary","Связь с тренером (restrictions)","Продажа консультаций через checkout","Privacy-controlled medical records"]'::jsonb),
  ('pro_trainer',    'Pro Trainer',
    'Тренер с группой до 10 атлетов: Adaptive Plan + Briefing + продажа passes.',
    149900, 'RUB', 'monthly', 14, 10,    'coach',        40,
    '["До 10 атлетов","Adaptive Plan (AI rewrites assigned workouts)","Coach Briefing (AI daily team snapshot)","Templates","Продажа абонементов","Athlete CRM"]'::jsonb),
  ('team_trainer',   'Team Trainer',
    'Тренер с командой до 25 атлетов: bulk-prescribe, completion KPIs, priority.',
    299900, 'RUB', 'monthly', 14, 25,    'coach',        50,
    '["До 25 атлетов","Всё из Pro Trainer","Bulk-prescribe","Completion rate KPIs","Priority support"]'::jsonb),
  ('club',           'Club',
    'Спортшкола / клуб: unlimited staff + multi-team + Newsletter + KPI dashboard.',
    999000, 'RUB', 'monthly', 30, NULL,  'organization', 60,
    '["Unlimited coaches/athletes","Multi-team + age groups","Newsletter SEND через Resend","Doctor seats included","Club KPI dashboard","Return-to-play workflow","Bulk-staff invite"]'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  trial_days = EXCLUDED.trial_days,
  max_athletes = EXCLUDED.max_athletes,
  target_role = EXCLUDED.target_role,
  display_order = EXCLUDED.display_order,
  features = EXCLUDED.features,
  updated_at = now();

-- 5. Trigger to auto-update updated_at on tariffs --------------------------
CREATE OR REPLACE FUNCTION trg_tariffs_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_tariffs_updated_at ON tariffs;
CREATE TRIGGER trg_tariffs_updated_at BEFORE UPDATE ON tariffs
  FOR EACH ROW EXECUTE FUNCTION trg_tariffs_updated_at();

NOTIFY pgrst, 'reload schema';
