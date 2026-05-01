import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { YooKassaProvider, isIpAllowed } from '@/lib/payments/yookassa'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/webhooks/yookassa
 *
 * Receives ЮKassa notifications. ЮKassa retries for 24h if we don't
 * return HTTP 200. Idempotency is enforced at DB layer via UNIQUE
 * (provider, provider_event_id) on `payment_events`.
 *
 * Verification (defense in depth):
 *   1. IP allowlist (6 official ranges from yookassa.ru/developers/using-api/webhooks#ip)
 *   2. Body parses as `{ type: 'notification', event, object }`
 *   3. Future: re-fetch payment status from API to confirm (currently
 *      we trust the IP-verified notification — re-fetch added in PR #24
 *      together with full subscription activation flow)
 *
 * On success → INSERT into payment_events; route layer (this file)
 * will trigger side-effects in PR #23 (subscription activation,
 * payment_id status update, refund record). For the foundation PR
 * we just LOG the event and return 200, so no double-processing
 * happens when full flow lands.
 *
 * If event already in payment_events (UNIQUE conflict) → return 200
 * silently (ЮKassa is replaying, we already processed once).
 */

export async function POST(req: Request) {
  // Step 1: read raw body — needed BOTH for parse and for any future
  // signature verification (must be the exact bytes ЮKassa signed).
  const rawBody = await req.text()

  // Step 2: parse + IP-verify via provider helper.
  const result = await YooKassaProvider.parseWebhook(req, rawBody)

  if (!result.verified) {
    // Bad source IP. Return 401 so a misconfigured firewall surfaces
    // as an obvious failure instead of silently consuming events.
    console.warn('[yookassa-webhook] rejected: not from allowlisted IP')
    return NextResponse.json({ ok: false, error: 'IP_NOT_ALLOWED' }, { status: 401 })
  }

  if (result.kind === 'unknown' || !result.providerEventId) {
    // ЮKassa always sends `type:notification` so this should be rare.
    // Log & 200 so they don't keep retrying garbage.
    console.warn('[yookassa-webhook] unknown event shape, ignoring')
    return NextResponse.json({ ok: true, ignored: true })
  }

  // Step 3: persist to payment_events (idempotency via UNIQUE).
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
    // Code 23505 = unique_violation. Means we already saw this event
    // — ЮKassa is replaying. Return 200 to stop the retry chain.
    if (insertErr.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true })
    }
    console.error('[yookassa-webhook] insert failed:', insertErr.message)
    // Return 500 — ЮKassa will retry within 24h
    return NextResponse.json({ ok: false, error: 'PERSIST_FAILED' }, { status: 500 })
  }

  // Step 4: side-effect dispatch (FOUNDATION PR — minimal).
  // Full subscription/payment row updates land in PR #23 together
  // with the new billing service. For now we acknowledge receipt and
  // mark the event as processed, so PR #23 can replay un-processed
  // ones if needed (idx_payment_events_unprocessed exists for this).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('payment_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('provider', 'yookassa')
    .eq('provider_event_id', result.providerEventId)

  return NextResponse.json({ ok: true, kind: result.kind })
}

/** Healthcheck — for ЮKassa "test webhook" button in ЛК */
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
