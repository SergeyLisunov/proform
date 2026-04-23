-- ──────────────────────────────────────────────────────────────────────────
-- 028_athlete_passes_stripe.sql
-- Track which Stripe checkout session issued each pass so the webhook
-- handler is idempotent. Applied to prod.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE athlete_passes
  ADD COLUMN IF NOT EXISTS stripe_session_id text UNIQUE;

NOTIFY pgrst, 'reload schema';
