/**
 * Provider-agnostic payment-event side-effects (P2, Альфа-Банк).
 *
 * До P2 вся бизнес-логика активации подписок жила inline в
 * app/api/webhooks/yookassa/route.ts — второй провайдер вынудил бы её
 * дублировать. Теперь любой вебхук-роут делает три шага:
 *   parseWebhook → INSERT payment_events (идемпотентность) →
 *   applyPaymentEvent() из этого модуля.
 *
 * Server-only: работает через admin-клиент (RLS payments/subscriptions —
 * service-role writes). Никогда не импортировать в клиентский код.
 */
import { Resend } from 'resend'
import {
  renderSubscriptionActivated,
  renderSubscriptionPaymentFailed,
} from '@/lib/email/templates'
import type { ProviderId, WebhookEventKind } from '@/lib/payments/provider'

const FROM = process.env.RESEND_FROM ?? 'Sporteo <notifications@proform-delta.vercel.app>'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any

export interface PaymentEventInput {
  provider: Exclude<ProviderId, 'manual'>
  kind: WebhookEventKind
  /** Provider-side id заказа/платежа, к которому относится событие. */
  providerPaymentId: string | null
  /**
   * Токен сохранённого способа оплаты, если событие его несёт
   * (yookassa payment_method.id при saved=true / bindingId Альфы).
   */
  paymentMethodToken?: string | null
  /** user_id из метаданных провайдера (fallback, когда нет payments-строки). */
  userIdHint?: string | null
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

interface PaymentRow {
  id: string
  user_id: string
  raw: {
    tariff_code?: string
    idempotence_key?: string
    /** P2 marketplace: 'marketplace_pass' | 'marketplace_service' */
    kind?: string
    pass_plan_id?: string
    order_id?: string
    service_id?: string
    seller_id?: string
    platform_fee_cents?: number
    /** Снапшот оффера на момент checkout (TOCTOU-защита). */
    snapshot?: {
      title?: string; total_sessions?: number; period_days?: number
      price_cents?: number; currency?: string; seller_role?: string
      seller_specialty?: string | null; service_type?: string
    }
  } | null
  status: string
  amount: number
  currency: string
}

/**
 * Поиск payments-строки по provider_payment_id: сперва денормализованная
 * колонка (миграция 096), затем legacy-фоллбек по raw JSONB (строки,
 * созданные до 096).
 */
async function findPaymentByProviderId(admin: Admin, providerPaymentId: string): Promise<PaymentRow | null> {
  const { data: byCol } = await admin
    .from('payments')
    .select('id, user_id, raw, status, amount, currency')
    .eq('provider_payment_id', providerPaymentId)
    .maybeSingle()
  if (byCol) return byCol as PaymentRow

  const { data: byRaw } = await admin
    .from('payments')
    .select('id, user_id, raw, status, amount, currency')
    .filter('raw->>provider_payment_id', 'eq', providerPaymentId)
    .maybeSingle()
  return (byRaw as PaymentRow | null) ?? null
}

/**
 * Единая точка применения платёжного события. Ошибки пробрасываются —
 * роут решает, отвечать ли 200 (событие уже залогировано в
 * payment_events, ручной replay по processed_at IS NULL).
 */
export async function applyPaymentEvent(admin: Admin, input: PaymentEventInput): Promise<void> {
  switch (input.kind) {
    case 'payment.succeeded':
      if (input.providerPaymentId) {
        await activateSubscriptionFromPayment(admin, input)
      }
      break
    case 'payment.canceled':
      if (input.providerPaymentId) {
        await markPaymentFailed(admin, input.providerPaymentId)
      }
      break
    case 'refund.succeeded':
      if (input.providerPaymentId) {
        await markPaymentRefunded(admin, input.providerPaymentId)
      }
      break
    case 'payment_method.active':
      await savePaymentMethod(admin, input)
      break
    case 'payment.waiting_for_capture':
      // Capture у нас автоматический (одностадийный флоу) — ждём
      // deposited/succeeded, реакция не нужна.
      break
    default:
      break
  }
}

/**
 * payment.succeeded → upsert активной подписки.
 * Портировано 1:1 из вебхука ЮKassa; провайдер-специфичны только
 * subscriptions.provider и источник токена способа оплаты.
 */
async function activateSubscriptionFromPayment(admin: Admin, input: PaymentEventInput): Promise<void> {
  const payment = await findPaymentByProviderId(admin, input.providerPaymentId!)
  if (!payment) {
    console.warn(`[payment-events] payment row not found for ${input.provider}:${input.providerPaymentId}`)
    return
  }
  if (payment.status === 'succeeded') return // идемпотентный повтор

  // P2 marketplace: покупка абонемента/услуги — не подписка.
  if (payment.raw?.kind === 'marketplace_pass' || payment.raw?.kind === 'marketplace_service') {
    await fulfillMarketplacePayment(admin, payment)
    return
  }

  const tariffCode = payment.raw?.tariff_code
  if (!tariffCode) {
    console.warn('[payment-events] payment missing tariff_code metadata')
    return
  }

  const { data: tariffRaw } = await admin
    .from('tariffs')
    .select('code, name, price_cents, currency, billing_period, trial_days')
    .eq('code', tariffCode)
    .maybeSingle()
  const tariff = tariffRaw as {
    code: string; name: string; price_cents: number; currency: string;
    billing_period: 'monthly' | 'yearly' | 'one_time'; trial_days: number;
  } | null
  if (!tariff) {
    console.warn('[payment-events] tariff not found:', tariffCode)
    return
  }

  const now = new Date()
  const periodEnd = new Date(now)
  if (tariff.billing_period === 'monthly') {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  } else if (tariff.billing_period === 'yearly') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  }

