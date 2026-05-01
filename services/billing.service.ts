/**
 * Billing service — provider-agnostic helpers for tariff catalog,
 * subscription lookup, and idempotent checkout creation.
 *
 * Foundation PR scope (Sprint W2 Day 7):
 *   - listTariffs() — read-public tariff catalog (RLS allows anyone)
 *   - getMySubscription() — current user's subscription row (any provider)
 *   - createPaymentIntent() — creates `payments` row in pending state and
 *     calls the chosen provider's `createCheckout`. Does NOT modify
 *     subscriptions; activation happens via webhook (PR #23).
 *
 * What's NOT in this PR (lands in #23/#24):
 *   - Subscription activation on `payment.succeeded` (currently the
 *     webhook just logs to payment_events; PR #23 dispatches activation)
 *   - Trial period UI + countdowns
 *   - Cancel-at-period-end UX
 *   - Email notifications
 *
 * The provider boundary is intentional: this service NEVER touches
 * Stripe SDK or YooKassa SDK directly — it goes through the
 * PaymentProvider interface in lib/payments. Tests can swap a mock
 * provider in.
 */
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/payments'
import type { CheckoutInput, CheckoutResult, ProviderId, Currency } from '@/lib/payments/provider'
import type { Database } from '@/types/database'

type TariffRow = Database['public']['Tables']['tariffs']['Row']
type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row']

export interface Tariff {
  id: string
  code: string
  name: string
  description: string | null
  priceCents: number
  currency: Currency
  billingPeriod: 'monthly' | 'yearly' | 'one_time'
  trialDays: number
  maxAthletes: number | null
  features: string[]
  targetRole: 'athlete' | 'coach' | 'specialist' | 'organization' | 'any'
  displayOrder: number
}

function rowToTariff(r: TariffRow): Tariff {
  return {
    id:           r.id,
    code:         r.code,
    name:         r.name,
    description:  r.description,
    priceCents:   r.price_cents,
    currency:     r.currency as Currency,
    billingPeriod: r.billing_period as Tariff['billingPeriod'],
    trialDays:    r.trial_days,
    maxAthletes:  r.max_athletes,
    features:     Array.isArray(r.features) ? (r.features as string[]) : [],
    targetRole:   r.target_role as Tariff['targetRole'],
    displayOrder: r.display_order,
  }
}

/** Public tariff catalog. RLS allows anonymous reads of `is_active=true`. */
export async function listTariffs(): Promise<Tariff[]> {
  const sb = await createClient()
  const { data } = await sb
    .from('tariffs')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
  return ((data ?? []) as TariffRow[]).map(rowToTariff)
}

/** Current user's subscription row, or null. */
export async function getMySubscription(userId: string): Promise<SubscriptionRow | null> {
  const sb = await createClient()
  const { data } = await sb
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as SubscriptionRow | null) ?? null
}

export interface CreatePaymentIntentInput {
  /** Internal user_id */
  userId: string
  tariffCode: string
  /** ИЛИ 'stripe', 'yookassa' — defaults from PAYMENTS_PROVIDER env */
  provider: Exclude<ProviderId, 'manual'>
  /** URL ЮKassa redirects user back to after pay/cancel */
  returnUrl: string
}

/**
 * Creates a `payments` row in pending status, calls the provider, and
 * returns the confirmation URL. Idempotency is implicit: caller is
 * expected to NOT call twice for the same logical operation. If the
 * provider call fails, the pending row remains — webhook will not see
 * a corresponding success and a janitor (PR #24) can clean up after
 * 1h timeout.
 */
export async function createPaymentIntent(
  input: CreatePaymentIntentInput,
): Promise<CheckoutResult & { paymentId: string }> {
  const sb = await createClient()

  // Step 1: load tariff (we never trust client-supplied amount)
  const { data: tariffRaw } = await sb
    .from('tariffs')
    .select('*')
    .eq('code', input.tariffCode)
    .eq('is_active', true)
    .maybeSingle()
  const tariff = tariffRaw as TariffRow | null
  if (!tariff) throw new Error(`TARIFF_NOT_FOUND: ${input.tariffCode}`)

  if (tariff.price_cents === 0) {
    throw new Error('TARIFF_FREE_NO_CHECKOUT — Free tier needs no payment')
  }

  // Step 2: create pending payments row (admin client so service-role
  // inserts pass — payments has RLS service-only writes for provider
  // events).
  const paymentId = randomUUID()
  const idempotenceKey = randomUUID()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await (sb as any).from('payments').insert({
    id:                  paymentId,
    user_id:             input.userId,
    amount:              tariff.price_cents,
    currency:            tariff.currency,
    status:              'requires_payment_method',
    raw:                 { tariff_code: tariff.code, idempotence_key: idempotenceKey },
  })
  if (insertErr) {
    throw new Error(`PAYMENTS_INSERT_FAILED: ${insertErr.message}`)
  }

  // Step 3: call provider
  const provider = getProvider(input.provider)
  const checkoutInput: CheckoutInput = {
    userId:         input.userId,
    tariffCode:     tariff.code,
    paymentId,
    amountCents:    tariff.price_cents,
    currency:       tariff.currency as Currency,
    description:    `${tariff.name} · ${tariff.billing_period === 'monthly' ? 'месяц' : tariff.billing_period}`,
    returnUrl:      input.returnUrl,
    recurring:      tariff.billing_period === 'monthly' || tariff.billing_period === 'yearly',
    idempotenceKey,
    metadata: {
      tariff_id: tariff.id,
    },
  }
  const result = await provider.createCheckout(checkoutInput)

  // Step 4: associate provider_payment_id with our row so webhook can
  // join. Stored in raw.provider_payment_id — full denormalisation
  // (separate column) lands in PR #24 with subscription activation.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb as any).from('payments')
    .update({
      raw: {
        tariff_code: tariff.code,
        idempotence_key: idempotenceKey,
        provider_payment_id: result.providerPaymentId,
        provider: input.provider,
        confirmation_url: result.confirmationUrl,
      },
    })
    .eq('id', paymentId)

  return { ...result, paymentId }
}
