import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { YooKassaProvider, isIpAllowed } from '@/lib/payments/yookassa'
import { applyPaymentEvent } from '@/services/payment-events.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/webhooks/yookassa — Sprint W3 Day 14 (PR #29), P2 refactor.
 *
 * Receives ЮKassa notifications. ЮKassa retries for 24h if we don't
 * return HTTP 200. Idempotency is enforced at DB layer via UNIQUE
 * (provider, provider_event_id) on `payment_events`.
 *
 * Verification (defense in depth):
 *   1. IP allowlist (6 official ranges from yookassa.ru/developers/using-api/webhooks#ip)
 *   2. Body parses as `{ type: 'notification', event, object }`
 *
 * P2: все side-effects (активация подписки, refund, payment method)
 * вынесены в provider-agnostic services/payment-events.service.ts —
 * их разделяют вебхуки ЮKassa и Альфа-Банка.
 */

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

  // Step 2: side-effects via provider-agnostic service.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = ((result.raw as any)?.object ?? {}) as YooKassaObject

  // Для payment_method.active сам object И ЕСТЬ payment method — его id
  // и есть токен; у платёжных событий токен лежит в payment_method.saved.
  const paymentMethodToken =
    result.kind === 'payment_method.active'
      ? obj.id ?? null
      : obj.payment_method?.saved ? obj.payment_method.id : null

  let sideEffectsOk = true
  try {
    await applyPaymentEvent(admin, {
      provider:           'yookassa',
      kind:               result.kind,
      providerPaymentId:  result.providerPaymentId,
      paymentMethodToken,
      userIdHint:         obj.metadata?.user_id ?? null,
    })
  } catch (e) {
    // Side-effects FAILED but event is logged. Return 200 so ЮKassa
    // doesn't retry forever — manual replay via processed_at NULL.
    sideEffectsOk = false
    console.error('[yookassa-webhook] side-effect failed:', e instanceof Error ? e.message : e)
  }

  // Step 3: mark processed — ТОЛЬКО при успешных side-effects, иначе
  // событие остаётся processed_at IS NULL и попадает в replay-выборку
  // (partial index из миграции 051).
  if (sideEffectsOk) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('payment_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('provider', 'yookassa')
      .eq('provider_event_id', result.providerEventId)
  }

  return NextResponse.json({ ok: true, kind: result.kind, sideEffectsOk })
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
