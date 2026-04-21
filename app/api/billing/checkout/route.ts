import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe, STRIPE_PRICE_IDS, type PlanKey } from '@/lib/stripe/client'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const plan = body.plan as PlanKey | undefined
    const serviceId = typeof body.serviceId === 'string' ? body.serviceId : null
    if (!plan && !serviceId) {
      return NextResponse.json({ error: 'plan or serviceId required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('auth_id', authUser.id)
      .single()
    if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const stripe = getStripe()
    const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://proform-delta.vercel.app'

    // ── Subscription checkout ────────────────────────────────────────
    if (plan) {
      const priceId = STRIPE_PRICE_IDS[plan]
      if (!priceId) {
        return NextResponse.json({ error: `Stripe price for plan "${plan}" not configured` }, { status: 500 })
      }
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', me.id)
        .maybeSingle()
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        customer: existingSub?.stripe_customer_id || undefined,
        customer_email: existingSub?.stripe_customer_id ? undefined : me.email ?? undefined,
        client_reference_id: me.id,
        metadata: { user_id: me.id, plan },
        success_url: `${origin}/settings?billing=success`,
        cancel_url:  `${origin}/pricing?billing=cancelled`,
        allow_promotion_codes: true,
      })
      return NextResponse.json({ url: session.url })
    }

    // ── Coach service one-off purchase ──────────────────────────────
    const { data: service } = await supabase
      .from('coach_services')
      .select('id, coach_id, title, description, price_amount, currency, is_active')
      .eq('id', serviceId!)
      .single()
    if (!service || !service.is_active) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 404 })
    }
    if (service.coach_id === me.id) {
      return NextResponse.json({ error: 'Cannot purchase your own service' }, { status: 422 })
    }

    const { data: order, error: orderErr } = await supabase
      .from('coach_orders')
      .insert({
        service_id: service.id,
        coach_id: service.coach_id,
        athlete_id: me.id,
        status: 'pending',
        price_amount: service.price_amount,
        currency: service.currency,
      })
      .select('id')
      .single()
    if (orderErr || !order) {
      return NextResponse.json({ error: orderErr?.message ?? 'Failed to create order' }, { status: 500 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: service.currency.toLowerCase(),
          product_data: { name: service.title, description: service.description ?? undefined },
          unit_amount: service.price_amount * 100, // Stripe uses minor units
        },
        quantity: 1,
      }],
      client_reference_id: me.id,
      customer_email: me.email ?? undefined,
      metadata: { user_id: me.id, order_id: order.id, coach_id: service.coach_id },
      success_url: `${origin}/network?order=success`,
      cancel_url:  `${origin}/profile/${service.coach_id}?order=cancelled`,
    })

    await supabase
      .from('coach_orders')
      .update({ stripe_session_id: session.id })
      .eq('id', order.id)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
