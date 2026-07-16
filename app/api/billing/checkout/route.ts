import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPaymentIntent } from '@/services/billing.service'
import { createMarketplaceCheckout } from '@/services/marketplace-orders.service'
import { getDefaultProvider } from '@/lib/payments'

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
    // ── P2: маркетплейс жив — оплата на счёт платформы, комиссия
    // (PLATFORM_FEE_BPS) учитывается леджером platform_fee_cents ────────────
    const passPlanId = typeof body.passPlanId === 'string' ? body.passPlanId : null
    const serviceId  = typeof body.serviceId  === 'string' ? body.serviceId  : null

    if (passPlanId || serviceId) {
      const supabase = await createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const { data: me } = await supabase
        .from('users').select('id').eq('auth_id', authUser.id).single()
      if (!me) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      const origin =
        req.headers.get('origin') ??
        process.env.NEXT_PUBLIC_SITE_URL ??
        'https://proform-delta.vercel.app'
      try {
        const result = await createMarketplaceCheckout({
          buyerId:    me.id,
          passPlanId: passPlanId ?? undefined,
          serviceId:  serviceId ?? undefined,
          returnUrl:  `${origin}/athlete/passes?purchase=success`,
        })
        return NextResponse.json({
          url:        result.confirmationUrl,
          payment_id: result.paymentId,
          provider:   getDefaultProvider(),
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'CHECKOUT_FAILED'
        const status =
          msg.includes('NOT_CONFIGURED') || msg.includes('is not configured') ? 503 :
          msg.startsWith('OFFERING_NOT_FOUND')       ? 404 :
          msg.startsWith('OFFERING_FREE_NO_CHECKOUT') ? 400 :
          msg.startsWith('CANNOT_BUY_OWN_OFFERING')  ? 400 :
          500
        return NextResponse.json({ error: msg }, { status })
      }
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

    // ── Subscription checkout (P2: провайдер из PAYMENTS_PROVIDER env,
    // сейчас alfabank; ЮKassa остаётся зарегистрированной альтернативой) ──
    const providerId = getDefaultProvider()
    const origin =
      req.headers.get('origin') ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      'https://proform-delta.vercel.app'
    try {
      const result = await createPaymentIntent({
        userId:    me.id,
        tariffCode,
        returnUrl: `${origin}/settings?billing=success&payment_id={payment_id}`,
      })
      return NextResponse.json({
        url:        result.confirmationUrl,
        payment_id: result.paymentId,
        provider:   providerId,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'CHECKOUT_FAILED'
      const status =
        msg.startsWith('YOOKASSA_NOT_CONFIGURED')  ? 503 :
        msg.startsWith('ALFABANK_NOT_CONFIGURED')  ? 503 :
        msg.includes('is not configured')          ? 503 :
        msg.startsWith('TARIFF_NOT_FOUND')         ? 404 :
        msg.startsWith('TARIFF_FREE_NO_CHECKOUT')  ? 400 :
        500
      return NextResponse.json({ error: msg }, { status })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
