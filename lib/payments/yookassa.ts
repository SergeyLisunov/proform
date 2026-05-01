/**
 * ЮKassa payment provider — minimal HTTP client.
 *
 * Why hand-rolled instead of `@yookassa/node-sdk`:
 *   - The official SDK is CommonJS-first, types are loose, and we
 *     only use 4 endpoints: payments.create, payments.capture,
 *     refunds.create, payment_methods.attach. Hand-rolled fetch
 *     keeps bundle size tiny and types tight.
 *   - We need to control exact HTTP semantics (Idempotence-Key
 *     header, retry on 5xx) — easier with raw fetch.
 *
 * Reference: https://yookassa.ru/developers/api
 *
 * Env vars (required for production, stub-mode otherwise):
 *   YOOKASSA_SHOP_ID         — numeric shop id from ЛК
 *   YOOKASSA_SECRET_KEY      — secret key (test_* or live_*)
 *   YOOKASSA_API_URL         — defaults to https://api.yookassa.ru/v3
 *   YOOKASSA_RETURN_URL      — defaults to NEXT_PUBLIC_SITE_URL
 *
 * Webhook verification: ЮKassa publishes 6 IP ranges. We trust those
 * ranges only. For extra safety the route handler ALSO checks the
 * payment status against ЮKassa API after receiving the event (audit's
 * "trust but verify" pattern).
 */

import type {
  CheckoutInput, CheckoutResult,
  ChargeRecurringInput,
  RefundInput, RefundResult,
  WebhookResult, WebhookEventKind,
  PaymentProvider,
} from './provider'

const API_URL_DEFAULT = 'https://api.yookassa.ru/v3'

/**
 * IP whitelist — official ЮKassa published ranges for webhook callers.
 * Source: https://yookassa.ru/developers/using-api/webhooks#ip
 *
 * IPv4 CIDR ranges + a couple of single addresses + IPv6 prefix.
 * Webhook handler (route layer) is responsible for matching incoming
 * `x-forwarded-for` against this list before trusting the body.
 */
export const YOOKASSA_WEBHOOK_IPS = [
  '185.71.76.0/27',
  '185.71.77.0/27',
  '77.75.153.0/25',
  '77.75.156.11',
  '77.75.156.35',
  '77.75.154.128/25',
  '2a02:5180::/32',
] as const

function getEnv() {
  return {
    shopId:    process.env.YOOKASSA_SHOP_ID,
    secretKey: process.env.YOOKASSA_SECRET_KEY,
    apiUrl:    process.env.YOOKASSA_API_URL ?? API_URL_DEFAULT,
    returnUrl: process.env.YOOKASSA_RETURN_URL
            ?? process.env.NEXT_PUBLIC_SITE_URL
            ?? 'http://localhost:3000',
    testMode:  process.env.YOOKASSA_TEST_MODE === 'true',
  }
}

function authHeader(shopId: string, secretKey: string): string {
  return 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64')
}

/** Convert kopeks (integer) to ЮKassa decimal string ("123.45"). */
function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2)
}

interface YooKassaPaymentResponse {
  id: string
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled'
  paid: boolean
  amount: { value: string; currency: string }
  confirmation?: { type: string; confirmation_url?: string }
  payment_method?: {
    id: string
    saved: boolean
    type: string
  }
  metadata?: Record<string, string>
}

interface YooKassaWebhookBody {
  type: string
  event: string
  object: YooKassaPaymentResponse | { id: string; payment_id?: string; status: string }
}

async function yookassaPost<T>(
  apiUrl: string,
  shopId: string,
  secretKey: string,
  path: string,
  body: unknown,
  idempotenceKey: string,
): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: {
      'Authorization':   authHeader(shopId, secretKey),
      'Idempotence-Key': idempotenceKey,
      'Content-Type':    'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`YooKassa ${path} ${res.status}: ${text.slice(0, 500)}`)
  }
  return res.json() as Promise<T>
}