  const { data: existingRaw } = await admin
    .from('subscriptions')
    .select('id, status, trial_ends_at')
    .eq('user_id', payment.user_id)
    .maybeSingle()
  const existing = existingRaw as { id: string; status: string; trial_ends_at: string | null } | null

  const isFirstTime = !existing || !existing.trial_ends_at
  const trialEndsAt = (isFirstTime && tariff.trial_days > 0)
    ? new Date(now.getTime() + tariff.trial_days * 86400000).toISOString()
    : existing?.trial_ends_at ?? null

  const newStatus = (trialEndsAt && new Date(trialEndsAt).getTime() > now.getTime()) ? 'trialing' : 'active'

  const subPayload: Record<string, unknown> = {
    user_id:              payment.user_id,
    plan:                 tariff.code, // legacy-зеркало tariff_code (CHECK снят в 096)
    tariff_code:          tariff.code,
    status:               newStatus,
    provider:             input.provider,
    started_at: existing?.status === 'cancelled' || !existing
      ? now.toISOString()
      : undefined,
    current_period_start: now.toISOString(),
    current_period_end:   periodEnd.toISOString(),
    trial_ends_at:        trialEndsAt,
    cancel_at_period_end: false,
    cancelled_at:         null,
  }
  // Колонка исторически называется yookassa_payment_method_id, но с P2
  // хранит токен ЛЮБОГО провайдера (bindingId Альфы и т.д.) — провайдер
  // определяется соседней колонкой provider.
  if (input.paymentMethodToken) {
    subPayload.yookassa_payment_method_id = input.paymentMethodToken
  }

  // Критические записи проверяем явно и бросаем: supabase-js не кидает
  // сам, а «моргнувший» upsert = оплачено-но-не-активировано. Проброс
  // оставляет событие processed_at IS NULL → replay.
  const { error: subErr } = existing
    ? await admin.from('subscriptions').update(subPayload).eq('id', existing.id)
    : await admin.from('subscriptions').insert(subPayload)
  if (subErr) {
    throw new Error(`[payment-events] subscriptions upsert failed: ${subErr.message}`)
  }

  const { error: payErr } = await admin.from('payments')
    .update({ status: 'succeeded', updated_at: now.toISOString() })
    .eq('id', payment.id)
  if (payErr) {
    throw new Error(`[payment-events] payments succeeded update failed: ${payErr.message}`)
  }

