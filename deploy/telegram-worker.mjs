#!/usr/bin/env node
/**
 * telegram-worker.mjs — PM2-воркер Telegram-бота Sporteo на Hostiman (P2).
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ ПРОЦЕСС (research-рекомендация для RU-хостинга):
 *   1. Очередь уведомлений обрабатывается каждые N секунд (дефолт 15)
 *      вместо crontab-минуты — доставка почти мгновенная.
 *   2. Аварийный режим TELEGRAM_MODE=polling: если входящий
 *      webhook-трафик от Telegram начнут фильтровать (реальность
 *      RU-сетей 2025–2026), воркер сам снимает вебхук и тянет апдейты
 *      long-polling'ом, проксируя их в ТОТ ЖЕ роут приложения — вся
 *      логика бота остаётся в одном месте (lib/telegram/bot.ts),
 *      переключение без правки кода.
 *   3. Падения/рестарты воркера не трогают веб-приложение и наоборот.
 *
 * ДИЗАЙН: ноль зависимостей (Node 20 built-in fetch). Воркер НЕ ходит
 * в БД и НЕ содержит логики бота — он «насос»: дёргает локальные
 * эндпоинты приложения (127.0.0.1, без TLS-хопа) и api.telegram.org.
 *
 * Env (те же, что у приложения, + два своих):
 *   TELEGRAM_BOT_TOKEN        — токен бота (обязателен)
 *   TELEGRAM_WEBHOOK_SECRET   — тот же секрет, что у приложения
 *   CRON_SECRET               — Bearer для process-queue
 *   APP_INTERNAL_URL          — дефолт http://127.0.0.1:3000
 *   TELEGRAM_MODE             — webhook (дефолт) | polling
 *   TELEGRAM_QUEUE_INTERVAL_SEC — дефолт 15
 *
 * Запуск (PM2, см. deploy/ecosystem.config.js):
 *   pm2 start deploy/ecosystem.config.js --only sporteo-tg-worker
 * Локальная проверка: node deploy/telegram-worker.mjs
 */

const TOKEN      = process.env.TELEGRAM_BOT_TOKEN
const SECRET     = process.env.TELEGRAM_WEBHOOK_SECRET
const CRON       = process.env.CRON_SECRET
const APP        = (process.env.APP_INTERNAL_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')
const MODE       = process.env.TELEGRAM_MODE === 'polling' ? 'polling' : 'webhook'
const INTERVAL_S = Math.max(5, Number(process.env.TELEGRAM_QUEUE_INTERVAL_SEC ?? '15') || 15)
const TG         = `https://api.telegram.org/bot${TOKEN}`

if (!TOKEN || !CRON) {
  console.error('[tg-worker] FATAL: нужны TELEGRAM_BOT_TOKEN и CRON_SECRET в env')
  process.exit(1)
}
if (MODE === 'polling' && !SECRET) {
  console.error('[tg-worker] FATAL: polling-режим требует TELEGRAM_WEBHOOK_SECRET (для проксирования в роут)')
  process.exit(1)
}

let stopping = false
const log = (...a) => console.log(new Date().toISOString(), '[tg-worker]', ...a)
const sleep = ms => new Promise(r => setTimeout(r, ms))

process.on('SIGTERM', () => { stopping = true; log('SIGTERM — останавливаюсь') })
process.on('SIGINT',  () => { stopping = true; log('SIGINT — останавливаюсь') })

// ── Насос №1: очередь уведомлений ──────────────────────────────────────────
async function queueLoop() {
  log(`queue-loop: каждые ${INTERVAL_S}с → ${APP}/api/telegram/process-queue`)
  let failStreak = 0
  while (!stopping) {
    try {
      const res = await fetch(`${APP}/api/telegram/process-queue`, {
        headers: { Authorization: `Bearer ${CRON}` },
        signal: AbortSignal.timeout(55_000),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        failStreak++
        log(`queue: HTTP ${res.status}`, JSON.stringify(body).slice(0, 200))
      } else {
        failStreak = 0
        // Тишина, когда очередь пуста; лог только при работе/ошибках.
        if ((body.batch ?? 0) > 0) log('queue:', JSON.stringify(body))
      }
    } catch (e) {
      failStreak++
      log('queue: ошибка —', e?.message ?? e)
    }
    // Бэкофф при серии ошибок (приложение перезапускается и т.п.)
    await sleep((failStreak > 3 ? INTERVAL_S * 4 : INTERVAL_S) * 1000)
  }
}

// ── Насос №2 (только polling): getUpdates → локальный webhook-роут ────────
async function pollingLoop() {
  log('polling-loop: снимаю вебхук (getUpdates и webhook взаимоисключающи)…')
  try {
    const res = await fetch(`${TG}/deleteWebhook`, { signal: AbortSignal.timeout(15_000) })
    log('deleteWebhook:', JSON.stringify(await res.json().catch(() => ({}))))
  } catch (e) {
    log('deleteWebhook не удался (продолжаю, getUpdates сам ругнётся 409):', e?.message ?? e)
  }

  let offset = 0
  while (!stopping) {
    try {
      const res = await fetch(
        `${TG}/getUpdates?timeout=50&offset=${offset}&allowed_updates=${encodeURIComponent('["message"]')}`,
        { signal: AbortSignal.timeout(60_000) },
      )
      const body = await res.json().catch(() => null)
      if (!body?.ok) {
        log('getUpdates не ok:', JSON.stringify(body).slice(0, 200))
        await sleep(5_000)
        continue
      }
      for (const update of body.result ?? []) {
        offset = update.update_id + 1
        // Проксируем в тот же роут, что принимает вебхуки: логика бота
        // остаётся единственной. Заголовок секрета — как у Telegram.
        try {
          const fwd = await fetch(`${APP}/api/telegram/webhook`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Telegram-Bot-Api-Secret-Token': SECRET,
            },
            body: JSON.stringify(update),
            signal: AbortSignal.timeout(30_000),
          })
          if (!fwd.ok) log(`forward update ${update.update_id}: HTTP ${fwd.status}`)
        } catch (e) {
          log(`forward update ${update.update_id} не удался:`, e?.message ?? e)
        }
      }
    } catch (e) {
      // Сетевые обрывы long-poll — норма; тихий ретрай с паузой.
      if (!stopping) await sleep(5_000)
    }
  }
}

// ── Health-строка раз в 5 минут, чтобы в pm2 logs была жизнь ──────────────
async function heartbeat() {
  while (!stopping) {
    await sleep(300_000)
    if (!stopping) log(`heartbeat: mode=${MODE}, queue каждые ${INTERVAL_S}с`)
  }
}

log(`старт: mode=${MODE}, app=${APP}`)
const loops = [queueLoop(), heartbeat()]
if (MODE === 'polling') loops.push(pollingLoop())
await Promise.all(loops)
log('остановлен')
