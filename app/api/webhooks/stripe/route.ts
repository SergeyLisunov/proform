import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { createClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

// Service-role client for webhook-driven writes bypassing RLS.
function getServiceClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) throw new Error('Supabase service-role env vars missing')
  return createClient(url, service, { auth: { persistSession: false } })
}

function mapSubscriptionStatus(s: Stripe.Subscription.Status) {
  switch (s) {
    case 'active':     return 'active'
    case 'past_due':   return 'past_due'
    case 'canceled':   return 'canceled'
    case 'unpaid':     return 'unpaid'
    case 'trialing':   return 'trialing'
    case 'incomplete':
    case 'incomplete_expired':
      return 'incomplete'
    default: return 'active'
  }
}

export async function POST(req: NextRequest) {
  const sig    = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !secret) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 })
  }

  const stripe = getStripe()
  const raw    = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    return NextResponse.json({ error: `Webhook signature failed: ${message}` }, { status: 400 })
  }

  const sb = getServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId  = session.metadata?.user_id
        const orderId = session.metadata?.order_id
        const plan    = session.metadata?.plan
        if (session.mode === 'subscription' && userId && plan) {
          await sb.from('subscriptions').upsert({
            user_id: userId,
            plan,
            status: 'active',
            stripe_customer_id:     typeof session.customer     === 'string' ? session.customer     : null,
            stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
          }, { onConflict: 'user_id' })
        }
        if (session.mode === 'payment' && orderId) {
          await sb.from('coach_orders').update({
            status: 'paid',
            paid_at: new Date().toISOString(),
          }).eq('id', orderId)
          await sb.from('payments').insert({
            user_id: userId!,
            order_id: orderId,
            stripe_session_id: session.id,
            stripe_payment_intent_id:
              typeof session.payment_intent === 'string' ? session.payment_intent : null,
            amount: session.amount_total ? Math.floor(session.amount_total / 100) : 0,
            currency: (session.currency ?? 'rub').toUpperCase(),
            status: 'succeeded',
            raw: session as unknown as Record<string, unknown>,
          })
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await sb.from('subscriptions').update({
          status: mapSubscriptionStatus(sub.status),
          current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          cancel_at_period_end: sub.cancel_at_period_end ?? false,
        }).eq('stripe_subscription_id', sub.id)
        break
      }
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice
        const userId = (inv.metadata?.user_id as string) || null
        if (userId) {
          await sb.from('invoices').insert({
            user_id: userId,
            stripe_invoice_id: inv.id,
            number: inv.number ?? null,
            amount: inv.amount_paid ? Math.floor(inv.amount_paid / 100) : 0,
            currency: (inv.currency ?? 'rub').toUpperCase(),
            hosted_invoice_url: inv.hosted_invoice_url ?? null,
            pdf_url: inv.invoice_pdf ?? null,
            status: inv.status ?? 'open',
          })
        }
        break
      }
    }
  } catch (err) {
    console.error('[stripe-webhook] handler error', err)
    return NextResponse.json({ received: true, handled: false }, { status: 200 })
  }

  return NextResponse.json({ received: true })
}
