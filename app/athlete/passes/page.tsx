'use client'
/**
 * /athlete/passes — Sprint W8 Day 39 (PR #57).
 *
 * Athlete-facing pass management page. Closes the buy → manage → use
 * → renew loop on the athlete side. Coach side ships abonements via
 * /coach/pass-plans (W8 Day 38). Marketplace lists them for purchase
 * (when ЮKassa Split Payments unblock — blocked externally today).
 *
 * Layout:
 *   - Hero with active count + CTA "Купить ещё"
 *   - Active section: cards with progress bar, expires-in, coach link
 *   - Expired section: collapsed list, expandable
 *
 * Read-only for athlete — coach decrements sessions via separate UI
 * (athletes don't self-use, prevents fraud).
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import {
  listMyActivePasses, listMyExpiredPasses,
  type AthletePassWithCoach,
} from '@/services/athlete-passes.service'
import { getMyReviewsByCoachIds } from '@/services/coach-reviews.service'
import AthleteReviewPrompt from '@/components/athlete/AthleteReviewPrompt'

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

function fmtMoneyFromCents(cents: number, currency = 'RUB'): string {
  const rub = cents / 100
  try {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(rub)
  } catch { return `${rub} ${currency}` }
}

export default function AthletePassesPage() {
  const { user, loading: userLoading } = useUser()
  const [active, setActive]     = useState<AthletePassWithCoach[]>([])
  const [expired, setExpired]   = useState<AthletePassWithCoach[]>([])
  const [loading, setLoading]   = useState(true)
  const [showExpired, setShowExpired] = useState(false)
  // W10 Day 49: set of coach_ids athlete has already reviewed (or chose to skip)
  const [reviewedCoachIds, setReviewedCoachIds] = useState<Set<string>>(new Set())
  const [dismissedCoachIds, setDismissedCoachIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (userLoading) return
    if (!user) { setLoading(false); return }
    let cancelled = false
    void (async () => {
      const [a, e] = await Promise.all([listMyActivePasses(), listMyExpiredPasses()])
      if (cancelled) return
      setActive(a)
      setExpired(e)
      // W10 Day 49: batch-lookup my existing reviews for all coaches I have used_up passes with
      const coachIds = Array.from(new Set(
        e.filter(p => p.used_sessions >= p.total_sessions || p.status === 'used_up').map(p => p.coach_id),
      ))
      const reviewsMap = await getMyReviewsByCoachIds(coachIds)
      if (cancelled) return
      setReviewedCoachIds(new Set(reviewsMap.keys()))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [user, userLoading])

  // Reviewable coaches: have used_up pass + not yet reviewed + not session-dismissed.
  // One prompt per coach (group by coach_id; pick most recently expired pass for context title).
  const reviewableCoaches = useMemo(() => {
    const used = expired.filter(p => p.used_sessions >= p.total_sessions || p.status === 'used_up')
    const byCoach = new Map<string, AthletePassWithCoach>()
    for (const p of used) {
      if (reviewedCoachIds.has(p.coach_id) || dismissedCoachIds.has(p.coach_id)) continue
      const prev = byCoach.get(p.coach_id)
      if (!prev || (prev.expires_at < p.expires_at)) byCoach.set(p.coach_id, p)
    }
    return Array.from(byCoach.values())
  }, [expired, reviewedCoachIds, dismissedCoachIds])

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
        <p className="text-sm font-semibold text-foreground">Войдите чтобы увидеть свои абонементы</p>
        <Link href="/auth/login" className="text-sm text-orange-600 font-semibold hover:underline">→ Войти</Link>
      </div>
    )
  }

  return (
    <div className="pf-enter max-w-4xl mx-auto px-4 py-8 flex flex-col gap-5">
      {/* Hero */}
      <section className="rounded-3xl border border-orange-100/80 bg-gradient-to-br from-orange-50 to-white p-6 md:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700 mb-1">Атлет · Абонементы</p>
            <h1 className="text-3xl font-bold text-foreground">My Passes</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              {active.length === 0
                ? 'У вас пока нет активных абонементов. Найдите тренера и купите пакет тренировок.'
                : `Активных абонементов: ${active.length}. Истекающие — наверху списка.`}
            </p>
          </div>
          <Link href="/marketplace?role=coach"
            className="inline-flex items-center gap-1.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 text-sm font-bold shadow-md">
            <i className="ki-filled ki-shop text-sm" />
            Купить абонемент
          </Link>
        </div>
      </section>

      {/* Active passes */}
      {active.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border bg-accent/30 px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 mb-4">
            <i className="ki-filled ki-cup text-2xl" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Нет активных абонементов</h3>
          <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
            Браузите marketplace и купите пакет от тренера — например, «10 тренировок за месяц».
            Сессии списываются тренером после каждой встречи.
          </p>
          <Link href="/marketplace?role=coach"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 text-sm font-semibold">
            Открыть marketplace →
          </Link>
        </div>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Активные · {active.length}</h2>
          {active.map(p => {
            const remaining = p.total_sessions - p.used_sessions
            const progress = p.total_sessions > 0 ? (p.used_sessions / p.total_sessions) * 100 : 0
            const days = daysUntil(p.expires_at)
            const urgentDays = days <= 7
            return (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-foreground truncate">{p.title}</h3>
                    {p.coach_id && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-bold text-orange-700 overflow-hidden shrink-0">
                          {p.coach_avatar_url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={p.coach_avatar_url} alt="" className="w-full h-full object-cover" />
                            : (p.coach_name ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <Link href={`/profile/${p.coach_id}`} className="text-xs text-muted-foreground hover:text-orange-600 truncate">
                          Тренер: <strong className="text-foreground">{p.coach_name ?? '—'}</strong>
                        </Link>
                      </div>
                    )}
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
                      style={{ width: `${progress}%`, background: progress >= 80 ? '#F97316' : '#10B981' }} />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted-foreground">
                    <span>{p.used_sessions} использовано</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                </div>

                {/* Footer: dates + price */}
                <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-border">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      <i className="ki-filled ki-calendar-2 text-[11px] mr-1" />
                      с {fmtDate(p.starts_at)}
                    </span>
                    <span className={urgentDays ? 'text-orange-700 font-semibold' : ''}>
                      <i className="ki-filled ki-time text-[11px] mr-1" />
                      истекает {fmtDate(p.expires_at)}
                      {urgentDays && days > 0 && <span className="ml-1">· через {days} дн</span>}
                      {days <= 0 && <span className="ml-1">· сегодня</span>}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {fmtMoneyFromCents(p.price_cents, p.currency)}
                  </span>
                </div>
              </div>
            )
          })}
        </section>
      )}

      {/* W10 Day 49: review prompt for closed passes (one per coach) */}
      {reviewableCoaches.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">
            Поделитесь впечатлением · {reviewableCoaches.length}
          </h2>
          {reviewableCoaches.map(p => (
            <AthleteReviewPrompt
              key={p.coach_id}
              coachId={p.coach_id}
              coachName={p.coach_name}
              coachAvatarUrl={p.coach_avatar_url}
              contextTitle={p.title}
              onDismiss={() => setDismissedCoachIds(prev => {
                const next = new Set(prev)
                next.add(p.coach_id)
                return next
              })}
            />
          ))}
        </section>
      )}

      {/* Expired section (collapsed) */}
      {expired.length > 0 && (
        <section className="rounded-2xl border border-border bg-card">
          <button onClick={() => setShowExpired(s => !s)}
            className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-muted transition rounded-2xl">
            <div className="flex items-center gap-2">
              <i className={`ki-filled ki-${showExpired ? 'down' : 'right'} text-xs text-muted-foreground`} />
              <h2 className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
                История · {expired.length} истекших
              </h2>
            </div>
            <span className="text-[11px] text-muted-foreground">{showExpired ? 'Скрыть' : 'Показать'}</span>
          </button>
          {showExpired && (
            <div className="border-t border-border divide-y divide-border">
              {expired.map(p => {
                const used = p.used_sessions
                const total = p.total_sessions
                const finishedReason = used >= total ? 'использован'
                  : p.status === 'cancelled' ? 'отменён'
                  : 'истёк по времени'
                return (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-foreground truncate">{p.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {p.coach_name ?? '—'} · {used} из {total} использовано · {finishedReason}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-muted-foreground shrink-0">
                      {fmtDate(p.starts_at)} → {fmtDate(p.expires_at)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      <div className="rounded-2xl border border-dashed border-border bg-background/70 p-4 text-[11px] text-muted-foreground">
        Сессии списываются тренером после каждой встречи. Если что-то не сошлось — обратитесь к тренеру или поддержке.
      </div>
    </div>
  )
}
