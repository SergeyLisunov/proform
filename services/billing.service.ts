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
 * the YooKassa SDK directly — it goes through the PaymentProvider
 * interface in lib/payments. Tests can swap a mock provider in.
 * (Sprint W6 Day 28: Stripe was removed; ЮKassa is the sole provider.)
 */
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProvider, getDefaultProvider } from '@/lib/payments'
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

/**
 * Toggle cancel_at_period_end. The user keeps access until
 * `current_period_end`, then status flips to 'cancelled' via webhook
 * or cron. Reactivate by setting cancel_at_period_end = false.
 */
export async function setSubscriptionCancelAtPeriodEnd(
  userId: string,
  cancel: boolean,
): Promise<SubscriptionRow | null> {
  const sb = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('subscriptions')
    .update({
      cancel_at_period_end: cancel,
      cancelled_at: cancel ? new Date().toISOString() : null,
    })
    .eq('user_id', userId)
    .select()
    .single()
  if (error) {
    console.warn('[setSubscriptionCancelAtPeriodEnd]', error.message)
    return null
  }
  return data as SubscriptionRow
}

export interface CreatePaymentIntentInput {
  /** Internal user_id */
  userId: string
  tariffCode: string
  /**
   * P2: опционален — по умолчанию getDefaultProvider() (env
   * PAYMENTS_PROVIDER; сейчас 'alfabank'). ЮKassa остаётся
   * зарегистрированной как альтернатива.
   */
  provider?: Exclude<ProviderId, 'manual'>
  /** URL, на который шлюз возвращает пользователя после оплаты/отмены */
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

  // Step 2: create pending payments row. ОБЯЗАТЕЛЬНО admin-клиент:
  // RLS payments (миграция 047) — user read-own + service-role write;
  // SSR-клиент здесь молча упирается в политику, и строка либо не
  // создаётся, либо (Step 4) не получает provider_payment_id — вебхук
  // не сможет сматчить оплату.
  const admin = createAdminClient()
  const paymentId = randomUUID()
  const idempotenceKey = randomUUID()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await (admin as any).from('payments').insert({
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

  // Step 3: call provider (P2: дефолт из PAYMENTS_PROVIDER env)
  const providerId = input.provider ?? getDefaultProvider()
  if (providerId === 'manual') throw new Error('MANUAL_PROVIDER_NO_CHECKOUT')
  const provider = getProvider(providerId)
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
  // join. P2 (миграция 096): денормализованные колонки provider +
  // provider_payment_id; raw остаётся для аудита и legacy-фоллбека.
  // Пишем admin-клиентом и проверяем результат: без этой связки шлюзовой
  // платёж не сматчится с нашей строкой ни по колонке, ни по raw.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: linked, error: linkErr } = await (admin as any).from('payments')
    .update({
      provider:            providerId,
      provider_payment_id: result.providerPaymentId,
      raw: {
        tariff_code: tariff.code,
        idempotence_key: idempotenceKey,
        provider_payment_id: result.providerPaymentId,
        provider: providerId,
        confirmation_url: result.confirmationUrl,
      },
    })
    .eq('id', paymentId)
    .select('id')
  if (linkErr || !linked?.length) {
    throw new Error(`PAYMENT_PROVIDER_JOIN_FAILED: ${linkErr?.message ?? 'zero rows updated'}`)
  }

  return { ...result, paymentId }
}
