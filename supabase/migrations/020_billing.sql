-- ─── 020_billing.sql — Billing foundation for subscriptions + coach marketplace
-- Tables: subscriptions (plan tier), coach_services (offers), coach_orders
-- (athlete purchases a coach service), payments (low-level Stripe payment
-- intents), invoices (issued documents).
--
-- Idempotent: safe to run multiple times. After applying, run:
--   NOTIFY pgrst, 'reload schema';

-- ─── plan_tier enum ──────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.plan_tier AS ENUM ('free', 'pro', 'team');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM (
    'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM (
    'pending', 'paid', 'fulfilled', 'refunded', 'cancelled', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM (
    'requires_payment_method', 'requires_confirmation', 'requires_action',
    'processing', 'succeeded', 'canceled', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── subscriptions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan                   plan_tier    NOT NULL DEFAULT 'free',
  status                 subscription_status NOT NULL DEFAULT 'active',
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean      NOT NULL DEFAULT false,
  expires_at             timestamptz,
  created_at             timestamptz  NOT NULL DEFAULT now(),
  updated_at             timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx
  ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_idx
  ON public.subscriptions (stripe_customer_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_read_own ON public.subscriptions;
CREATE POLICY subscriptions_read_own
  ON public.subscriptions FOR SELECT
  USING (user_id = public.get_my_user_id());

-- Only service role can insert/update (via webhook).
DROP POLICY IF EXISTS subscriptions_service_write ON public.subscriptions;
CREATE POLICY subscriptions_service_write
  ON public.subscriptions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── coach_services ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_services (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title          text        NOT NULL,
  description    text,
  price_amount   integer     NOT NULL CHECK (price_amount >= 0),
  currency       text        NOT NULL DEFAULT 'RUB',
  duration_days  integer,
  format         text,
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_services_coach_idx
  ON public.coach_services (coach_id, is_active);

ALTER TABLE public.coach_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_services_read_active ON public.coach_services;
CREATE POLICY coach_services_read_active
  ON public.coach_services FOR SELECT
  USING (is_active = true OR coach_id = public.get_my_user_id());

DROP POLICY IF EXISTS coach_services_write_own ON public.coach_services;
CREATE POLICY coach_services_write_own
  ON public.coach_services FOR ALL
  USING (coach_id = public.get_my_user_id())
  WITH CHECK (coach_id = public.get_my_user_id());

-- ─── coach_orders ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_orders (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id       uuid         NOT NULL REFERENCES public.coach_services(id) ON DELETE RESTRICT,
  coach_id         uuid         NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  athlete_id       uuid         NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status           order_status NOT NULL DEFAULT 'pending',
  price_amount     integer      NOT NULL CHECK (price_amount >= 0),
  currency         text         NOT NULL DEFAULT 'RUB',
  stripe_session_id text,
  paid_at          timestamptz,
  fulfilled_at     timestamptz,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_orders_coach_idx   ON public.coach_orders (coach_id);
CREATE INDEX IF NOT EXISTS coach_orders_athlete_idx ON public.coach_orders (athlete_id);
CREATE INDEX IF NOT EXISTS coach_orders_status_idx  ON public.coach_orders (status);

ALTER TABLE public.coach_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_orders_read_party ON public.coach_orders;
CREATE POLICY coach_orders_read_party
  ON public.coach_orders FOR SELECT
  USING (
    coach_id   = public.get_my_user_id() OR
    athlete_id = public.get_my_user_id()
  );

DROP POLICY IF EXISTS coach_orders_athlete_create ON public.coach_orders;
CREATE POLICY coach_orders_athlete_create
  ON public.coach_orders FOR INSERT
  WITH CHECK (athlete_id = public.get_my_user_id());

DROP POLICY IF EXISTS coach_orders_service_update ON public.coach_orders;
CREATE POLICY coach_orders_service_update
  ON public.coach_orders FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── payments (low-level Stripe intents) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id                        uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid           NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id                  uuid           REFERENCES public.coach_orders(id) ON DELETE SET NULL,
  subscription_id           uuid           REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  stripe_payment_intent_id  text,
  stripe_session_id         text,
  amount                    integer        NOT NULL CHECK (amount >= 0),
  currency                  text           NOT NULL DEFAULT 'RUB',
  status                    payment_status NOT NULL DEFAULT 'requires_payment_method',
  raw                       jsonb,
  created_at                timestamptz    NOT NULL DEFAULT now(),
  updated_at                timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_user_idx             ON public.payments (user_id);
CREATE INDEX IF NOT EXISTS payments_stripe_intent_idx    ON public.payments (stripe_payment_intent_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_read_own ON public.payments;
CREATE POLICY payments_read_own
  ON public.payments FOR SELECT
  USING (user_id = public.get_my_user_id());

DROP POLICY IF EXISTS payments_service_write ON public.payments;
CREATE POLICY payments_service_write
  ON public.payments FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── invoices ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  payment_id         uuid        REFERENCES public.payments(id) ON DELETE SET NULL,
  stripe_invoice_id  text,
  number             text,
  amount             integer     NOT NULL CHECK (amount >= 0),
  currency           text        NOT NULL DEFAULT 'RUB',
  hosted_invoice_url text,
  pdf_url            text,
  status             text        NOT NULL DEFAULT 'open',
  issued_at          timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_user_idx ON public.invoices (user_id);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoices_read_own ON public.invoices;
CREATE POLICY invoices_read_own
  ON public.invoices FOR SELECT
  USING (user_id = public.get_my_user_id());

DROP POLICY IF EXISTS invoices_service_write ON public.invoices;
CREATE POLICY invoices_service_write
  ON public.invoices FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── updated_at triggers ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql AS $fn$
  BEGIN
    NEW.updated_at := now();
    RETURN NEW;
  END $fn$;
EXCEPTION WHEN others THEN NULL; END $$;

DROP TRIGGER IF EXISTS subscriptions_set_updated  ON public.subscriptions;
CREATE TRIGGER subscriptions_set_updated  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS coach_services_set_updated ON public.coach_services;
CREATE TRIGGER coach_services_set_updated BEFORE UPDATE ON public.coach_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS coach_orders_set_updated   ON public.coach_orders;
CREATE TRIGGER coach_orders_set_updated   BEFORE UPDATE ON public.coach_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS payments_set_updated       ON public.payments;
CREATE TRIGGER payments_set_updated       BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

NOTIFY pgrst, 'reload schema';
