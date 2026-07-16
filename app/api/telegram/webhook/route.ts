import { webhookCallback } from 'grammy'
import { NextResponse } from 'next/server'
import { getBot, getBotToken } from '@/lib/telegram/bot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * POST /api/telegram/webhook — приём апдейтов Telegram (P2).
 *
 * Верификация: secret_token из setWebhook → заголовок
 * X-Telegram-Bot-Api-Secret-Token, проверяет grammY (timing-safe).
 * Без TELEGRAM_WEBHOOK_SECRET вебхук не принимается вовсе.
 *
 * Регистрация (после выкладки, один раз):
 *   curl "https://api.telegram.org/bot$TOKEN/setWebhook" \
 *     -d url=https://<домен>/api/telegram/webhook \
 *     -d secret_token=$TELEGRAM_WEBHOOK_SECRET \
 *     -d drop_pending_updates=true
 */
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!getBotToken() || !secret) {
    return NextResponse.json({ ok: false, error: 'TELEGRAM_NOT_CONFIGURED' }, { status: 503 })
  }
  try {
    const handler = webhookCallback(getBot(), 'std/http', { secretToken: secret })
    return await handler(req)
  } catch (e) {
    // 200, чтобы Telegram не копил ретраи на ошибках хэндлеров.
    console.error('[telegram-webhook]', e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: true })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/telegram/webhook',
    configured: !!getBotToken() && !!process.env.TELEGRAM_WEBHOOK_SECRET,
  })
}
