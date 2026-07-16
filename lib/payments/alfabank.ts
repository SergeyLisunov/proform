/**
 * Альфа-Банк интернет-эквайринг — provider implementation (P2).
 *
 * Классический REST-шлюз семейства register.do (RBS/BPC). Актуален в
 * 2026 (manual v27). Ключевые отличия от ЮKassa:
 *   - запросы application/x-www-form-urlencoded, НЕ JSON;
 *   - суммы в КОПЕЙКАХ (наш amountCents ложится 1:1, без конверсии);
 *   - идемпотентность через уникальный orderNumber (наш payments.id
 *     без дефисов, ровно 32 символа — лимит AN..32), а не заголовок;
 *   - callback приходит GET-запросом с HMAC-SHA256 checksum
 *     («симметричный» тип подписи, токен из ЛК);
 *   - callback — только триггер: оплату подтверждаем ТОЛЬКО через
 *     getOrderStatusExtended.do (orderStatus=2 = deposited).
 *
 * Env vars (без них — isConfigured()=false, checkout отвечает 503):
 *   ALFABANK_USERNAME        — API-логин (с суффиксом «-api»)
 *   ALFABANK_PASSWORD        — пароль API-пользователя
 *   ALFABANK_TOKEN           — альтернатива паре логин/пароль
 *   ALFABANK_API_URL         — прод-URL выдаёт поддержка банка
 *                              (pay.alfabank.ru или payment.alfabank.ru
 *                              для логинов с префиксом «r-»); дефолт —
 *                              тестовый https://alfa.rbsuat.com/payment/rest
 *   ALFABANK_CALLBACK_TOKEN  — токен симметричной подписи callback
 *   ALFABANK_RETURN_URL      — дефолт NEXT_PUBLIC_SITE_URL
 *
 * Маркетплейс-сплит здесь НЕ реализуется: нативное сплитование у Альфы —
 * отдельный продукт «Твои Платежи» (YPMN, JSON API v4). До его
 * подключения комиссия платформы считается леджером на нашей стороне
 * (platform_fee_* из миграции 050), деньги ложатся на счёт платформы.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import type {
  CheckoutInput, CheckoutResult,
  ChargeRecurringInput,
  RefundInput, RefundResult,
  WebhookResult, WebhookEventKind,
  PaymentProvider,
} from './provider'

const TEST_API_URL = 'https://alfa.rbsuat.com/payment/rest'

function getEnv() {
  return {
    userName:      process.env.ALFABANK_USERNAME,
    password:      process.env.ALFABANK_PASSWORD,
    token:         process.env.ALFABANK_TOKEN,
    apiUrl:        (process.env.ALFABANK_API_URL ?? TEST_API_URL).replace(/\/$/, ''),
    callbackToken: process.env.ALFABANK_CALLBACK_TOKEN,
    returnUrl:     process.env.ALFABANK_RETURN_URL
                ?? process.env.NEXT_PUBLIC_SITE_URL
                ?? 'http://localhost:3000',
    testMode:      process.env.ALFABANK_TEST_MODE === 'true',
  }
}

function isConfiguredEnv(env: ReturnType<typeof getEnv>): boolean {
  return !!env.token || (!!env.userName && !!env.password)
}

/** UUID → orderNumber: 32 hex-символа (лимит шлюза AN..32). */
function toOrderNumber(paymentId: string): string {
  return paymentId.replace(/-/g, '').slice(0, 32)
}

/** Шлюз отвергает запросы с HTML/JS-фрагментами в полях. */
function sanitize(text: string): string {
  return text.replace(/[<>]/g, '').slice(0, 512)
}

interface AlfaResponse {
  errorCode?: string | number
  errorMessage?: string
  orderId?: string
  formUrl?: string
  orderStatus?: number
  actionCode?: number
  bindingInfo?: { clientId?: string; bindingId?: string }
  paymentAmountInfo?: { depositedAmount?: number; approvedAmount?: number }
  [key: string]: unknown
}

