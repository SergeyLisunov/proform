-- W10 Day 52: Drop Stripe legacy columns.
--
-- Stripe was removed in Sprint W6 (PR #45) due to RU/CIS market pivot.
-- The columns were left NULLable to avoid migration risk during the pivot.
-- 4 months later, no code references remain (grep services/ app/ → 0 hits).
-- Safe to drop.

ALTER TABLE subscriptions
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id;

ALTER TABLE payments
  DROP COLUMN IF EXISTS stripe_session_id,
  DROP COLUMN IF EXISTS stripe_payment_intent_id;

ALTER TABLE invoices
  DROP COLUMN IF EXISTS stripe_invoice_id;

NOTIFY pgrst, 'reload schema';
