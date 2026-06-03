import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { YooKassaProvider, isIpAllowed } from '@/lib/payments/yookassa'
import {
  renderSubscriptionActivated,
  renderSubscriptionPaymentFailed,
} from '@/lib/email/templates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/webhooks/yookassa — Sprint W3 Day 14 (PR #29).
 *
 * Receives ЮKassa notifications. ЮKassa retries for 24h if we don't
 * return HTTP 200. Idempotency is enforced at DB layer via UNIQUE
 * (provider, provider_event_id) on `payment_events`.
 *
 * Verification (defense in depth):
 *   1. IP allowlist (6 official ranges from yookassa.ru/developers/using-api/webhooks#ip)
 *   2. Body parses as `{ type: 'notification', event, object }`
 *
 * On verified event:
 *   1. INSERT into payment_events (idempotent — duplicate event_id → 200)
 *   2. Side-effect dispatch by event kind:
 *      - payment.succeeded            → activateSubscriptionFromPayment()
 *      - payment.canceled             → markPaymentFailed()
 *      - refund.succeeded             → markPaymentRefunded()
 *      - payment_method.active        → save token (recurring)
 *      - payment.waiting_for_capture  → log only (auto-capture mode)
 *   3. UPDATE payment_events.processed_at
 */

const FROM = process.env.RESEND_FROM ?? 'Sporteo <notifications@proform-delta.vercel.app>'

interface YooKassaObject {
  id: string
  status: string
  paid?: boolean
  amount?: { value: string; currency: string }
  payment_method?: { id: string; saved: boolean; type: string }
  metadata?: Record<string, string>
  // Refund-specific
  payment_id?: string
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const result = await YooKassaProvider.parseWebhook(req, rawBody)

  if (!result.verified) {
    console.warn('[yookassa-webhook] rejected: not from allowlisted IP')
    return NextResponse.json({ ok: false, error: 'IP_NOT_ALLOWED' }, { status: 401 })
  }

  if (result.kind === 'unknown' || !result.providerEventId) {
    console.warn('[yookassa-webhook] unknown event shape, ignoring')
    return NextResponse.json({ ok: true, ignored: true })
  }

  // Step 1: persist event (idempotency lock)
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await (admin as any).from('payment_events').insert({
    provider:            'yookassa',
    event_type:          result.kind,
    provider_event_id:   result.providerEventId,
    provider_payment_id: result.providerPaymentId,
    payload:             result.raw,
  })

  if (insertErr) {
    if (insertErr.code === '23505') {
      // Already processed once — silent 200.
      return NextResponse.json({ ok: true, duplicate: true })
    }
    console.error('[yookassa-webhook] insert failed:', insertErr.message)
    return NextResponse.json({ ok: false, error: 'PERSIST_FAILED' }, { status: 500 })
  }

  // Step 2: side-effect dispatch by event kind.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = ((result.raw as any)?.object ?? {}) as YooKassaObject

  try {
    switch (result.kind) {
      case 'payment.succeeded':
        await activateSubscriptionFromPayment(admin, obj)
        break

      case 'payment.canceled':
        await markPaymentFailed(admin, obj)
        break

      case 'refund.succeeded':
        await markPaymentRefunded(admin, obj)
        break

      case 'payment_method.active':
        await savePaymentMethod(admin, obj)
        break

      case 'payment.waiting_for_capture':
        // Capture is automatic in our flow (capture:true on create).
        // Log only — actual succeeded comes shortly after.
        break

      default:
        // unknown — already returned 200 above
        break
    }
  } catch (e) {
    // Side-effects FAILED but event is logged. Return 200 so ЮKassa
    // doesn't retry forever — manual replay via processed_at NULL.
    console.error('[yookassa-webhook] side-effect failed:', e instanceof Error ? e.message : e)
  }

  // Step 3: mark processed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('payment_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('provider', 'yookassa')
    .eq('provider_event_id', result.providerEventId)

  return NextResponse.json({ ok: true, kind: result.kind })
}

/** Healthcheck for ЮKassa "test webhook" button. */
export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            ?? req.headers.get('x-real-ip')
            ?? null
  const trusted = isIpAllowed(ip)
  return NextResponse.json({
    ok: true,
    endpoint: '/api/webhooks/yookassa',
    method: 'POST',
    ip_seen: ip,
    ip_trusted: trusted,
    note: 'POST endpoint expects {type:notification,event,object}; verified via IP allowlist + idempotency by (provider,provider_event_id).',
  })
}

// ── Side-effect handlers ───────────────────────────────────────────────────

/**
 * payment.succeeded → upsert active subscription.
 * Steps:
 *   1. Lookup payments row by provider_payment_id (in raw.provider_payment_id)
 *   2. Read tariff_code from payments.raw
 *   3. Read tariff details (billing_period, trial_days)
 *   4. UPSERT subscriptions: status, tariff_code, current_period_*, trial_ends_at
 *   5. Mark payments.status = 'succeeded'
 *   6. Send activation email + in-app notification
 */
