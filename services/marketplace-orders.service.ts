/**
 * Marketplace orders (P2) — оживление «мёртвой ноги» маркетплейса.
 *
 * Витрина (/marketplace) жила всегда; checkout возвращал 503
 * MARKETPLACE_SPLIT_PAYMENTS_PENDING в ожидании сплит-платежей. P2:
 * деньги принимает счёт платформы через провайдер-абстракцию (Альфа по
 * умолчанию), а КОМИССИЯ ПЛАТФОРМЫ учитывается ЛЕДЖЕРОМ — колонки
 * platform_fee_cents из миграции 050 (athlete_passes / coach_orders).
 * Выплаты продавцам = леджер + реестр (нативный сплит Альфы — продукт
 * «Твои Платежи», подключается отдельным договором позже).
 *
 * Server-only (admin-клиент): цену ВСЕГДА читаем из БД, клиентскую не
 * доверяем. Исполнение покупки — в payment-events.service по вебхуку
 * payment.succeeded (kind в payments.raw).
 */
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProvider, getDefaultProvider } from '@/lib/payments'
import type { CheckoutResult, Currency } from '@/lib/payments/provider'

/** Комиссия платформы в базисных пунктах (250 = 2.5%). */
export function platformFeeBps(): number {
  const raw = Number(process.env.PLATFORM_FEE_BPS ?? '250')
  if (!Number.isFinite(raw) || raw < 0 || raw > 5000) return 250
  return Math.round(raw)
}

export function computePlatformFeeCents(priceCents: number): number {
  return Math.round((priceCents * platformFeeBps()) / 10000)
}

export interface MarketplaceCheckoutInput {
  buyerId: string
  passPlanId?: string
  serviceId?: string
  returnUrl: string
}