  try {
    await admin.from('notifications').insert({
      user_id:     payment.user_id,
      type:        'broadcast',
      title:       'Подписка активирована',
      body:        `Тариф ${tariff.name} — доступ открыт`,
      entity_type: 'subscription',
      entity_id:   payment.id,
      action_url:  '/settings/billing',
    })
  } catch (e) {
    console.warn('[payment-events] notify failed:', e)
  }

  const resend = getResend()
  if (resend) {
    const { data: userRaw } = await admin
      .from('users').select('email, name').eq('id', payment.user_id).maybeSingle()
    const user = userRaw as { email: string | null; name: string | null } | null
    if (user?.email) {
      try {
        const priceLabel = tariff.price_cents === 0
          ? 'Бесплатно'
          : `${(tariff.price_cents / 100).toLocaleString('ru-RU')}${tariff.currency === 'RUB' ? '₽' : tariff.currency}${
              tariff.billing_period === 'monthly' ? ' / месяц' :
              tariff.billing_period === 'yearly' ? ' / год' : ''
            }`
        const { subject, html } = renderSubscriptionActivated({
          name:          user.name ?? 'Атлет',
          tariff_name:   tariff.name,
          price_label:   priceLabel,
          period_end:    periodEnd.toISOString(),
          trial_ends_at: trialEndsAt,
        })
        await resend.emails.send({ from: FROM, to: user.email, subject, html })
      } catch (e) {
        console.warn('[payment-events] activation email failed:', e)
      }
    }
  }
}

/**
 * P2 marketplace — исполнение оплаченной покупки.
 * pass: выдаём athlete_passes из СНАПШОТА оффера на момент checkout
 * (не из живого плана — TOCTOU) с платёжным леджером platform_fee_cents;
 * service: coach_orders → paid. Идемпотентность: гейт payment.status
 * 'succeeded' + UNIQUE athlete_passes.payment_id (098) — повторный
 * fulfill того же платежа упирается в 23505 и трактуется как выдано.
 */
