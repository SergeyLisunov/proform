-- ──────────────────────────────────────────────────────────────────────────
-- 050_marketplace_multi_seller.sql
-- Sprint Week 2, Day 6 — open the marketplace to multi-seller (coach +
-- doctor/specialist subtypes: physio, massage, nutrition, psychiatry).
--
-- Rationale (from product audit v2): the existing marketplace
-- (coach_pass_plans, coach_services, coach_orders, athlete_passes)
-- is hardcoded coach→athlete. The audit's revised buyer model has 4
-- selling personas (coach + doctor/specialist with specialty
-- subtype), each able to publish offerings and sell them to athletes
-- in a unified catalog. New revenue stream: 10–15% platform fee on
-- every transaction (wired in Day 7 via Stripe Connect).
--
-- This migration is ADDITIVE and BACKWARDS-COMPATIBLE: existing
-- coaches keep working unchanged. New columns default to coach/role
-- values, so old rows look exactly like before. UI services begin
-- writing the explicit seller_role on every new offering.
--
-- Tables touched:
--   • coach_pass_plans  → seller_role, seller_specialty, service_type
--   • coach_services    → seller_role, seller_specialty, service_type
--   • athlete_passes    → seller_role, seller_specialty, service_type, platform_fee_cents
--   • coach_orders      → seller_role, seller_specialty, service_type, platform_fee_cents
--
-- We DON'T rename `coach_id` → `seller_id` (would force every query
-- in the codebase to migrate). Instead the column is now
-- semantically the "seller's user_id" regardless of role.
--
-- platform_fee_cents on issued passes/orders is for accounting after
-- Stripe Connect ships in Day 7. NULL on legacy rows = no fee taken.
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Reusable enum-like CHECK values, kept as text for parity with the
-- rest of the schema (ENUM migrations are noisy and pricing/specialty
-- evolves; text + check is sufficient).

-- 2. coach_pass_plans
ALTER TABLE coach_pass_plans
  ADD COLUMN IF NOT EXISTS seller_role      text NOT NULL DEFAULT 'coach',
  ADD COLUMN IF NOT EXISTS seller_specialty text,
  ADD COLUMN IF NOT EXISTS service_type     text NOT NULL DEFAULT 'training_pack';

ALTER TABLE coach_pass_plans
  DROP CONSTRAINT IF EXISTS coach_pass_plans_seller_role_check;
ALTER TABLE coach_pass_plans
  ADD CONSTRAINT coach_pass_plans_seller_role_check
  CHECK (seller_role IN ('coach', 'doctor', 'specialist'));

ALTER TABLE coach_pass_plans
  DROP CONSTRAINT IF EXISTS coach_pass_plans_seller_specialty_check;
ALTER TABLE coach_pass_plans
  ADD CONSTRAINT coach_pass_plans_seller_specialty_check
  CHECK (seller_specialty IS NULL OR seller_specialty IN
    ('physician','physio','massage','nutrition','psychiatry','other'));

ALTER TABLE coach_pass_plans
  DROP CONSTRAINT IF EXISTS coach_pass_plans_service_type_check;
ALTER TABLE coach_pass_plans
  ADD CONSTRAINT coach_pass_plans_service_type_check
  CHECK (service_type IN
    ('training_pack','consultation','massage_session','nutrition_plan',
     'physio_session','psychology_session','general'));

-- 3. coach_services
ALTER TABLE coach_services
  ADD COLUMN IF NOT EXISTS seller_role      text NOT NULL DEFAULT 'coach',
  ADD COLUMN IF NOT EXISTS seller_specialty text,
  ADD COLUMN IF NOT EXISTS service_type     text NOT NULL DEFAULT 'general';

ALTER TABLE coach_services
  DROP CONSTRAINT IF EXISTS coach_services_seller_role_check;
ALTER TABLE coach_services
  ADD CONSTRAINT coach_services_seller_role_check
  CHECK (seller_role IN ('coach','doctor','specialist'));

ALTER TABLE coach_services
  DROP CONSTRAINT IF EXISTS coach_services_seller_specialty_check;
ALTER TABLE coach_services
  ADD CONSTRAINT coach_services_seller_specialty_check
  CHECK (seller_specialty IS NULL OR seller_specialty IN
    ('physician','physio','massage','nutrition','psychiatry','other'));

ALTER TABLE coach_services
  DROP CONSTRAINT IF EXISTS coach_services_service_type_check;
