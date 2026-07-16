import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBotToken } from '@/lib/telegram/bot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH = 40
const MAX_ATTEMPTS = 5
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://proform-delta.vercel.app'

/**
 * GET /api/telegram/process-queue — отправка очереди зеркалирования (P2).
 *
 * Дизайн: очередь наполняет DB-триггер (099) на INSERT в notifications
 * (только явный opt-in). Этот эндпоинт дёргает планировщик:
 *   * Hostiman (после переезда): crontab `* * * * *` с CRON_SECRET —
 *     см. deploy-пакет P2-5;
 *   * на Vercel минутных кронов нет — очередь копится до крона/ручного
 *     вызова (деградация мягкая: в приложении уведомления живут всегда).
 *
 * В TG уходит ТОЛЬКО заголовок + deep-link (никаких тел уведомлений —
 * child-safety/152-ФЗ). Rate: ≤40 за прогон + 50 мс паузы — с запасом
 * ниже лимитов Bot API (30 msg/s). 403 (bot blocked) → skipped навсегда.
 */
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }
  const token = getBotToken()
  if (!token) {
    return NextResponse.json({ ok: false, error: 'TELEGRAM_NOT_CONFIGURED' }, { status: 503 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any
  const stats = { sent: 0, failed: 0, skipped: 0 }

  const { data: queueRaw } = await adminAny.from('telegram_deliveries')
    .select('id, chat_id, title, action_url, attempts')
    .eq('status', 'queued')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH)
  const queue = (queueRaw ?? []) as Array<{
    id: string; chat_id: number; title: string; action_url: string | null; attempts: number
  }>

  for (const d of queue) {
    const link = d.action_url
      ? (d.action_url.startsWith('http') ? d.action_url : `${APP_URL}${d.action_url}`)
      : APP_URL
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: d.chat_id,
          text: d.title,
          reply_markup: { inline_keyboard: [[{ text: 'Открыть в Sporteo', url: link }]] },
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error_code?: number; description?: string }

      if (body.ok) {
        await adminAny.from('telegram_deliveries')
          .update({ status: 'sent', sent_at: new Date().toISOString(), attempts: d.attempts + 1 })
          .eq('id', d.id)
        stats.sent += 1
      } else if (body.error_code === 403 || body.error_code === 400) {
        // Бот заблокирован / чат не найден — не ретраим никогда.
        await adminAny.from('telegram_deliveries')
          .update({ status: 'skipped', last_error: body.description ?? String(body.error_code), attempts: d.attempts + 1 })
          .eq('id', d.id)
        stats.skipped += 1
      } else {
        await adminAny.from('telegram_deliveries')
          .update({
            status: d.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'queued',
            last_error: body.description ?? `HTTP ${res.status}`,
            attempts: d.attempts + 1,
          })
          .eq('id', d.id)
        stats.failed += 1
      }
    } catch (e) {
      await adminAny.from('telegram_deliveries')
        .update({
          status: d.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'queued',
          last_error: e instanceof Error ? e.message : String(e),
          attempts: d.attempts + 1,
        })
        .eq('id', d.id)
      stats.failed += 1
    }
    // Пауза между отправками — с большим запасом ниже 30 msg/s.
    await new Promise(r => setTimeout(r, 50))
  }

  return NextResponse.json({ ok: true, batch: queue.length, ...stats })
}
