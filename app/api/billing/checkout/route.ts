import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPaymentIntent } from '@/services/billing.service'

/**
 * POST /api/billing/checkout — Sprint W6 Day 28 (ЮKassa-only).
 *
 * Sprint W2 Day 7 introduced ЮKassa alongside Stripe. Sprint W6 Day 28
 * removed Stripe entirely (focus shifted to RU/CIS market). The route
 * now exclusively dispatches via `billing.service.createPaymentIntent`
 * with `provider='yookassa'`.
 *
 * Body shape:
 *   { tariffCode: string }                 — subscription checkout
 *   { passPlanId: string }                 — 410 GONE (Marketplace Split Payments WIP)
 *   { serviceId: string }                  — 410 GONE (Marketplace Split Payments WIP)
 *   { plan: 'pro' | 'team' }               — 410 GONE (legacy Stripe price-id flow removed)
 *
 * On success: { url: confirmation_url, payment_id, provider: 'yookassa' }.
 * Auth required (RLS on payments/subscriptions).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const tariffCode = typeof body.tariffCode === 'string' ? body.tariffCode : null

    // ── Legacy Stripe params: gone in Sprint W6 ────────────────────────────
    if (typeof body.plan === 'string') {
      return NextResponse.json(
        {
          error: 'LEGACY_STRIPE_FLOW_REMOVED',
          message: 'Подписочный flow с параметром `plan` удалён вместе со Stripe (W6 Day 28). Используйте `tariffCode` через ЮKassa: страница /pricing.',
        },
        { status: 410 },
      )
    }
    if (typeof body.passPlanId === 'string') {
      return NextResponse.json(
        {
          error: 'MARKETPLACE_SPLIT_PAYMENTS_PENDING',
          message: 'Покупка абонементов через marketplace требует ЮKassa Split Payments. Активация на стороне ЮKassa.',
        },
        { status: 503 },
      )
    }
    if (typeof body.serviceId === 'string') {
      return NextResponse.json(
        {
          error: 'MARKETPLACE_SPLIT_PAYMENTS_PENDING',
          message: 'Оплата услуг тренера через marketplace требует ЮKassa Split Payments. Активация на стороне ЮKassa.',
        },
        { status: 503 },
      )
    }

    if (!tariffCode) {
      return NextResponse.json(
        { error: 'tariffCode required (provider=yookassa is implicit)' },
        { status: 400 },
      )
    }

    // ── Auth ──────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: me } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('auth_id', authUser.id)
      .single()
    if (!me) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // ── ЮKassa subscription checkout ──────────────────────────────────────
    const origin =
      req.headers.get('origin') ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      'https://proform-delta.vercel.app'
    try {
      const result = await createPaymentIntent({
        userId:    me.id,
        tariffCode,
        provider:  'yookassa',
        returnUrl: `${origin}/settings?billing=success&payment_id={payment_id}`,
      })
      return NextResponse.json({
        url:        result.confirmationUrl,
        payment_id: result.paymentId,
        provider:   'yookassa',
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'CHECKOUT_FAILED'
      const status =
        msg.startsWith('YOOKASSA_NOT_CONFIGURED') ? 503 :
        msg.startsWith('TARIFF_NOT_FOUND')        ? 404 :
        msg.startsWith('TARIFF_FREE_NO_CHECKOUT') ? 400 :
        500
      return NextResponse.json({ error: msg }, { status })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
