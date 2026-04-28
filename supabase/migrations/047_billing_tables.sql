-- ──────────────────────────────────────────────────────────────────────────
-- 047_billing_tables.sql
--
-- Creates the four billing tables that the code expects but were never
-- on prod: coach_services, coach_orders, payments, invoices. Extracted
-- from the never-applied 020_billing.sql, minus the subscriptions
-- block (handled by migration 046).
--
-- Status text columns instead of ENUMs to match existing patterns
-- (coach_pass_plans, athlete_passes etc. all use text+CHECK), and to
-- avoid a non-trivial type-conversion migration for subscriptions.
--
-- Applied to prod project hhyjihbctidtucvpgjzv 2026-04-28.
-- Idempotent. Safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coach_services (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  ON coach_services (coach_id, is_active);

ALTER TABLE coach_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS coach_services_read_active ON coach_services;
CREATE POLICY coach_services_read_active ON coach_services
  FOR SELECT USING (is_active = true OR coach_id = (SELECT get_my_user_id()));
DROP POLICY IF EXISTS coach_services_write_own ON coach_services;
CREATE POLICY coach_services_write_own ON coach_services
  FOR ALL USING (coach_id = (SELECT get_my_user_id()))
           WITH CHECK (coach_id = (SELECT get_my_user_id()));

CREATE TABLE IF NOT EXISTS coach_orders (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id        uuid        NOT NULL REFERENCES coach_services(id) ON DELETE RESTRICT,
  coach_id          uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  athlete_id        uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status            text        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','paid','fulfilled','refunded','cancelled','failed')),
  price_amount      integer     NOT NULL CHECK (price_amount >= 0),
  currency          text        NOT NULL DEFAULT 'RUB',
  stripe_session_id text,
  paid_at           timestamptz,
  fulfilled_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coach_orders_coach_idx   ON coach_orders (coach_id);
CREATE INDEX IF NOT EXISTS coach_orders_athlete_idx ON coach_orders (athlete_id);
CREATE INDEX IF NOT EXISTS coach_orders_status_idx  ON coach_orders (status);

ALTER TABLE coach_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS coach_orders_read_party ON coach_orders;
CREATE POLICY coach_orders_read_party ON coach_orders
  FOR SELECT USING (
    coach_id   = (SELECT get_my_user_id()) OR
    athlete_id = (SELECT get_my_user_id())
  );
DROP POLICY IF EXISTS coach_orders_athlete_create ON coach_orders;
CREATE POLICY coach_orders_athlete_create ON coach_orders
  FOR INSERT WITH CHECK (athlete_id = (SELECT get_my_user_id()));
DROP POLICY IF EXISTS coach_orders_service_update ON coach_orders;
CREATE POLICY coach_orders_service_update ON coach_orders
  FOR UPDATE USING (auth.role() = 'service_role')
             WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS payments (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id                 uuid        REFERENCES coach_orders(id) ON DELETE SET NULL,
  subscription_id          uuid        REFERENCES subscriptions(id) ON DELETE SET NULL,
  stripe_payment_intent_id text,
  stripe_session_id        text,
  amount                   integer     NOT NULL CHECK (amount >= 0),
  currency                 text        NOT NULL DEFAULT 'RUB',
  status                   text        NOT NULL DEFAULT 'requires_payment_method'
                            CHECK (status IN ('requires_payment_method','requires_confirmation',
                                              'requires_action','processing','succeeded',
                                              'canceled','failed')),
  raw                      jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_user_idx          ON payments (user_id);
CREATE INDEX IF NOT EXISTS payments_stripe_intent_idx ON payments (stripe_payment_intent_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payments_read_own ON payments;
CREATE POLICY payments_read_own ON payments
  FOR SELECT USING (user_id = (SELECT get_my_user_id()));
DROP POLICY IF EXISTS payments_service_write ON payments;
CREATE POLICY payments_service_write ON payments
  FOR ALL USING (auth.role() = 'service_role')
           WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS invoices (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_id         uuid        REFERENCES payments(id) ON DELETE SET NULL,
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
CREATE INDEX IF NOT EXISTS invoices_user_idx ON invoices (user_id);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoices_read_own ON invoices;
CREATE POLICY invoices_read_own ON invoices
  FOR SELECT USING (user_id = (SELECT get_my_user_id()));
DROP POLICY IF EXISTS invoices_service_write ON invoices;
CREATE POLICY invoices_service_write ON invoices
  FOR ALL USING (auth.role() = 'service_role')
           WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION trg_billing_touch_updated() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_coach_services_updated ON coach_services;
CREATE TRIGGER trg_coach_services_updated BEFORE UPDATE ON coach_services
  FOR EACH ROW EXECUTE FUNCTION trg_billing_touch_updated();
DROP TRIGGER IF EXISTS trg_coach_orders_updated ON coach_orders;
CREATE TRIGGER trg_coach_orders_updated BEFORE UPDATE ON coach_orders
  FOR EACH ROW EXECUTE FUNCTION trg_billing_touch_updated();
DROP TRIGGER IF EXISTS trg_payments_updated ON payments;
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION trg_billing_touch_updated();

NOTIFY pgrst, 'reload schema';
