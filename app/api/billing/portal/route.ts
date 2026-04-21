import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single()
    if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', me.id)
      .maybeSingle()
    if (!sub?.stripe_customer_id) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 404 })
    }

    const stripe = getStripe()
    const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://proform-delta.vercel.app'
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/settings`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Portal failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