async function fulfillMarketplacePayment(admin: Admin, payment: PaymentRow): Promise<void> {
  const raw = payment.raw ?? {}
  const now = new Date()

  let buyerNotifyBody = ''
  let sellerNotifyBody = ''
  const sellerId = raw.seller_id ?? null

  if (raw.kind === 'marketplace_pass') {
    if (!raw.pass_plan_id) throw new Error('[payment-events] marketplace_pass without pass_plan_id')

    // Источник правды — снапшот из payments.raw; свежее чтение плана —
    // только legacy-фоллбек для платежей, созданных до снапшота.
    let snap = raw.snapshot ?? null
    if (!snap?.title || !snap.total_sessions || !snap.period_days) {
      const { data: planRaw } = await admin.from('coach_pass_plans')
        .select('title, total_sessions, period_days, price_cents, currency, seller_role, seller_specialty, service_type')
        .eq('id', raw.pass_plan_id)
        .maybeSingle()
      if (!planRaw) throw new Error(`[payment-events] pass plan not found: ${raw.pass_plan_id}`)
      snap = planRaw as NonNullable<typeof snap>
    }

    const startsAt = now.toISOString().slice(0, 10)
    const expiresAt = new Date(now.getTime() + (snap.period_days ?? 30) * 86400000).toISOString().slice(0, 10)
    const { error: passErr } = await admin.from('athlete_passes').insert({
      coach_id:           raw.seller_id,
      athlete_id:         payment.user_id,
      plan_id:            raw.pass_plan_id,
      payment_id:         payment.id,
      title:              snap.title,
      total_sessions:     snap.total_sessions,
      used_sessions:      0,
      starts_at:          startsAt,
      expires_at:         expiresAt,
      price_cents:        snap.price_cents ?? payment.amount,
      currency:           snap.currency ?? payment.currency,
      status:             'active',
      seller_role:        snap.seller_role ?? 'coach',
      seller_specialty:   snap.seller_specialty ?? null,
      service_type:       snap.service_type ?? 'training_pack',
      platform_fee_cents: raw.platform_fee_cents ?? null,
      notes:              `Куплен через маркетплейс · платёж ${payment.id}`,
    })
    if (passErr) {
      if (passErr.code === '23505') {
        // Уже выдан этим платежом (replay/дубль callback) — идемпотентный ок.
        console.warn(`[payment-events] pass already issued for payment ${payment.id}`)
      } else {
        throw new Error(`[payment-events] athlete_passes insert failed: ${passErr.message}`)
      }
    }

    buyerNotifyBody = `Абонемент «${snap.title}» активен: ${snap.total_sessions} занятий до ${new Date(expiresAt + 'T00:00:00').toLocaleDateString('ru-RU')}`
    sellerNotifyBody = `Покупка абонемента «${snap.title}» — ${((snap.price_cents ?? payment.amount) / 100).toLocaleString('ru-RU')}₽`
  } else {
    if (!raw.order_id) throw new Error('[payment-events] marketplace_service without order_id')
    const { data: orderRaw, error: orderErr } = await admin.from('coach_orders')
      .update({ status: 'paid', paid_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('id', raw.order_id)
      .select('id, price_amount, service_id')
      .maybeSingle()
    if (orderErr || !orderRaw) {
      throw new Error(`[payment-events] coach_orders paid update failed: ${orderErr?.message ?? 'no row'}`)
    }
    const order = orderRaw as { id: string; price_amount: number; service_id: string }
    const { data: svcRaw } = await admin.from('coach_services')
      .select('title').eq('id', order.service_id).maybeSingle()
    const title = (svcRaw as { title: string } | null)?.title ?? 'Услуга'
    buyerNotifyBody = `Оплата услуги «${title}» прошла — продавец получил заказ`
    sellerNotifyBody = `Новый оплаченный заказ: «${title}» — ${order.price_amount.toLocaleString('ru-RU')}₽. Свяжитесь с покупателем.`
  }

  const { error: payErr } = await admin.from('payments')
    .update({ status: 'succeeded', updated_at: now.toISOString() })
    .eq('id', payment.id)
  if (payErr) throw new Error(`[payment-events] payments succeeded update failed: ${payErr.message}`)

  // Уведомления — best-effort (не роняем исполнение).
  try {
    const inserts = [
      {
        user_id:     payment.user_id,
        type:        raw.kind === 'marketplace_pass' ? 'pass_issued' : 'broadcast',
        title:       raw.kind === 'marketplace_pass' ? 'Абонемент активирован' : 'Покупка оплачена',
        body:        buyerNotifyBody,
        entity_type: 'payment',
        entity_id:   payment.id,
        action_url:  raw.kind === 'marketplace_pass' ? '/athlete/passes' : '/marketplace',
      },
      ...(sellerId ? [{
        user_id:     sellerId,
        type:        'broadcast',
        title:       'Продажа в маркетплейсе',
        body:        sellerNotifyBody,
        entity_type: 'payment',
        entity_id:   payment.id,
        action_url:  raw.kind === 'marketplace_pass' ? '/coach/passes' : '/coach/services',
      }] : []),
    ]
    await admin.from('notifications').insert(inserts)
  } catch (e) {
    console.warn('[payment-events] marketplace notify failed:', e)
  }
}

/** payment.canceled → payments.status='canceled' + уведомление. */
async function markPaymentFailed(admin: Admin, providerPaymentId: string): Promise<void> {
  const payment = await findPaymentByProviderId(admin, providerPaymentId)
  if (!payment || payment.status === 'failed' || payment.status === 'canceled') return

  const { error: cancelErr } = await admin.from('payments')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('id', payment.id)
  if (cancelErr) {
    throw new Error(`[payment-events] payments canceled update failed: ${cancelErr.message}`)
  }

  // Маркетплейс-услуга: pending-заказ продавца отменяем вместе с платежом,
  // чтобы у тренера не копились вечные «ожидающие» покупки.
  if (payment.raw?.kind === 'marketplace_service' && payment.raw.order_id) {
    await admin.from('coach_orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', payment.raw.order_id)
      .eq('status', 'pending')
  }

  try {
    await admin.from('notifications').insert({
      user_id:     payment.user_id,
      type:        'broadcast',
      title:       'Платёж не прошёл',
      body:        'Попробуйте снова или обновите способ оплаты.',
      entity_type: 'payment',
      entity_id:   payment.id,
      action_url:  '/pricing',
    })
  } catch { /* ignore */ }

  const resend = getResend()
  if (resend) {
    const { data: userRaw } = await admin
      .from('users').select('email, name').eq('id', payment.user_id).maybeSingle()
    const user = userRaw as { email: string | null; name: string | null } | null
    const tariffCode = payment.raw?.tariff_code
    if (user?.email && tariffCode) {
      const { data: tRaw } = await admin.from('tariffs').select('name').eq('code', tariffCode).maybeSingle()
      const tariffName = (tRaw as { name: string } | null)?.name ?? 'Подписка'
      try {
        const { subject, html } = renderSubscriptionPaymentFailed({
          name:        user.name ?? 'Атлет',
          tariff_name: tariffName,
          retry_url:   `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://proform-delta.vercel.app'}/pricing`,
        })
        await resend.emails.send({ from: FROM, to: user.email, subject, html })
      } catch (e) {
        console.warn('[payment-events] failed-email failed:', e)
      }
    }
  }
}

/**
 * refund.succeeded → payments.status='refunded'.
 * Подписку не даунгрейдим автоматически (возврат может быть за прошлый
 * период), но МАРКЕТПЛЕЙС откатываем: возвращённый абонемент не должен
 * оставаться активным, а возвращённый заказ — числиться «paid» в леджере
 * выплат продавцу (иначе реестр выплат переплатит продавцу возврат).
 */
async function markPaymentRefunded(admin: Admin, originalProviderPaymentId: string): Promise<void> {
  const payment = await findPaymentByProviderId(admin, originalProviderPaymentId)
  if (!payment || payment.status === 'refunded') return

  const { error: refundErr } = await admin.from('payments')
    .update({ status: 'refunded', updated_at: new Date().toISOString() })
    .eq('id', payment.id)
  if (refundErr) {
    throw new Error(`[payment-events] payments refunded update failed: ${refundErr.message}`)
  }

  const isMarketplace =
    payment.raw?.kind === 'marketplace_pass' || payment.raw?.kind === 'marketplace_service'

  if (payment.raw?.kind === 'marketplace_pass') {
    const { error: passErr } = await admin.from('athlete_passes')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('payment_id', payment.id)
      .in('status', ['active', 'paused'])
    if (passErr) {
      throw new Error(`[payment-events] refunded pass cancel failed: ${passErr.message}`)
    }
  }
  if (payment.raw?.kind === 'marketplace_service' && payment.raw.order_id) {
    const { error: orderErr } = await admin.from('coach_orders')
      .update({ status: 'refunded', updated_at: new Date().toISOString() })
      .eq('id', payment.raw.order_id)
    if (orderErr) {
      throw new Error(`[payment-events] refunded order update failed: ${orderErr.message}`)
    }
  }

  try {
    await admin.from('notifications').insert({
      user_id:     payment.user_id,
      type:        'broadcast',
      title:       'Возврат произведён',
      body:        payment.raw?.kind === 'marketplace_pass'
        ? 'Средства вернутся на карту в течение 1–7 дней. Абонемент отменён.'
        : 'Средства вернутся на карту в течение 1–7 дней.',
      entity_type: 'payment',
      entity_id:   payment.id,
      action_url:  isMarketplace ? '/athlete/passes' : '/settings/billing',
    })
  } catch { /* ignore */ }
}

/**
 * payment_method.active / bindingCreated → сохранить токен на подписке.
 * user_id берём из метаданных провайдера (ЮKassa) либо через
 * payments-строку заказа (Альфа — callback метаданных не несёт).
 */
async function savePaymentMethod(admin: Admin, input: PaymentEventInput): Promise<void> {
  if (!input.paymentMethodToken) return
  let userId = input.userIdHint ?? null
  if (!userId && input.providerPaymentId) {
    const payment = await findPaymentByProviderId(admin, input.providerPaymentId)
    userId = payment?.user_id ?? null
  }
  if (!userId) return
  const { error: tokenErr } = await admin.from('subscriptions')
    .update({ yookassa_payment_method_id: input.paymentMethodToken, provider: input.provider })
    .eq('user_id', userId)
  if (tokenErr) {
    throw new Error(`[payment-events] payment-method token save failed: ${tokenErr.message}`)
  }
}
