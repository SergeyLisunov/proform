-- ──────────────────────────────────────────────────────────────────────────
-- 046_subscriptions_stripe_columns.sql
--
-- Adds the Stripe-side columns to the existing subscriptions table.
-- Migration 014 (crm_subscriptions_events) created the table with
-- (plan, status, price_usd, started_at, expires_at, cancelled_at) only.
-- The 020_billing.sql in repo was never applied — its
-- `CREATE TABLE IF NOT EXISTS` would have skipped the existing table
-- without adding the new columns.
--
-- Code in /api/webhooks/stripe and /api/billing/* expects:
--   stripe_customer_id, stripe_subscription_id, current_period_end,
--   cancel_at_period_end, updated_at
-- and a UNIQUE(user_id) constraint for ON CONFLICT upsert.
--
-- plan/status remain text (not ENUM) — runtime values come from Stripe
-- as strings and the existing data is text; converting is invasive
-- and not required for typecheck or correctness.
--
-- Applied to prod project hhyjihbctidtucvpgjzv 2026-04-28.
-- Idempotent. Safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id     text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS current_period_end     timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end   boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at             timestamptz  NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_idx
  ON subscriptions (stripe_customer_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_subscription_idx
  ON subscriptions (stripe_subscription_id);

-- Guard: cannot add UNIQUE(user_id) if duplicates exist. Fail loud.
DO $$
DECLARE
  dup_count int;
BEGIN
  SELECT COUNT(*) INTO dup_count
    FROM (SELECT user_id FROM subscriptions GROUP BY user_id HAVING COUNT(*) > 1) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'subscriptions has % users with multiple rows; dedupe before re-running', dup_count;
  END IF;
END $$;

DO $$ BEGIN
  ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN duplicate_table  THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION trg_subscriptions_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION trg_subscriptions_updated_at();

NOTIFY pgrst, 'reload schema';