export const YooKassaProvider: PaymentProvider = {
  id: 'yookassa',

  isConfigured(): boolean {
    const env = getEnv()
    return !!env.shopId && !!env.secretKey
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const env = getEnv()
    if (!env.shopId || !env.secretKey) {
      throw new Error('YOOKASSA_NOT_CONFIGURED')
    }
    const payload = {
      amount: {
        value:    centsToDecimal(input.amountCents),
        currency: input.currency,
      },
      capture: true, // single-stage payment — money locked immediately
      confirmation: {
        type:       'redirect',
        return_url: input.returnUrl,
      },
      description:        input.description.slice(0, 128),
      save_payment_method: input.recurring,
      metadata: {
        // Internal mapping. Always include payment_id + tariff so the
        // webhook can locate our row deterministically.
        payment_id:   input.paymentId,
        user_id:      input.userId,
        tariff_code:  input.tariffCode,
        environment:  env.testMode ? 'test' : 'live',
        ...(input.metadata ?? {}),
      },
    }
    const data = await yookassaPost<YooKassaPaymentResponse>(
      env.apiUrl, env.shopId, env.secretKey,
      '/payments', payload, input.idempotenceKey,
    )
    const url = data.confirmation?.confirmation_url
    if (!url) throw new Error('YooKassa response missing confirmation_url')
    return {
      providerPaymentId: data.id,
      confirmationUrl:   url,
      alreadyCaptured:   data.status === 'succeeded',
    }
  },

  async chargeRecurring(input: ChargeRecurringInput): Promise<CheckoutResult> {
    const env = getEnv()
    if (!env.shopId || !env.secretKey) {
      throw new Error('YOOKASSA_NOT_CONFIGURED')
    }
    // Recurring uses the saved payment_method_id and skips redirect.
    // ЮKassa returns succeeded immediately or fails with reason.
    const payload = {
      amount: {
        value:    centsToDecimal(input.amountCents),
        currency: input.currency,
      },
      capture:           true,
      payment_method_id: input.paymentMethodId,
      description:       input.description.slice(0, 128),
      metadata: {
        payment_id: input.paymentId,
        recurring:  'true',
        ...(input.metadata ?? {}),
      },
    }
    const data = await yookassaPost<YooKassaPaymentResponse>(
      env.apiUrl, env.shopId, env.secretKey,
      '/payments', payload, input.idempotenceKey,
    )
    return {
      providerPaymentId: data.id,
      // For recurring there's no redirect — user already authorized once.
      confirmationUrl:   '',
      alreadyCaptured:   data.status === 'succeeded',
    }
  },

  async refund(input: RefundInput): Promise<RefundResult> {
    const env = getEnv()
    if (!env.shopId || !env.secretKey) {
      throw new Error('YOOKASSA_NOT_CONFIGURED')
    }
    const payload: Record<string, unknown> = {
      payment_id: input.providerPaymentId,
    }
    if (typeof input.amountCents === 'number') {
      payload.amount = {
        value:    centsToDecimal(input.amountCents),
        currency: input.currency,
      }
    }
    if (input.reason) {
      payload.description = input.reason.slice(0, 128)
    }
    const data = await yookassaPost<{ id: string; status: string }>(
      env.apiUrl, env.shopId, env.secretKey,
      '/refunds', payload, input.idempotenceKey,
    )
    return {
      providerRefundId: data.id,
      status:           data.status === 'succeeded' ? 'refunded' : 'pending',
    }
  },

  async parseWebhook(req: Request, rawBody: string): Promise<WebhookResult> {
    // Stage 1: parse JSON
    let body: YooKassaWebhookBody
    try {
      body = JSON.parse(rawBody) as YooKassaWebhookBody
    } catch {
      return { verified: false, kind: 'unknown', providerEventId: null, providerPaymentId: null, raw: rawBody }
    }
    if (body.type !== 'notification' || !body.event || !body.object) {
      return { verified: false, kind: 'unknown', providerEventId: null, providerPaymentId: null, raw: body }
    }

    // Stage 2: IP allowlist check.
    const verified = isIpAllowed(getClientIp(req))

    // Stage 3: map event name to our enum.
    const kind: WebhookEventKind =
      body.event === 'payment.succeeded'           ? 'payment.succeeded' :
      body.event === 'payment.canceled'            ? 'payment.canceled'  :
      body.event === 'payment.waiting_for_capture' ? 'payment.waiting_for_capture' :
      body.event === 'refund.succeeded'            ? 'refund.succeeded'  :
      body.event === 'payment_method.active'       ? 'payment_method.active' :
      'unknown'

    // ЮKassa doesn't ship a top-level event id — we derive idempotency
    // from (provider_payment_id, event_name) which is unique per event.
    const obj = body.object as YooKassaPaymentResponse
    const providerPaymentId =
      // refund events have payment_id field referring back to original payment
      'payment_id' in (body.object as { payment_id?: string })
        ? (body.object as { payment_id?: string }).payment_id ?? obj.id
        : obj.id ?? null
    const providerEventId = `${body.event}:${obj.id ?? providerPaymentId ?? 'noop'}`

    return {
      verified,
      kind,
      providerEventId,
      providerPaymentId: providerPaymentId ?? null,
      raw: body,
    }
  },
}

// ── IP allowlist check ─────────────────────────────────────────────────────
// Minimal IPv4 CIDR matching. IPv6 (2a02:5180::/32) is checked by prefix.

function getClientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  return null
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    const v = Number(p)
    if (!Number.isInteger(v) || v < 0 || v > 255) return null
    n = (n << 8) | v
  }
  return n >>> 0
}

function inIpv4Cidr(ip: string, cidr: string): boolean {
  const [base, mask] = cidr.split('/')
  if (!mask) {
    // Single IP, exact match
    return ip === cidr
  }
  const bits = Number(mask)
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false
  const a = ipv4ToInt(ip)
  const b = ipv4ToInt(base)
  if (a === null || b === null) return false
  if (bits === 0) return true
  const maskN = (~0 << (32 - bits)) >>> 0
  return (a & maskN) === (b & maskN)
}

export function isIpAllowed(ip: string | null): boolean {
  if (!ip) return false
  if (ip.includes(':')) {
    // IPv6: simple prefix match against 2a02:5180::/32 → first 32 bits
    return ip.toLowerCase().startsWith('2a02:5180:')
  }
  for (const range of YOOKASSA_WEBHOOK_IPS) {
    if (range.includes(':')) continue // skip IPv6 in v4 path
    if (inIpv4Cidr(ip, range)) return true
  }
  return false
}