async function alfaPost(path: string, params: Record<string, string>): Promise<AlfaResponse> {
  const env = getEnv()
  if (!isConfiguredEnv(env)) throw new Error('ALFABANK_NOT_CONFIGURED')

  const body = new URLSearchParams()
  if (env.token) body.set('token', env.token)
  else {
    body.set('userName', env.userName!)
    body.set('password', env.password!)
  }
  for (const [k, v] of Object.entries(params)) body.set(k, v)

  const res = await fetch(`${env.apiUrl}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`AlfaBank ${path} HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  const data = (await res.json()) as AlfaResponse
  // HTTP 200 у шлюза НЕ значит успех — только errorCode 0/отсутствует.
  const code = data.errorCode === undefined ? 0 : Number(data.errorCode)
  if (code !== 0) {
    throw new Error(`AlfaBank ${path} error ${code}: ${data.errorMessage ?? 'unknown'}`)
  }
  return data
}

/**
 * Авторитетная проверка статуса заказа. Вызывается вебхук-роутом перед
 * применением side-effects (callback — лишь триггер) и для полного
 * возврата без известной суммы.
 */
export async function getAlfaOrderStatus(mdOrder: string): Promise<{
  orderStatus: number
  bindingId: string | null
  depositedAmount: number | null
}> {
  const data = await alfaPost('/getOrderStatusExtended.do', { orderId: mdOrder })
  return {
    orderStatus:     typeof data.orderStatus === 'number' ? data.orderStatus : -1,
    // Связка приходит ВЛОЖЕННОЙ в bindingInfo (top-level bindingId в этом
    // ответе нет — он есть только в getBindings.do).
    bindingId:       data.bindingInfo?.bindingId ?? null,
    depositedAmount: data.paymentAmountInfo?.depositedAmount ?? null,
  }
}

export const AlfaBankProvider: PaymentProvider = {
  id: 'alfabank',

  isConfigured(): boolean {
    return isConfiguredEnv(getEnv())
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const env = getEnv()
    if (!isConfiguredEnv(env)) throw new Error('ALFABANK_NOT_CONFIGURED')

    const params: Record<string, string> = {
      orderNumber: toOrderNumber(input.paymentId),
      amount:      String(input.amountCents),  // копейки — 1:1
      returnUrl:   input.returnUrl,
      failUrl:     input.returnUrl,
      description: sanitize(input.description),
      language:    'ru',
      jsonParams:  JSON.stringify({
        payment_id:  input.paymentId,
        user_id:     input.userId,
        tariff_code: input.tariffCode,
        ...(input.metadata ?? {}),
      }),
    }
    // clientId включает создание binding (сохранённой карты) для
    // последующих рекуррентных списаний по подписке.
    if (input.recurring) params.clientId = input.userId

    const data = await alfaPost('/register.do', params)
    if (!data.orderId || !data.formUrl) {
      throw new Error('AlfaBank register.do: response missing orderId/formUrl')
    }
    return {
      providerPaymentId: data.orderId,
      confirmationUrl:   data.formUrl,
      alreadyCaptured:   false,
    }
  },

  async chargeRecurring(input: ChargeRecurringInput): Promise<CheckoutResult> {
    const env = getEnv()
    if (!isConfiguredEnv(env)) throw new Error('ALFABANK_NOT_CONFIGURED')

    // Двухшаговый MIT-флоу шлюза: регистрируем заказ, затем списываем
    // по сохранённой связке (bindingId) без участия плательщика.
    const reg = await alfaPost('/register.do', {
      orderNumber: toOrderNumber(input.paymentId),
      amount:      String(input.amountCents),
      returnUrl:   getEnv().returnUrl,
      description: sanitize(input.description),
      language:    'ru',
      jsonParams:  JSON.stringify({ payment_id: input.paymentId, recurring: 'true', ...(input.metadata ?? {}) }),
    })
    if (!reg.orderId) throw new Error('AlfaBank register.do (recurring): missing orderId')

    // Персист provider-id ДО списания: если binding-шаг упадёт или ответ
    // потеряется, deposited-callback всё равно найдёт payments-строку.
    // Throw колбэка отменяет списание — без персиста денег не двигаем.
    if (input.onProviderPaymentId) {
      await input.onProviderPaymentId(reg.orderId)
    }

    await alfaPost('/paymentOrderBinding.do', {
      mdOrder:   reg.orderId,
      bindingId: input.paymentMethodId,
    })

    // Доверяем только статусу заказа (deposited=2).
    const status = await getAlfaOrderStatus(reg.orderId)
    return {
      providerPaymentId: reg.orderId,
      confirmationUrl:   '',
      alreadyCaptured:   status.orderStatus === 2,
    }
  },

  async refund(input: RefundInput): Promise<RefundResult> {
    const env = getEnv()
    if (!isConfiguredEnv(env)) throw new Error('ALFABANK_NOT_CONFIGURED')

    // refund.do требует сумму всегда; «полный возврат» = depositedAmount.
    let amount = input.amountCents
    if (typeof amount !== 'number') {
      const status = await getAlfaOrderStatus(input.providerPaymentId)
      if (!status.depositedAmount) {
        throw new Error('AlfaBank refund: cannot resolve deposited amount for full refund')
      }
      amount = status.depositedAmount
    }
    await alfaPost('/refund.do', {
      orderId: input.providerPaymentId,
      amount:  String(amount),
    })
    // Отдельного refund-id у шлюза нет — возвраты привязаны к заказу.
    return {
      providerRefundId: `refund:${input.providerPaymentId}`,
      status:           'refunded',
    }
  },

  async parseWebhook(req: Request, rawBody: string): Promise<WebhookResult> {
    // Callback приходит GET-запросом с query-параметрами; на некоторых
    // конфигурациях — POST form-urlencoded. Собираем параметры из обоих.
    const url = new URL(req.url)
    const params = new Map<string, string>()
    url.searchParams.forEach((v, k) => params.set(k, v))
    if (rawBody && rawBody.includes('=')) {
      try {
        new URLSearchParams(rawBody).forEach((v, k) => {
          if (!params.has(k)) params.set(k, v)
        })
      } catch { /* не форма — игнорируем */ }
    }

    const mdOrder     = params.get('mdOrder') ?? null
    const operation   = params.get('operation') ?? ''
    const status      = params.get('status') ?? ''
    const checksum    = params.get('checksum') ?? null
    const rawObj      = Object.fromEntries(params.entries())

    if (!mdOrder || !operation) {
      return { verified: false, kind: 'unknown', providerEventId: null, providerPaymentId: null, raw: rawObj }
    }

    const verified = verifyChecksum(params, checksum)

    const ok = status === '1'
    const kind: WebhookEventKind =
      operation === 'deposited'         && ok  ? 'payment.succeeded' :
      operation === 'approved'          && ok  ? 'payment.waiting_for_capture' :
      (operation === 'refunded' || operation === 'reversed') && ok ? 'refund.succeeded' :
      operation === 'bindingCreated'    && ok  ? 'payment_method.active' :
      operation === 'declinedByTimeout'        ? 'payment.canceled' :
      (operation === 'deposited' || operation === 'approved') && !ok ? 'payment.canceled' :
      'unknown'

    return {
      verified,
      kind,
      // Один и тот же operation может доставляться повторно — дедуп по
      // тройке (operation, mdOrder, status) через UNIQUE в payment_events.
      providerEventId:   `${operation}:${mdOrder}:${status}`,
      // Для refund-callback mdOrder ссылается на исходный заказ — ровно
      // то, что нужно для поиска нашей payments-строки.
      providerPaymentId: mdOrder,
      raw: rawObj,
    }
  },
}

/**
 * Проверка «симметричной» подписи callback:
 * из параметров исключаются checksum и sign_alias, остальные сортируются
 * по имени, склеиваются в строку "name;value;...;" (с завершающей «;»),
 * HMAC-SHA256 с callback-токеном, UPPERCASE hex, timing-safe сравнение.
 * Порядок параметров в запросе произвольный — по сырой query string
 * проверять нельзя.
 */
function verifyChecksum(params: Map<string, string>, checksum: string | null): boolean {
  const token = getEnv().callbackToken
  // Безопасный дефолт: без настроенного токена (или подписи в callback)
  // уведомление не считается доверенным — включите «симметричный» тип
  // подписи в ЛК шлюза и положите токен в ALFABANK_CALLBACK_TOKEN.
  if (!token || !checksum) return false

  const entries = [...params.entries()]
    .filter(([k]) => k !== 'checksum' && k !== 'sign_alias')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  const payload = entries.map(([k, v]) => `${k};${v};`).join('')

  const expected = createHmac('sha256', token).update(payload).digest('hex').toUpperCase()
  const got = checksum.toUpperCase()
  if (expected.length !== got.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(got))
  } catch {
    return false
  }
}
