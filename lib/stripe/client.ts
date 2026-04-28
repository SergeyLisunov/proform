// Lazy-initialized Stripe client. Import inside route handlers only.
// Throws a clear error when STRIPE_SECRET_KEY is missing so local dev and
// staging fail loudly instead of silently.
import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Configure it in .env.local or Vercel env vars.'
    )
  }
  // Pin a known-working Stripe API version. Both `Stripe.LatestApiVersion`
  // and `Stripe.StripeConfig` were removed/renamed across SDK majors; the
  // simplest portable option is to bypass the literal-union check.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _stripe = new Stripe(key, { apiVersion: '2024-06-20' as any })
  return _stripe
}

export const STRIPE_PRICE_IDS = {
  pro:  process.env.STRIPE_PRICE_PRO  ?? '',
  team: process.env.STRIPE_PRICE_TEAM ?? '',
} as const

export type PlanKey = keyof typeof STRIPE_PRICE_IDS
