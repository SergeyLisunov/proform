'use client'

/**
 * TelegramLinkCard — привязка Telegram на странице настроек уведомлений (P2).
 *
 * Флоу: POST /api/telegram/link → одноразовый deep-link (TTL 10 мин,
 * SHA-256-хэш в БД) → пользователь жмёт /start в боте → бот линкует.
 * Отвязка — DELETE (или /unlink в боте). Статус линковки читается из
 * telegram_accounts под RLS (self-read).
 *
 * Сама линковка ни на что не подписывает — зеркалирование включается
 * тумблером «Telegram» выше (opt-in, дефолт выключен).
 */
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/metronic'

interface LinkState {
  linked: boolean
  username: string | null
}

export default function TelegramLinkCard({ userId }: { userId: string }) {
  const [state, setState] = useState<LinkState | null>(null)
  const [deepLink, setDeepLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    const sb = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(sb as any).from('telegram_accounts')
      .select('tg_username, unlinked_at')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }: { data: { tg_username: string | null; unlinked_at: string | null } | null }) => {
        if (cancelled) return
        setState({ linked: !!data && !data.unlinked_at, username: data?.tg_username ?? null })
      })
    return () => { cancelled = true }
  }, [userId])

  async function generateLink() {
    setBusy(true)
    const res = await fetch('/api/telegram/link', { method: 'POST' })
    if (res.status === 503) { setUnavailable(true); setBusy(false); return }
    const data = await res.json().catch(() => null)
    if (res.ok && data?.url) setDeepLink(data.url as string)
    setBusy(false)
  }

  async function unlink() {
    setBusy(true)
    await fetch('/api/telegram/link', { method: 'DELETE' })
    setState({ linked: false, username: null })
    setDeepLink(null)
    setBusy(false)
  }

  if (state === null) return null

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
            <i className="ki-filled ki-message-text-2 text-lg" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-navy-500">Telegram-бот</h3>
            <p className="mt-0.5 text-2xs text-muted-foreground">
              {state.linked
                ? `Привязан${state.username ? `: @${state.username}` : ''}. Зеркалирование включается тумблером «Telegram» выше.`
                : 'Привяжите Telegram, чтобы получать уведомления в мессенджер (только заголовок и ссылка — детали остаются в приложении).'}
            </p>
            {unavailable && (
              <p className="mt-1.5 text-2xs text-warning">Бот пока не настроен на сервере — попробуйте позже.</p>
            )}
            {deepLink && !state.linked && (
              <a
                href={deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-2xs font-semibold text-white hover:bg-sky-600"
              >
                Открыть бота и подтвердить
                <i className="ki-filled ki-arrow-up-right text-[10px]" />
              </a>
            )}
            {deepLink && !state.linked && (
              <p className="mt-1 text-2xs text-muted-foreground">Ссылка одноразовая, действует 10 минут. После /start обновите страницу.</p>
            )}
          </div>
        </div>
        <div className="shrink-0">
          {state.linked ? (
            <button
              onClick={unlink}
              disabled={busy}
              className="rounded-lg border border-border px-3 py-1.5 text-2xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              Отвязать
            </button>
          ) : !deepLink ? (
            <button
              onClick={generateLink}
              disabled={busy || unavailable}
              className="rounded-lg bg-sky-500 px-3 py-1.5 text-2xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
            >
              Подключить
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  )
}
