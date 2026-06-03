'use client'
/**
 * /coach/passes — Sprint W9 Day 43 (PR #64).
 *
 * Coach-facing view of issued athlete_passes. Closes the W8 loop:
 *   coach sells pack on marketplace → athlete buys → coach lists here
 *   → coach clicks "Списать сессию" after each in-person training →
 *   used_sessions++ atomically → auto-flips to 'used_up' when last
 *   session burned.
 *
 * The atomic decrement service useSession() already exists since W8
 * Day 39 (services/athlete-passes.service.ts:145). This page is the
 * UI binding — no backend changes needed.
 *
 * Why coach-side (not athlete self-use)? Prevents fraud — only the
 * person delivering the service marks it consumed. RLS policy
 * `athlete_passes_coach_all` enforces same constraint at DB level.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import {
  listMyIssuedPasses, useSession,
  type AthletePassWithAthlete,
} from '@/services/athlete-passes.service'
import { Card } from '@/components/ui/metronic'

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function daysUntil(iso: string): number {
  const target = new Date(iso).getTime()
  const ms = target - Date.now()
  return Math.ceil(ms / (1000 * 3600 * 24))
}

export default function CoachPassesPage() {
  const { user, loading: userLoading } = useUser()
  const [passes, setPasses]     = useState<AthletePassWithAthlete[]>([])
  const [loading, setLoading]   = useState(true)
  const [busyId, setBusyId]     = useState<string | null>(null)
  const [toast, setToast]       = useState<{ ok: boolean; msg: string } | null>(null)

  // Confirm modal — explicit confirm before decrementing
  const [confirming, setConfirming] = useState<AthletePassWithAthlete | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await listMyIssuedPasses()
    setPasses(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (userLoading) return
    if (!user) { setLoading(false); return }
    void refresh()
  }, [user, userLoading, refresh])

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const onConfirmUseSession = useCallback(async () => {
    if (!confirming) return
    const passId = confirming.id
    const athleteLabel = confirming.athlete_name ?? confirming.athlete_nickname ?? 'атлета'
    setBusyId(passId)
    setConfirming(null)
    const result = await useSession(passId)
    setBusyId(null)
    if (result.ok) {
      setToast({
        ok: true,
        msg: `Сессия списана у ${athleteLabel}. Осталось: ${result.remaining ?? '—'}`,
      })
      // Optimistic local update: if remaining hit 0, the pass auto-flipped
      // to 'used_up' server-side — drop it from list. Otherwise bump used_sessions.
      setPasses(prev =>
        prev
          .map(p => p.id === passId ? { ...p, used_sessions: p.used_sessions + 1 } : p)
          .filter(p => p.used_sessions < p.total_sessions),
      )
    } else {
      setToast({
        ok: false,
        msg: 'Не удалось списать сессию. Возможно абонемент уже исчерпан или истёк — обновите страницу.',
      })
    }
  }, [confirming])

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
        <p className="text-sm font-semibold text-foreground">Войдите как тренер чтобы увидеть выпущенные абонементы</p>
        <Link href="/auth/login" className="text-sm text-orange-600 font-semibold hover:underline">→ Войти</Link>
      </div>
    )
  }

  if (user.role !== 'coach') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 px-4">
        <p className="text-sm font-semibold text-foreground">Эта страница доступна только тренерам</p>
        <p className="text-xs text-muted-foreground text-center max-w-md">
          Если вы атлет — ваши абонементы на странице{' '}
          <Link href="/athlete/passes" className="text-orange-600 hover:underline">/athlete/passes</Link>.
        </p>
      </div>
    )
  }

  return (
    <div className="pf-enter max-w-4xl mx-auto px-4 py-8 flex flex-col gap-5">
      {/* Hero */}
      <section className="rounded-3xl border border-orange-100/80 bg-gradient-to-br from-orange-50 to-white p-6 md:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700 mb-1">Тренер · Абонементы</p>
            <h1 className="text-3xl font-bold text-navy-500">Активные абонементы атлетов</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              {passes.length === 0
                ? 'Пока нет ни одного выпущенного абонемента с остатком сессий.'
                : `Выпущено активных пакетов: ${passes.length}. Списывайте сессию после каждой проведённой тренировки.`}
            </p>
          </div>
          <Link
            href="/coach/pass-plans"
            className="inline-flex items-center gap-1.5 rounded-2xl border border-orange-200 bg-card hover:bg-orange-50 text-orange-700 px-4 py-2.5 text-sm font-bold no-underline"
          >
            <i className="ki-filled ki-cup text-sm" />
            Управление пакетами
          </Link>
        </div>
      </section>

      {/* List */}
      {passes.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border bg-accent/30 px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 mb-4">
            <i className="ki-filled ki-cup text-2xl" />
          </div>
          <h3 className="text-lg font-semibold text-navy-500">Нет активных абонементов</h3>
          <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
            Создайте пакет на странице <Link href="/coach/pass-plans" className="text-orange-600 hover:underline">«Пакеты»</Link>
            {' '}или выдайте абонемент атлету напрямую — пока marketplace + Split Payments в работе.
          </p>
        </div>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">К списанию · {passes.length}</h2>
          {passes.map(p => {
            const remaining = p.total_sessions - p.used_sessions
            const progress = p.total_sessions > 0 ? (p.used_sessions / p.total_sessions) * 100 : 0
            const days = daysUntil(p.expires_at)
            const urgentDays = days <= 7
            const busy = busyId === p.id
            return (
              <Card key={p.id} className="p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-700 overflow-hidden shrink-0">
                      {p.athlete_avatar_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={p.athlete_avatar_url} alt="" className="w-full h-full object-cover" />
                        : (p.athlete_name ?? p.athlete_nickname ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/profile/${p.athlete_id}`} className="text-base font-bold text-foreground hover:text-orange-600 truncate block no-underline">
                        {p.athlete_name ?? p.athlete_nickname ?? 'Атлет'}
                      </Link>
                      <div className="mt-0.5 text-xs text-muted-foreground truncate">{p.title}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="pf-num text-2xl font-bold text-foreground">{remaining}</div>
                    <div className="text-[11px] text-muted-foreground">из {p.total_sessions} осталось</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${progress}%`, background: progress >= 80 ? '#F35703' : '#10B981' }} />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted-foreground">
                    <span>{p.used_sessions} использовано</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                </div>

                {/* Footer: dates + action */}
                <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-border">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className={urgentDays ? 'text-orange-700 font-semibold' : ''}>
                      <i className="ki-filled ki-time text-[11px] mr-1" />
                      истекает {fmtDate(p.expires_at)}
                      {urgentDays && days > 0 && <span className="ml-1">· через {days} дн</span>}
                      {days <= 0 && <span className="ml-1">· сегодня</span>}
                    </span>
                  </div>
                  <button
                    onClick={() => setConfirming(p)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white px-3 py-2 text-xs font-bold shadow-sm transition disabled:cursor-not-allowed"
                  >
                    {busy
                      ? <><div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full pf-spin" /> Списываю…</>
                      : <><i className="ki-filled ki-minus-squared text-xs" /> Списать сессию</>}
                  </button>
                </div>
              </Card>
            )
          })}
        </section>
      )}

      <Card className="border-dashed bg-background/70 p-4 text-[11px] text-muted-foreground">
        Списание уменьшает <code className="font-mono">used_sessions</code> на 1 атомарно. Когда счётчик достигает лимита,
        абонемент автоматически переходит в статус <em>used_up</em> и исчезает из этого списка.
      </Card>

      {/* Confirm dialog */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-bold text-navy-500 mb-2">Списать сессию?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Это уменьшит остаток на 1 у атлета{' '}
              <strong className="text-foreground">{confirming.athlete_name ?? confirming.athlete_nickname ?? '—'}</strong>
              {' '}в пакете «{confirming.title}». Операция атомарная — двойного списания не произойдёт.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirming(null)}
                className="kt-btn kt-btn-outline"
              >
                Отмена
              </button>
              <button
                onClick={onConfirmUseSession}
                className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-bold shadow-sm"
              >
                <i className="ki-filled ki-check text-xs" />
                Да, списать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 max-w-md ${
            toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          <i className={`ki-filled ${toast.ok ? 'ki-check-circle' : 'ki-warning-2'} text-sm`} />
          {toast.msg}
        </div>
      )}
    </div>
  )
}
