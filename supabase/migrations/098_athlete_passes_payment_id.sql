-- ──────────────────────────────────────────────────────────────────────────
-- 098_athlete_passes_payment_id.sql  (P2 — идемпотентность маркетплейса)
--
-- Выдача абонемента по вебхуку payment.succeeded должна быть идемпотентна
-- ПО ПЛАТЕЖУ (не по plan_id+athlete — повторная покупка того же плана
-- легальна). Партиальный UNIQUE: повторный fulfill того же платежа
-- (replay processed_at IS NULL, дубль callback после частичного сбоя)
-- упирается в 23505 и трактуется как «уже выдано».
-- Applied to prod.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.athlete_passes
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_athlete_passes_payment
  ON public.athlete_passes (payment_id)
  WHERE payment_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
