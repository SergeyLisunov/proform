'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

/**
 * Виджет на дашборде атлета: управление публичностью «Паспорта атлета»
 * и быстрый шэринг ссылки. Опирается на колонки athletes.profile_public
 * и athletes.workouts_public.
 */
export default function AthletePassportPanel({ userId }: { userId: string }) {
  const [nickname, setNickname]             = useState<string | null>(null)
  const [profilePublic, setProfilePublic]   = useState<boolean | null>(null)
  const [workoutsPublic, setWorkoutsPublic] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    const sb = createClient()
    const [ath, usr] = await Promise.all([
      sb.from('athletes').select('profile_public, workouts_public').eq('id', userId).maybeSingle(),
      sb.from('users').select('nickname').eq('id', userId).maybeSingle(),
    ])
    const a = ath.data as { profile_public: boolean | null; workouts_public: boolean | null } | null
    const u = usr.data as { nickname: string | null } | null
    setProfilePublic(a?.profile_public ?? false)
    setWorkoutsPublic(a?.workouts_public ?? false)
    setNickname(u?.nickname ?? null)
  }, [userId])
  useEffect(() => { load() }, [load])

  const toggleProfile = async (next: boolean) => {
    setSaving(true)
    const sb = createClient()
    await (sb as any).from('athletes').update({ profile_public: next }).eq('id', userId)
    setProfilePublic(next)
    setSaving(false)
  }
  const toggleWorkouts = async (next: boolean) => {
    setSaving(true)
    const sb = createClient()
    await (sb as any).from('athletes').update({ workouts_public: next }).eq('id', userId)
    setWorkoutsPublic(next)
    setSaving(false)
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://proform-delta.vercel.app'
  const url     = nickname ? `${baseUrl}/p/${nickname}` : null

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true); setTimeout(() => setCopied(false), 1800)
    } catch {}
  }
  const share = async () => {
    if (!url) return
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try { await (navigator as any).share({ title: 'Мой паспорт атлета · ProForm', url }) } catch {}
    } else { copy() }
  }

  if (!nickname) {
    return (
      <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-700">Паспорт атлета</p>
        <p className="text-sm text-foreground mt-1">
          Чтобы получить публичную ссылку <code className="font-mono bg-white px-1 rounded">/p/nickname</code>,
          задайте никнейм в настройках.
        </p>
        <Link href="/settings" className="mt-3 inline-block text-sm font-semibold text-orange-600 hover:underline">
          Настроить никнейм →
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-orange-50 via-white to-blue-50 p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-600">
            🪪 Паспорт атлета
          </span>
          <h3 className="pf-num text-xl font-bold text-foreground mt-2">
            {profilePublic ? 'Ваш профиль открыт для всех' : 'Сделай профиль публичным'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            {profilePublic
              ? 'Любой, у кого есть ссылка, увидит ваш спорт, PR и статистику за 90 дней.'
              : 'Включите — и получите шарабельную ссылку: PR, статистика, достижения. Идеально для соцсетей и клубов.'}
          </p>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" className="sr-only" disabled={saving}
            checked={profilePublic ?? false}
            onChange={e => toggleProfile(e.target.checked)} />
          <span className={`relative h-6 w-10 rounded-full transition-colors ${profilePublic ? 'bg-orange-500' : 'bg-slate-300'}`}>
            <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${profilePublic ? 'translate-x-4' : ''}`} />
          </span>
          <span className="text-[11px] font-semibold text-foreground">
            {profilePublic ? 'Публичный' : 'Приватный'}
          </span>
        </label>
      </div>

      {profilePublic && (
        <>
          <div className="mt-4 flex items-center gap-2 flex-wrap rounded-xl bg-white border border-border px-3 py-2">
            <span className="text-[11px] text-muted-foreground">Ссылка:</span>
            <code className="font-mono text-[11px] text-foreground flex-1 truncate">{url}</code>
            <button onClick={copy}
              className="rounded-lg border border-border bg-background hover:bg-muted px-2.5 py-1 text-[11px] font-semibold">
              {copied ? '✓ Скопировано' : 'Скопировать'}
            </button>
            <button onClick={share}
              className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 text-[11px] font-semibold">
              Поделиться →
            </button>
            <Link href={url!} target="_blank"
              className="rounded-lg border border-border bg-background hover:bg-muted px-2.5 py-1 text-[11px] font-semibold">
              Открыть
            </Link>
          </div>

          <label className="mt-3 flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={workoutsPublic ?? false} disabled={saving}
              onChange={e => toggleWorkouts(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-orange-500" />
            <span className="text-[12px] text-foreground">
              Показывать последние тренировки и статистику за 90 дней
            </span>
          </label>
        </>
      )}
    </div>
  )
}