export async function createMarketplaceCheckout(
  input: MarketplaceCheckoutInput,
): Promise<CheckoutResult & { paymentId: string }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any

  const providerId = getDefaultProvider()
  if (providerId === 'manual') throw new Error('MANUAL_PROVIDER_NO_CHECKOUT')
  const provider = getProvider(providerId)

  const paymentId = randomUUID()
  const idempotenceKey = randomUUID()

  let amountCents: number
  let currency: Currency
  let description: string
  let sellerId: string
  // Метаданные исполнения — читает fulfillMarketplacePayment по вебхуку.
  let fulfillment: Record<string, unknown>

  if (input.passPlanId) {
    const { data: planRaw } = await adminAny.from('coach_pass_plans')
      .select('id, coach_id, title, total_sessions, period_days, price_cents, currency, is_active, seller_role, seller_specialty, service_type')
      .eq('id', input.passPlanId)
      .maybeSingle()
    const plan = planRaw as {
      id: string; coach_id: string; title: string; total_sessions: number
      period_days: number; price_cents: number; currency: string; is_active: boolean
      seller_role: string; seller_specialty: string | null; service_type: string
    } | null
    if (!plan || !plan.is_active) throw new Error('OFFERING_NOT_FOUND')
    if (plan.price_cents <= 0) throw new Error('OFFERING_FREE_NO_CHECKOUT')
    if (plan.coach_id === input.buyerId) throw new Error('CANNOT_BUY_OWN_OFFERING')

    amountCents = plan.price_cents
    currency = (plan.currency?.trim() as Currency) || 'RUB'
    description = `Абонемент: ${plan.title}`
    sellerId = plan.coach_id
    // СНАПШОТ оффера на момент оплаты: исполнение (fulfill) должно выдать
    // ровно то, за что заплатили, даже если тренер поменяет план между
    // checkout и вебхуком (TOCTOU).
    fulfillment = {
      kind: 'marketplace_pass',
      pass_plan_id: plan.id,
      seller_id: plan.coach_id,
      platform_fee_cents: computePlatformFeeCents(plan.price_cents),
      snapshot: {
        title:            plan.title,
        total_sessions:   plan.total_sessions,
        period_days:      plan.period_days,
        price_cents:      plan.price_cents,
        currency:         (plan.currency?.trim() || 'RUB'),
        seller_role:      plan.seller_role,
        seller_specialty: plan.seller_specialty,
        service_type:     plan.service_type,
      },
    }
  } else if (input.serviceId) {
    const { data: svcRaw } = await adminAny.from('coach_services')
      .select('id, coach_id, title, price_amount, currency, is_active, seller_role, seller_specialty, service_type')
      .eq('id', input.serviceId)
      .maybeSingle()
    const svc = svcRaw as {
      id: string; coach_id: string; title: string; price_amount: number
      currency: string; is_active: boolean
      seller_role: string; seller_specialty: string | null; service_type: string
    } | null
    if (!svc || !svc.is_active) throw new Error('OFFERING_NOT_FOUND')
    if (svc.price_amount <= 0) throw new Error('OFFERING_FREE_NO_CHECKOUT')
    if (svc.coach_id === input.buyerId) throw new Error('CANNOT_BUY_OWN_OFFERING')

    // ВАЖНО: coach_services.price_amount — ЦЕЛЫЕ РУБЛИ (в отличие от
    // coach_pass_plans.price_cents в копейках) — нормализуем ×100.
    amountCents = svc.price_amount * 100
    currency = (svc.currency?.trim() as Currency) || 'RUB'
    description = `Услуга: ${svc.title}`
    sellerId = svc.coach_id

    // Заказ создаём ДО оплаты (pending) — переживает вебхук и даёт
    // продавцу видимость незавершённых покупок.
    const { data: orderRaw, error: orderErr } = await adminAny.from('coach_orders')
      .insert({
        service_id:         svc.id,
        coach_id:           svc.coach_id,
        athlete_id:         input.buyerId,
        status:             'pending',
        price_amount:       svc.price_amount,
        currency,
        seller_role:        svc.seller_role,
        seller_specialty:   svc.seller_specialty,
        service_type:       svc.service_type,
        // ВАЖНО: колонка coach_orders называется platform_fee_amount и
        // хранит ЦЕЛЫЕ РУБЛИ (рядом с price_amount) — НЕ platform_fee_cents
        // (та есть только у athlete_passes, в копейках). Комментарий в
        // шапке миграции 050 вводит в заблуждение.
        platform_fee_amount: Math.round((svc.price_amount * platformFeeBps()) / 10000),
      })
      .select('id')
      .single()
    if (orderErr || !orderRaw) {
      throw new Error(`ORDER_INSERT_FAILED: ${orderErr?.message ?? 'no row'}`)
    }
    fulfillment = {
      kind: 'marketplace_service',
      order_id: (orderRaw as { id: string }).id,
      service_id: svc.id,
      seller_id: svc.coach_id,
      platform_fee_cents: computePlatformFeeCents(amountCents),
    }
  } else {
    throw new Error('OFFERING_REQUIRED')
  }

  // payments-строка ДО обращения к шлюзу (паттерн createPaymentIntent).
  const { error: payInsertErr } = await adminAny.from('payments').insert({
    id:       paymentId,
    user_id:  input.buyerId,
    amount:   amountCents,
    currency,
    status:   'requires_payment_method',
    order_id: (fulfillment.order_id as string | undefined) ?? null,
    raw:      { ...fulfillment, idempotence_key: idempotenceKey },
  })
  if (payInsertErr) throw new Error(`PAYMENTS_INSERT_FAILED: ${payInsertErr.message}`)

  const result = await provider.createCheckout({
    userId:      input.buyerId,
    tariffCode:  '',
    paymentId,
    amountCents,
    currency,
    description,
    returnUrl:   input.returnUrl,
    recurring:   false, // разовые покупки — токен не сохраняем
    idempotenceKey,
    metadata: {
      kind:      String(fulfillment.kind),
      seller_id: sellerId,
    },
  })

  const { data: linked, error: linkErr } = await adminAny.from('payments')
    .update({
      provider:            providerId,
      provider_payment_id: result.providerPaymentId,
      raw: {
        ...fulfillment,
        idempotence_key:     idempotenceKey,
        provider:            providerId,
        provider_payment_id: result.providerPaymentId,
        confirmation_url:    result.confirmationUrl,
      },
    })
    .eq('id', paymentId)
    .select('id')
  if (linkErr || !linked?.length) {
    throw new Error(`PAYMENT_PROVIDER_JOIN_FAILED: ${linkErr?.message ?? 'zero rows updated'}`)
  }

  return { ...result, paymentId }
}
