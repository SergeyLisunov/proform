-- ──────────────────────────────────────────────────────────────────────────
-- 096_alfabank_provider_and_billing_constraints.sql  (P2)
--
-- 1. Провайдер 'alfabank' в CHECK-констрейнтах subscriptions/payment_events.
-- 2. ФИКС ЛАТЕНТНЫХ БОМБ, найденных при живой проверке pg_constraint:
--    - subscriptions_plan_check разрешал только ('free','pro','team'), а
--      вебхук пишет plan = tariff.code ('pro_trainer', 'club', ...) —
--      активация ЛЮБОЙ реальной подписки упала бы на constraint.
--    - subscriptions_status_check не знал 'trialing'/'past_due', которые
--      пишет вебхук и читает lib/plans.ts.
--    - payments_status_check не знал 'refunded', который пишет
--      markPaymentRefunded.
-- 3. Денормализация payments.provider + payments.provider_payment_id
--    (раньше жили только в raw JSONB; вебхук фильтровал по raw->>...).
-- Applied to prod.
-- ──────────────────────────────────────────────────────────────────────────

-- 1/2. subscriptions: provider + status + plan
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_provider_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_provider_check
  CHECK (provider = ANY (ARRAY['stripe'::text, 'yookassa'::text, 'alfabank'::text, 'manual'::text]));

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status = ANY (ARRAY[
    'active'::text, 'trial'::text, 'trialing'::text, 'past_due'::text,
    'cancelled'::text, 'expired'::text, 'blocked'::text, 'manual_review'::text
  ]));

-- plan — legacy-зеркало tariff_code: значения = коды тарифов из таблицы
-- tariffs (расширяемый каталог). Enum в CHECK гарантированно отстаёт от
-- каталога (как notifications.type до 084) — снимаем совсем; парсинг и
-- ранжирование планов централизованы в lib/plans.ts.
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

-- payment_events: provider
ALTER TABLE public.payment_events DROP CONSTRAINT IF EXISTS payment_events_provider_check;
ALTER TABLE public.payment_events ADD CONSTRAINT payment_events_provider_check
  CHECK (provider = ANY (ARRAY['stripe'::text, 'yookassa'::text, 'alfabank'::text]));

-- payments: status ('refunded' пишется вебхуком; 'pending' — на будущее)
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check
  CHECK (status = ANY (ARRAY[
    'requires_payment_method'::text, 'requires_confirmation'::text,
    'requires_action'::text, 'processing'::text, 'pending'::text,
    'succeeded'::text, 'canceled'::text, 'failed'::text, 'refunded'::text
  ]));

-- 3. Денормализация provider-колонок + бэкфилл из raw JSONB
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider            text,
  ADD COLUMN IF NOT EXISTS provider_payment_id text;

UPDATE public.payments
SET provider            = COALESCE(provider, raw->>'provider'),
    provider_payment_id = COALESCE(provider_payment_id, raw->>'provider_payment_id')
WHERE (provider IS NULL AND raw->>'provider' IS NOT NULL)
   OR (provider_payment_id IS NULL AND raw->>'provider_payment_id' IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_payments_provider_payment_id
  ON public.payments (provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
