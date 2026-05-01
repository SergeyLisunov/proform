/**
 * Payment provider registry.
 *
 * Returns a `PaymentProvider` implementation by id. Throws if asked for
 * a provider that's not configured (no env vars). Routes call this AT
 * REQUEST TIME to fail fast on missing credentials, rather than at
 * import time which would break local dev when only one provider is set.
 */

import type { PaymentProvider, ProviderId } from './provider'
import { YooKassaProvider } from './yookassa'

const REGISTRY: Record<Exclude<ProviderId, 'manual'>, PaymentProvider> = {
  stripe:   { /* stripe adapter is provided through the existing /lib/stripe code; foundation PR keeps Stripe path untouched */ } as unknown as PaymentProvider,
  yookassa: YooKassaProvider,
}

export function getProvider(id: ProviderId): PaymentProvider {
  if (id === 'manual') {
    throw new Error('Manual provider has no automation; handle in admin UI only')
  }
  if (id === 'stripe') {
    // Existing Stripe checkout/webhook still go through `/api/billing/checkout`
    // (Stripe-specific code path) and `/api/webhooks/stripe`. The provider-
    // abstraction interface will swallow Stripe in PR #23 — for the
    // foundation PR we keep Stripe-as-is to avoid regressions.
    throw new Error('STRIPE_PROVIDER_USE_LEGACY_PATH — call /api/billing/checkout with no provider param')
  }
  const p = REGISTRY[id]
  if (!p) throw new Error(`Unknown payment provider: ${id}`)
  if (!p.isConfigured()) {
    throw new Error(`Payment provider "${id}" is not configured (missing env vars)`)
  }
  return p
}

/**
 * Returns the default provider for a new checkout, configurable via
 * `PAYMENTS_PROVIDER` env. Falls back to Stripe so existing flows keep
 * working without any env change.
 */
export function getDefaultProvider(): ProviderId {
  const env = process.env.PAYMENTS_PROVIDER as ProviderId | undefined
  if (env === 'yookassa' || env === 'stripe' || env === 'manual') return env
  return 'stripe'
}

export { YOOKASSA_WEBHOOK_IPS, isIpAllowed } from './yookassa'
export type * from './provider'