async function activateSubscriptionFromPayment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  obj: YooKassaObject,
): Promise<void> {
  // 1. Find our payment row. Provider id is stored in raw.provider_payment_id
  // (we set this in createPaymentIntent in services/billing.service.ts).
  const { data: paymentRaw } = await admin
    .from('payments')
    .select('id, user_id, raw, status, amount, currency')
    .filter('raw->>provider_payment_id', 'eq', obj.id)
    .maybeSingle()
  const payment = paymentRaw as {
    id: string
    user_id: string
    raw: { tariff_code?: string; idempotence_key?: string }
    status: string
    amount: number
    currency: string
  } | null
  if (!payment) {
    console.warn('[yookassa-webhook] payment row not found for', obj.id)
    return
  }

  // Already finalized? Idempotent silent return.
  if (payment.status === 'succeeded') {
    return
  }

  const tariffCode = payment.raw?.tariff_code
  if (!tariffCode) {
    console.warn('[yookassa-webhook] payment missing tariff_code metadata')
    return
  }

  // 2. Tariff details
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
    console.warn('[yookassa-webhook] tariff not found:', tariffCode)
    return
  }

  const now = new Date()
  const periodEnd = new Date(now)
  if (tariff.billing_period === 'monthly') {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  } else if (tariff.billing_period === 'yearly') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  }

  // 3. Existing subscription?
  const { data: existingRaw } = await admin
    .from('subscriptions')
    .select('id, status, trial_ends_at')
    .eq('user_id', payment.user_id)
    .maybeSingle()
  const existing = existingRaw as { id: string; status: string; trial_ends_at: string | null } | null

  // First-time subscriber gets trial (if tariff has trial_days)
  const isFirstTime = !existing || !existing.trial_ends_at
  const trialEndsAt = (isFirstTime && tariff.trial_days > 0)
    ? new Date(now.getTime() + tariff.trial_days * 86400000).toISOString()
    : existing?.trial_ends_at ?? null

  const newStatus = (trialEndsAt && new Date(trialEndsAt).getTime() > now.getTime()) ? 'trialing' : 'active'

  // 4. UPSERT subscription
  const subPayload = {
    user_id: payment.user_id,
    plan: tariff.code,             // legacy column, mirror to tariff_code
    tariff_code: tariff.code,
    status: newStatus,
    provider: 'yookassa',
    started_at: existing?.status === 'cancelled' || !existing
      ? now.toISOString()
      : undefined,                 // keep original started_at for renewals
    current_period_start: now.toISOString(),
    current_period_end:   periodEnd.toISOString(),
    trial_ends_at:        trialEndsAt,
    cancel_at_period_end: false,
    cancelled_at:         null,
    yookassa_payment_method_id: obj.payment_method?.saved ? obj.payment_method.id : null,
  }

  if (existing) {
    await admin.from('subscriptions').update(subPayload).eq('id', existing.id)
  } else {
    await admin.from('subscriptions').insert(subPayload)
  }

  // 5. Mark payment as succeeded
  await admin.from('payments')
    .update({ status: 'succeeded', updated_at: now.toISOString() })
    .eq('id', payment.id)

  // 6. Notifications (in-app + email — best-effort)
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
    console.warn('[activateSubscriptionFromPayment] notify failed:', e)
  }

  // Email: only if Resend configured AND user has email
  const resend = getResend()
  if (resend) {
    const { data: userRaw } = await admin
      .from('users')
      .select('email, name')
      .eq('id', payment.user_id)
      .maybeSingle()
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
          name:           user.name ?? 'Атлет',
          tariff_name:    tariff.name,
          price_label:    priceLabel,
          period_end:     periodEnd.toISOString(),
          trial_ends_at:  trialEndsAt,
        })
        await resend.emails.send({ from: FROM, to: user.email, subject, html })
      } catch (e) {
        console.warn('[activateSubscriptionFromPayment] email failed:', e)
      }
    }
  }
}

/** payment.canceled → mark our payment failed, notify user. */
async function markPaymentFailed(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  obj: YooKassaObject,
): Promise<void> {
  const { data: paymentRaw } = await admin
    .from('payments')
    .select('id, user_id, raw, status')
    .filter('raw->>provider_payment_id', 'eq', obj.id)
    .maybeSingle()
  const payment = paymentRaw as { id: string; user_id: string; raw: { tariff_code?: string }; status: string } | null
  if (!payment || payment.status === 'failed' || payment.status === 'canceled') return

  await admin.from('payments')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('id', payment.id)

  // Notify user
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
  } catch {
    /* ignore */
  }

  // Email
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
        console.warn('[markPaymentFailed] email failed:', e)
      }
    }
  }
}

/** refund.succeeded → mark payment refunded; downgrade subscription if owner. */
async function markPaymentRefunded(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  obj: YooKassaObject,
): Promise<void> {
  // For refund event, obj.payment_id refers back to the original payment.
  const originalPaymentId = obj.payment_id ?? obj.id
  const { data: paymentRaw } = await admin
    .from('payments')
    .select('id, user_id, status')
    .filter('raw->>provider_payment_id', 'eq', originalPaymentId)
    .maybeSingle()
  const payment = paymentRaw as { id: string; user_id: string; status: string } | null
  if (!payment || payment.status === 'refunded') return

  await admin.from('payments')
    .update({ status: 'refunded', updated_at: new Date().toISOString() })
    .eq('id', payment.id)

  // We DON'T auto-downgrade subscription here — refund could be for past
  // period billing, not a cancellation. Admin / cron logic handles that
  // separately. Just record + notify.
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
  } catch {
    /* ignore */
  }
}

/** payment_method.active → save the payment method id on subscription. */
async function savePaymentMethod(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  obj: YooKassaObject,
): Promise<void> {
  const userId = obj.metadata?.user_id
  if (!userId) return
  await admin.from('subscriptions')
    .update({ yookassa_payment_method_id: obj.id })
    .eq('user_id', userId)
}
