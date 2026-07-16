/**
 * Telegram-бот Sporteo (P2) — grammY, webhook-режим.
 *
 * Бот — ВТОРОЙ UI над той же моделью авторизации, никогда не обход:
 * каждый хэндлер резолвит telegram_user_id → telegram_accounts →
 * users.id и работает только с данными этого пользователя.
 *
 * Child-safety / 152-ФЗ: в Telegram НИКОГДА не уходят медицинские
 * детали, данные детей и тела уведомлений — только заголовок + deep-link
 * в приложение (см. очередь в 099 и process-queue). Сама линковка ни на
 * что не подписывает: зеркалирование включается явным тумблером
 * «Telegram» в настройках уведомлений (opt-in).
 *
 * MVP-команды: /start (+ линковка по одноразовому коду), /unlink, /help.
 * Ролевые команды (/schedule, /status-светофор, /rsvp) — следующая
 * итерация: им нужен полный authorization-parity слой.
 *
 * Env: TELEGRAM_BOT_TOKEN (только сервер), TELEGRAM_WEBHOOK_SECRET.
 * Деплой на Hostiman: EU-локация (api.telegram.org фильтруется из RU-ЦОД).
 */
import { Bot } from 'grammy'
import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://proform-delta.vercel.app'

let botSingleton: Bot | null = null

export function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN ?? null
}

export function hashLinkCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

export function getBot(): Bot {
  if (botSingleton) return botSingleton
  const token = getBotToken()
  if (!token) throw new Error('TELEGRAM_NOT_CONFIGURED')

  const bot = new Bot(token)

  bot.command('start', async ctx => {
    const payload = ctx.match?.trim()
    const from = ctx.from
    if (!from || ctx.chat?.type !== 'private') return

    if (!payload) {
      await ctx.reply(
        'Привет! Это бот Sporteo.\n\n' +
        'Чтобы привязать аккаунт, откройте в приложении «Настройки → Уведомления → Подключить Telegram» и перейдите по персональной ссылке.\n\n' +
        `Приложение: ${APP_URL}`,
      )
      return
    }

    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminAny = admin as any

    const { data: codeRow } = await adminAny.from('telegram_link_codes')
      .select('id, user_id, expires_at, used_at')
      .eq('code_hash', hashLinkCode(payload))
      .maybeSingle()
    const code = codeRow as { id: string; user_id: string; expires_at: string; used_at: string | null } | null

    if (!code || code.used_at || new Date(code.expires_at).getTime() < Date.now()) {
      await ctx.reply('Ссылка недействительна или устарела. Сгенерируйте новую в настройках приложения.')
      return
    }

    // Single-use код + upsert линковки (один TG ↔ один аккаунт платформы).
    const { error: upsertErr } = await adminAny.from('telegram_accounts').upsert({
      user_id:          code.user_id,
      telegram_user_id: from.id,
      chat_id:          ctx.chat.id,
      tg_username:      from.username ?? null,
      linked_at:        new Date().toISOString(),
      unlinked_at:      null,
    }, { onConflict: 'user_id' })
    if (upsertErr) {
      await ctx.reply('Не получилось привязать аккаунт — попробуйте ещё раз позже.')
      return
    }
    await adminAny.from('telegram_link_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', code.id)

    const { data: userRow } = await adminAny.from('users')
      .select('name').eq('id', code.user_id).maybeSingle()
    const name = (userRow as { name: string | null } | null)?.name ?? 'ваш аккаунт'

    await ctx.reply(
      `Готово — Telegram привязан к аккаунту «${name}».\n\n` +
      'Уведомления сюда придут только после включения тумблера «Telegram» в настройках уведомлений (по умолчанию выключен).\n\n' +
      'Отвязать: /unlink',
    )
  })

  bot.command('unlink', async ctx => {
    const from = ctx.from
    if (!from || ctx.chat?.type !== 'private') return
    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any).from('telegram_accounts')
      .update({ unlinked_at: new Date().toISOString() })
      .eq('telegram_user_id', from.id)
      .is('unlinked_at', null)
      .select('user_id')
    if ((data ?? []).length > 0) {
      await ctx.reply('Telegram отвязан — отправка уведомлений остановлена. Привязать снова можно из настроек приложения.')
    } else {
      await ctx.reply('Активной привязки не найдено.')
    }
  })

  bot.command('help', async ctx => {
    await ctx.reply(
      'Команды:\n' +
      '/start — привязка аккаунта (по ссылке из приложения)\n' +
      '/unlink — отвязать Telegram\n\n' +
      `Всё остальное — в приложении: ${APP_URL}`,
    )
  })

  botSingleton = bot
  return bot
}
