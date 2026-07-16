/**
 * Payment provider registry — Sprint W6 Day 28 (ЮKassa-only).
 *
 * The platform supports RU/CIS market only. Stripe was removed in
 * Sprint W6 Day 28 (focus shifted from international to ЮKassa with
 * native СБП, Mir Pay, SberPay, 54-ФЗ fiscalization, and recurring).
 *
 * Adding a new gateway (e.g. Альфа-Банк as backup) = new file under
 * `lib/payments/<name>.ts` + register here. No changes needed in
 * route handlers — they go through getProvider().
 */
import type { PaymentProvider, ProviderId } from './provider'
import { YooKassaProvider } from './yookassa'
import { AlfaBankProvider } from './alfabank'

const REGISTRY: Record<Exclude<ProviderId, 'manual'>, PaymentProvider> = {
  yookassa: YooKassaProvider,
  alfabank: AlfaBankProvider,
}

export function getProvider(id: ProviderId): PaymentProvider {
  if (id === 'manual') {
    throw new Error('Manual provider has no automation; handle in admin UI only')
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
 * `PAYMENTS_PROVIDER` env (P2: `alfabank` — основной шлюз фаундера).
 * Provider switch = один env-флип, роуты не меняются.
 * `manual` is allowed for admin overrides; all other values fall back.
 */
export function getDefaultProvider(): ProviderId {
  const env = process.env.PAYMENTS_PROVIDER as ProviderId | undefined
  if (env === 'yookassa' || env === 'alfabank' || env === 'manual') return env
  return 'alfabank'
}

export { YOOKASSA_WEBHOOK_IPS, isIpAllowed } from './yookassa'
export type * from './provider'
