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
        const userId      = session.metadata?.user_id
        const orderId     = session.metadata?.order_id
        const plan        = session.metadata?.plan
        const passPlanId  = session.metadata?.pass_plan_id
        const coachId     = session.metadata?.coach_id
        if (session.mode === 'subscription' && userId && plan) {
          await sb.from('subscriptions').upsert({
            user_id: userId,
            plan,
            status: 'active',
            stripe_customer_id:     typeof session.customer     === 'string' ? session.customer     : null,
            stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
          }, { onConflict: 'user_id' })
        }
        // ── Coach pass-plan purchase → issue athlete_pass ────────────────
        if (session.mode === 'payment' && passPlanId && userId && coachId) {
          const total = parseInt(session.metadata?.total_sessions ?? '0', 10)
          const days  = parseInt(session.metadata?.period_days ?? '30', 10)
          const startISO = new Date().toISOString().slice(0, 10)
          const expiresISO = new Date(Date.now() + Math.max(0, days - 1) * 86400000).toISOString().slice(0, 10)
          // De-dupe: only issue once per stripe session id.
          const { data: existingPass } = await sb
            .from('athlete_passes').select('id')
            .eq('stripe_session_id', session.id)
            .maybeSingle()
          if (!existingPass) {
            await sb.from('athlete_passes').insert({
              coach_id:   coachId,
              athlete_id: userId,
              plan_id:    passPlanId,
              title:      session.metadata?.plan_title ?? 'Абонемент',
              total_sessions: Math.max(1, total),
              used_sessions:  0,
              starts_at:  startISO,
              expires_at: expiresISO,
              price_cents: parseInt(session.metadata?.plan_price_cents ?? '0', 10),
              currency:    session.metadata?.plan_currency ?? 'RUB',
              status:      'active',
              stripe_session_id: session.id,
            })
            await sb.from('notifications').insert([
              {
                user_id: userId,
                type: 'pass_issued',
                title: 'Абонемент оплачен',
                body:  `${session.metadata?.plan_title ?? 'Абонемент'} · ${total} занятий`,
                entity_type: 'athlete_pass',
                entity_id:   null,
                action_url:  '/calendar',
              },
              {
                user_id: coachId,
                type: 'broadcast',
                title: 'Оплачен абонемент',
                body:  session.metadata?.plan_title ?? 'Абонемент',
                entity_type: 'athlete_pass',
                entity_id:   null,
                action_url:  '/athletes',
              },
            ])
            await sb.from('payments').insert({
              user_id: userId,
              order_id: null,
              stripe_session_id: session.id,
              stripe_payment_intent_id:
                typeof session.payment_intent === 'string' ? session.payment_intent : null,
              amount: session.amount_total ? Math.floor(session.amount_total / 100) : 0,
              currency: (session.currency ?? 'rub').toUpperCase(),
              status: 'succeeded',
              raw: session as unknown as Record<string, unknown>,
            })
          }
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
