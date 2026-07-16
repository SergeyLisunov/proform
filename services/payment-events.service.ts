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
  raw: { tariff_code?: string; idempotence_key?: string } | null
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

/** refund.succeeded → payments.status='refunded' (без авто-даунгрейда подписки). */
async function markPaymentRefunded(admin: Admin, originalProviderPaymentId: string): Promise<void> {
  const payment = await findPaymentByProviderId(admin, originalProviderPaymentId)
  if (!payment || payment.status === 'refunded') return

  const { error: refundErr } = await admin.from('payments')
    .update({ status: 'refunded', updated_at: new Date().toISOString() })
    .eq('id', payment.id)
  if (refundErr) {
    throw new Error(`[payment-events] payments refunded update failed: ${refundErr.message}`)
  }

  try {
    await admin.from('notifications').insert({
      user_id:     payment.user_id,
      type:        'broadcast',
      title:       'Возврат произведён',
      body:        'Средства вернутся на карту в течение 1–7 дней.',
      entity_type: 'payment',
      entity_id:   payment.id,
      action_url:  '/settings/billing',
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
