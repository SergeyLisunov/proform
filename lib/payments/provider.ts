/**
 * Payment provider abstraction — Sprint W2 Day 7 (re-scoped to ЮKassa).
 *
 * The platform supports multiple payment providers in production:
 * Stripe (legacy, USD/EUR markets, kept untouched) and ЮKassa (RU/CIS
 * primary, recurring + 54-ФЗ + СБП). Future: Альфа-Банк as backup.
 *
 * Routes (api/billing/checkout, api/webhooks/*) talk to a provider via
 * this interface so business logic stays gateway-agnostic. Adding a
 * new gateway = new file under `lib/payments/<name>.ts` + register in
 * `lib/payments/index.ts`. No changes in route handlers.
 *
 * Design notes:
 * - Amounts in CENTS (kopeks for RUB) to avoid floats. ЮKassa API
 *   accepts decimal strings; we convert on the way in.
 * - Idempotence keys are caller-supplied so we can reuse the same key
 *   on retries without re-charging.
 * - Webhook handlers return a structured `WebhookResult` that the
 *   route layer maps to side-effects (subscription activation, refund
 *   processing, etc).
 */

export type ProviderId = 'stripe' | 'yookassa' | 'manual'

export type Currency = 'RUB' | 'USD' | 'EUR' | 'KZT'

export type PaymentStatus =
  | 'pending'
  | 'waiting_for_capture'
  | 'succeeded'
  | 'canceled'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired'
  | 'blocked'
  | 'manual_review'

export interface CheckoutInput {
  /** Internal user_id — used for metadata mapping back from provider */
  userId: string
  /** Internal tariff code (e.g. `pro_trainer`, `club`) */
  tariffCode: string
  /** Internal payment row id (we created `pending` row before calling provider) */
  paymentId: string
  amountCents: number
  currency: Currency
  description: string
  /** Where the payment provider redirects user after pay/cancel */
  returnUrl: string
  /** True if subscription with auto-renew (saves payment method) */
  recurring: boolean
  /** Idempotency key — one per logical create, retries reuse same value */
  idempotenceKey: string
  /** Pass-through metadata; provider stores it on transaction */
  metadata?: Record<string, string>
}

export interface CheckoutResult {
  /** Provider-side payment id (e.g. yookassa `payment.id`) */
  providerPaymentId: string
  /** URL the client should redirect to for actual payment */
  confirmationUrl: string
  /** True if the payment was already captured (rare, e.g. pre-saved card) */
  alreadyCaptured: boolean
}

export interface RefundInput {
  /** Provider payment id to refund */
  providerPaymentId: string
  /** Amount in cents to refund. NULL = full refund */
  amountCents?: number
  currency: Currency
  /** Idempotency key */
  idempotenceKey: string
  /** Reason for our records, may be passed to provider description */
  reason?: string
}

export interface RefundResult {
  providerRefundId: string
  status: PaymentStatus
}

export interface ChargeRecurringInput {
  /** Saved payment-method token (from earlier successful payment with save=true) */
  paymentMethodId: string
  /** Internal payment row id (we created pending row before calling) */
  paymentId: string
  amountCents: number
  currency: Currency
  description: string
  idempotenceKey: string
  metadata?: Record<string, string>
}

/**
 * Result of parsing an inbound webhook. Caller decides what side-effects
 * to apply based on `kind`.
 */
export type WebhookEventKind =
  | 'payment.succeeded'
  | 'payment.canceled'
  | 'payment.waiting_for_capture'
  | 'refund.succeeded'
  | 'payment_method.active'
  | 'unknown'

export interface WebhookResult {
  /** Whether the request looks legitimate (signature/IP verified) */
  verified: boolean
  /** Mapped event kind */
  kind: WebhookEventKind
  /** Idempotency key — caller checks `payment_events` UNIQUE on this */
  providerEventId: string | null
  /** Provider payment id this event refers to (if any) */
  providerPaymentId: string | null
  /** Raw object for downstream processing (saved to payment_events.payload) */
  raw: unknown
}

export interface PaymentProvider {
  readonly id: ProviderId

  /** True when env vars are present and the provider can be used. */
  isConfigured(): boolean

  /** Create a checkout session / payment URL for the user to pay. */
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>

  /** Charge a previously-saved payment method (recurring). */
  chargeRecurring(input: ChargeRecurringInput): Promise<CheckoutResult>

  /** Refund a previous payment (full or partial). */
  refund(input: RefundInput): Promise<RefundResult>

  /**
   * Parse + verify an incoming webhook. Caller passes the raw Request;
   * provider extracts headers/body. Idempotency is enforced upstream
   * via UNIQUE on (provider, provider_event_id) in payment_events.
   */
  parseWebhook(req: Request, rawBody: string): Promise<WebhookResult>
}