ALTER TABLE coach_services
  ADD CONSTRAINT coach_services_service_type_check
  CHECK (service_type IN
    ('training_pack','consultation','massage_session','nutrition_plan',
     'physio_session','psychology_session','general'));

-- 4. athlete_passes (mirrored from plan at issue time + platform fee)
ALTER TABLE athlete_passes
  ADD COLUMN IF NOT EXISTS seller_role        text NOT NULL DEFAULT 'coach',
  ADD COLUMN IF NOT EXISTS seller_specialty   text,
  ADD COLUMN IF NOT EXISTS service_type       text NOT NULL DEFAULT 'training_pack',
  ADD COLUMN IF NOT EXISTS platform_fee_cents integer;

ALTER TABLE athlete_passes
  DROP CONSTRAINT IF EXISTS athlete_passes_seller_role_check;
ALTER TABLE athlete_passes
  ADD CONSTRAINT athlete_passes_seller_role_check
  CHECK (seller_role IN ('coach','doctor','specialist'));

ALTER TABLE athlete_passes
  DROP CONSTRAINT IF EXISTS athlete_passes_seller_specialty_check;
ALTER TABLE athlete_passes
  ADD CONSTRAINT athlete_passes_seller_specialty_check
  CHECK (seller_specialty IS NULL OR seller_specialty IN
    ('physician','physio','massage','nutrition','psychiatry','other'));

ALTER TABLE athlete_passes
  DROP CONSTRAINT IF EXISTS athlete_passes_service_type_check;
ALTER TABLE athlete_passes
  ADD CONSTRAINT athlete_passes_service_type_check
  CHECK (service_type IN
    ('training_pack','consultation','massage_session','nutrition_plan',
     'physio_session','psychology_session','general'));

ALTER TABLE athlete_passes
  DROP CONSTRAINT IF EXISTS athlete_passes_platform_fee_check;
ALTER TABLE athlete_passes
  ADD CONSTRAINT athlete_passes_platform_fee_check
  CHECK (platform_fee_cents IS NULL OR platform_fee_cents >= 0);

-- 5. coach_orders (mirrored from service at order time + platform fee)
ALTER TABLE coach_orders
  ADD COLUMN IF NOT EXISTS seller_role         text NOT NULL DEFAULT 'coach',
  ADD COLUMN IF NOT EXISTS seller_specialty    text,
  ADD COLUMN IF NOT EXISTS service_type        text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS platform_fee_amount integer;

ALTER TABLE coach_orders
  DROP CONSTRAINT IF EXISTS coach_orders_seller_role_check;
ALTER TABLE coach_orders
  ADD CONSTRAINT coach_orders_seller_role_check
  CHECK (seller_role IN ('coach','doctor','specialist'));

ALTER TABLE coach_orders
  DROP CONSTRAINT IF EXISTS coach_orders_seller_specialty_check;
ALTER TABLE coach_orders
  ADD CONSTRAINT coach_orders_seller_specialty_check
  CHECK (seller_specialty IS NULL OR seller_specialty IN
    ('physician','physio','massage','nutrition','psychiatry','other'));

ALTER TABLE coach_orders
  DROP CONSTRAINT IF EXISTS coach_orders_service_type_check;
ALTER TABLE coach_orders
  ADD CONSTRAINT coach_orders_service_type_check
  CHECK (service_type IN
    ('training_pack','consultation','massage_session','nutrition_plan',
     'physio_session','psychology_session','general'));

ALTER TABLE coach_orders
  DROP CONSTRAINT IF EXISTS coach_orders_platform_fee_check;
ALTER TABLE coach_orders
  ADD CONSTRAINT coach_orders_platform_fee_check
  CHECK (platform_fee_amount IS NULL OR platform_fee_amount >= 0);

-- 6. Catalog index — Day 9 will scan all active offerings across roles.
CREATE INDEX IF NOT EXISTS idx_coach_pass_plans_seller_active
  ON coach_pass_plans(seller_role, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_coach_services_seller_active
  ON coach_services(seller_role, is_active) WHERE is_active = true;

-- 7. RLS unchanged — `coach_id = get_my_user_id()` works for any
-- role. We're not gatekeeping by role at the DB level; the seller's
-- role is reflected in seller_role column, but the row owner is
-- still authenticated via the universal user_id check.

NOTIFY pgrst, 'reload schema';
