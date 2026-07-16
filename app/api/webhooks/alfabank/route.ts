import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AlfaBankProvider, getAlfaOrderStatus } from '@/lib/payments/alfabank'
import { applyPaymentEvent } from '@/services/payment-events.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Callback-уведомления Альфа-Банк эквайринга (P2).
 *
 * Шлюз шлёт GET с query-параметрами (mdOrder, orderNumber, operation,
 * status, checksum); на некоторых конфигурациях — POST form-urlencoded.
 * Оба метода сходятся в handle().
 *
 * Верификация (defense in depth):
 *   1. HMAC-SHA256 checksum «симметричной» подписи (ALFABANK_CALLBACK_TOKEN);
 *      без токена/подписи callback НЕ доверяется.
 *   2. Callback — только триггер: перед активацией подписки статус
 *      подтверждается через getOrderStatusExtended.do (orderStatus=2).
 *
 * Идемпотентность: UNIQUE(provider, provider_event_id) в payment_events,
 * event_id = `operation:mdOrder:status`. Недоставленный 200 шлюз ретраит
 * с интервалами до лимита — отвечаем 200 сразу после фиксации события,
 * ошибки side-effects переигрываются вручную по processed_at IS NULL.
 */
async function handle(req: Request, rawBody: string) {
  const result = await AlfaBankProvider.parseWebhook(req, rawBody)

  if (!result.verified) {
    console.warn('[alfabank-webhook] rejected: bad or missing checksum')
    return NextResponse.json({ ok: false, error: 'CHECKSUM_INVALID' }, { status: 401 })
  }
  if (result.kind === 'unknown' || !result.providerEventId) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await (admin as any).from('payment_events').insert({
    provider:            'alfabank',
    event_type:          result.kind,
    provider_event_id:   result.providerEventId,
    provider_payment_id: result.providerPaymentId,
    payload:             result.raw,
  })
  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true })
    }
    console.error('[alfabank-webhook] insert failed:', insertErr.message)
    return NextResponse.json({ ok: false, error: 'PERSIST_FAILED' }, { status: 500 })
  }

  let sideEffectsOk = true
  try {
    let paymentMethodToken: string | null = null

    if (result.kind === 'payment.succeeded' && result.providerPaymentId) {
      // Trust-but-verify: считаем оплаченным только deposited (2).
      const status = await getAlfaOrderStatus(result.providerPaymentId)
      if (status.orderStatus !== 2) {
        console.warn(
          `[alfabank-webhook] deposited callback but orderStatus=${status.orderStatus} — skipping side-effects`,
        )
        return NextResponse.json({ ok: true, deferred: true })
      }
      paymentMethodToken = status.bindingId
    }
    if (result.kind === 'payment_method.active') {
      // bindingCreated: токен в самом callback отсутствует — берём из статуса.
      const raw = result.raw as Record<string, string>
      paymentMethodToken = raw.bindingId
        ?? (result.providerPaymentId
          ? (await getAlfaOrderStatus(result.providerPaymentId)).bindingId
          : null)
    }

    await applyPaymentEvent(admin, {
      provider:           'alfabank',
      kind:               result.kind,
      providerPaymentId:  result.providerPaymentId,
      paymentMethodToken,
    })
  } catch (e) {
    // Событие уже зафиксировано — 200, ручной replay по processed_at NULL.
    sideEffectsOk = false
    console.error('[alfabank-webhook] side-effect failed:', e instanceof Error ? e.message : e)
  }

  // processed_at — только при успехе side-effects: упавшее событие остаётся
  // processed_at IS NULL и попадает в replay-выборку (индекс из 051).
  if (sideEffectsOk) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('payment_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('provider', 'alfabank')
      .eq('provider_event_id', result.providerEventId)
  }

  return NextResponse.json({ ok: true, kind: result.kind, sideEffectsOk })
}

export async function GET(req: Request) {
  // Health-probe без параметров callback — отвечаем описанием эндпоинта.
  const url = new URL(req.url)
  if (!url.searchParams.get('mdOrder')) {
    return NextResponse.json({
      ok: true,
      endpoint: '/api/webhooks/alfabank',
      note: 'Alfa-Bank acquiring callback (GET/POST). Verified via HMAC-SHA256 checksum + getOrderStatusExtended confirmation.',
    })
  }
  return handle(req, '')
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  return handle(req, rawBody)
}
