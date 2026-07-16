'use client'
/**
 * /settings/notifications — Sprint W5 Day 27 (PR #44).
 *
 * Per-channel notification toggles. Category-grouped (Core / Collaboration /
 * Marketing). Backend cron routes используют should_send_notification(user_id,
 * channel) RPC — migration to all routes is W6 polish (incremental).
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import { Card, Alert } from '@/components/ui/metronic'
import {
  loadMyPrefs, updateMyPrefs, effective,
  CHANNELS, type NotificationChannel, type NotificationPrefs,
} from '@/services/notification-prefs.service'
import TelegramLinkCard from '@/components/settings/TelegramLinkCard'

const CATEGORY_META = {
  core:          { label: 'Основные',         description: 'Регулярные сводки — выключайте если не нужно' },
  collaboration: { label: 'Совместная работа', description: 'Сообщения от тренеров и врачей' },
  marketing:     { label: 'Маркетинг',         description: 'Drip-кампании и marketplace; не влияют на core flows' },
}

export default function NotificationSettingsPage() {
  const { user, loading: userLoading } = useUser()
  const [prefs, setPrefs]         = useState<NotificationPrefs>({})
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState<NotificationChannel | null>(null)
  const [savedAt, setSavedAt]     = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setPrefs(await loadMyPrefs())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (userLoading) return
    if (!user) { setLoading(false); return }
    load()
  }, [user, userLoading, load])

  async function handleToggle(channel: NotificationChannel, next: boolean) {
    setSaving(channel)
    const patch: NotificationPrefs = { [channel]: next }
    // Optimistic update
    setPrefs(prev => ({ ...prev, [channel]: next }))
    try {
      const ok = await updateMyPrefs(patch)
      if (!ok) {
        // Revert
        setPrefs(prev => {
          const copy = { ...prev }
          delete copy[channel]
          return copy
        })
      } else {
        setSavedAt(Date.now())
      }
    } finally {
      setSaving(null)
    }
  }

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <i className="ki-filled ki-shield-cross text-3xl text-red-400" />
        <p className="text-sm font-semibold text-foreground">Войдите в аккаунт</p>
        <Link href="/auth/login?next=/settings/notifications" className="text-sm text-orange-600 font-semibold hover:underline">
          → Войти
        </Link>
      </div>
    )
  }

  const grouped = CHANNELS.reduce<Record<string, typeof CHANNELS>>((acc, ch) => {
    (acc[ch.category] ??= []).push(ch)
    return acc
  }, {})

  return (
    <div className="pf-enter max-w-3xl mx-auto px-4 py-8 flex flex-col gap-5">
      <div>
        <p className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground mb-1">Настройки</p>
        <h1 className="text-3xl font-bold text-navy-500">Уведомления</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-xl">
          Выберите какие emails получать. Изменения применяются мгновенно. Отписка не влияет на функциональность —
          вы можете вернуть любой канал когда нужно.
        </p>
      </div>

      {savedAt && Date.now() - savedAt < 3000 && (
        <Alert variant="success">Настройки сохранены</Alert>
      )}

      {/* P2 — привязка Telegram-бота (тумблер «Telegram» в core-группе ниже) */}
      <TelegramLinkCard userId={user.id} />

      {(['core', 'collaboration', 'marketing'] as Array<keyof typeof CATEGORY_META>).map(cat => {
        const channels = grouped[cat] ?? []
        const meta = CATEGORY_META[cat]
        return (
          <Card key={cat} className="p-5">
            <div className="mb-3">
              <h2 className="text-base font-bold text-navy-500">{meta.label}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
            </div>
            <div className="flex flex-col gap-2">
              {channels.map(ch => {
                const isOn = effective(prefs, ch.key)
                const isBusy = saving === ch.key
                return (
                  <label key={ch.key} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3 cursor-pointer hover:bg-accent/30 transition">
                    <i className={`ki-filled ${ch.icon} text-base text-muted-foreground mt-0.5`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-foreground">{ch.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{ch.description}</div>
                    </div>
                    {/* Toggle */}
                    <button type="button" disabled={isBusy}
                      onClick={() => handleToggle(ch.key, !isOn)}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
                        isOn ? 'bg-orange-500' : 'bg-slate-300'
                      }`}
                      aria-label={`Toggle ${ch.label}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition shadow ${
                        isOn ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </button>
                  </label>
                )
              })}
            </div>
          </Card>
        )
      })}

      <Alert variant="warning" title="Что не отключается">
        <ul className="space-y-1">
          <li>• Подтверждения подписки и платежей (требование 152-ФЗ)</li>
          <li>• Email подтверждение регистрации</li>
          <li>• Сброс пароля и security-events</li>
          <li>• Уведомления о приёме в команду/организацию</li>
        </ul>
        <p className="mt-2">
          Эти emails необходимы для функционирования аккаунта и не отключаются.
        </p>
      </Alert>
    </div>
  )
}
