'use client'
/**
 * /onboarding/coach — Sprint W6 Day 30 (PR #48).
 *
 * 3-step wizard for first-time coaches:
 *   1. Speciality   → short free-text describing primary expertise
 *   2. First invite → optional email + auto-send via /api/invite (coach_athlete)
 *   3. Plan preview → informational tile pointing to /coach/plans (W5 Day 24 builder)
 *
 * On finish:
 *   - If invite email provided & not already sent → POST /api/invite
 *   - markOnboardingComplete()
 *   - redirect to /coach
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'
import WizardShell, { type WizardStep } from '@/components/onboarding/WizardShell'
import {
  loadMyOnboarding, patchMyOnboarding, markOnboardingComplete,
  type CoachWizardData,
} from '@/services/onboarding.service'

const ACCENT = '#16A34A'   // green — matches coach role tint in ROLE_META
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function CoachOnboardingPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [speciality, setSpeciality]     = useState<string>('')
  const [inviteEmail, setInviteEmail]   = useState<string>('')
  const [inviteSent, setInviteSent]     = useState(false)
  const [skipInvite, setSkipInvite]     = useState(false)
  const [busy, setBusy]                 = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [hydrated, setHydrated]         = useState(false)

  // Hydrate
  useEffect(() => {
    if (userLoading) return
    if (!user) { router.replace('/auth/login'); return }
    let cancelled = false
    void (async () => {
      const state = await loadMyOnboarding()
      if (cancelled) return
      if (state.completed) { router.replace('/coach'); return }
      const c = (state.coach ?? {}) as CoachWizardData
      if (c.speciality)          setSpeciality(c.speciality)
      if (c.first_invite_email)  setInviteEmail(c.first_invite_email)
      if (c.first_invite_sent)   setInviteSent(true)
      if (!state.started_at) {
        await patchMyOnboarding({
          started_at:        new Date().toISOString(),
          role_when_started: 'coach',
          step:              'speciality',
        })
      }
      setHydrated(true)
    })()
    return () => { cancelled = true }
  }, [user, userLoading, router])

  const persistStep = useCallback(async (stepKey: string, patch: Partial<CoachWizardData>) => {
    await patchMyOnboarding({ step: stepKey, coach: patch }).catch(() => {})
  }, [])

  function next() {
    setError(null)
    if (currentIndex === 0) {
      if (speciality.trim().length < 5) { setError('Минимум 5 символов в описании специализации'); return }
      void persistStep('invite', { speciality: speciality.trim() })
    }
    setCurrentIndex(i => Math.min(i + 1, 2))
  }
  function prev() { setError(null); setCurrentIndex(i => Math.max(i - 1, 0)) }

  async function maybeSendInvite(): Promise<{ ok: boolean; reason?: string }> {
    if (skipInvite || inviteSent) return { ok: true, reason: 'skipped' }
    const email = inviteEmail.trim()
    if (!email) return { ok: true, reason: 'empty' }
    if (!EMAIL_RE.test(email)) return { ok: false, reason: 'INVALID_EMAIL' }
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, connection_type: 'coach_athlete' }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, reason: j.error ?? `HTTP ${res.status}` }
      setInviteSent(true)
      await persistStep('plan', { first_invite_email: email, first_invite_sent: true })
      return { ok: true }
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : 'NET_FAIL' }
    }
  }

  async function finish() {
    setError(null)
    if (speciality.trim().length < 5) { setError('Шаг 1: укажите специализацию'); return }
    setBusy(true)
    try {
      const inv = await maybeSendInvite()
      if (!inv.ok) {
        setError(`Не удалось отправить приглашение: ${inv.reason}. Можете пропустить и продолжить.`)
        setBusy(false)
        return
      }
      await patchMyOnboarding({ coach: { speciality: speciality.trim() } })
      const ok = await markOnboardingComplete()
      if (!ok) { setError('Не удалось отметить onboarding'); setBusy(false); return }
      router.replace('/coach')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'FINISH_FAILED')
      setBusy(false)
    }
  }

  const steps: WizardStep[] = [
    {
      key:         'speciality',
      title:       'В чём ваша специализация?',
      description: 'Короткое описание — для атлетов и поиска в каталоге.',
      canAdvance:  speciality.trim().length >= 5,
    },
    {
      key:         'invite',
      title:       'Пригласите первого атлета',
      description: 'Можно пропустить — добавить позже в /athletes. Приглашение придёт на email со ссылкой на принятие.',
      canAdvance:  skipInvite || inviteEmail.trim().length === 0 || EMAIL_RE.test(inviteEmail.trim()),
    },
    {
      key:         'plan',
      title:       'Готовы создать первый план',
      description: 'После завершения вы попадёте на /coach. План тренировок собирается в /coach/plans.',
      canAdvance:  true,
    },
  ]

  if (userLoading || !hydrated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  return (
    <WizardShell
      roleLabel="Тренер"
      accentColor={ACCENT}
      steps={steps}
      currentIndex={currentIndex}
      busy={busy}
      error={error}
      onPrev={prev}
      onNext={next}
      onFinish={finish}
      finishLabel="Завершить и открыть панель тренера"
    >
      {currentIndex === 0 && (
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Специализация
          </label>
          <textarea value={speciality} onChange={e => setSpeciality(e.target.value)}
            placeholder="Например: тренер по бегу на длинные дистанции, опыт 8 лет, методология MAF, подготовка к марафонам"
            rows={5} maxLength={500}
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-green-400 resize-vertical" />
          <p className="mt-1 text-[11px] text-muted-foreground">{speciality.length}/500 · мин. 5 символов</p>
        </div>
      )}

      {currentIndex === 1 && (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Email атлета
            </label>
            <input type="email" value={inviteEmail} onChange={e => { setInviteEmail(e.target.value); setSkipInvite(false); setInviteSent(false) }}
              placeholder="athlete@example.com"
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-green-400"
              disabled={inviteSent} />
            {inviteSent && (
              <p className="mt-1 text-[11px] text-emerald-700 font-semibold inline-flex items-center gap-1">
                <i className="ki-filled ki-check text-[11px]" /> Приглашение отправлено
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={skipInvite}
              onChange={e => { setSkipInvite(e.target.checked); if (e.target.checked) setInviteEmail('') }} />
            <span className="text-sm text-muted-foreground">Пропустить — приглашу позже</span>
          </label>

          <div className="rounded-xl border border-dashed border-border bg-accent/30 p-3 text-[12px] text-muted-foreground">
            Атлет получит email с короткой ссылкой. После клика — регистрация (если новый пользователь) или принятие связи (если уже есть аккаунт).
          </div>
        </div>
      )}

      {currentIndex === 2 && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                <i className="ki-filled ki-calendar-2 text-lg" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-foreground">Coach Builder · /coach/plans</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Собирайте мульти-недельные планы (1-12 недель) с workout items на каждый день.
                  Назначайте атлетам одним кликом — workouts создаются автоматически в их календаре.
                </p>
                <Link href="/coach/plans/new"
                  className="mt-2 inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-700 px-3 py-1.5 text-xs font-semibold">
                  Открыть редактор плана →
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0">
                <i className="ki-filled ki-message-question text-lg" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-foreground">Doctor inquiries · /coach/inquiries</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Запрашивайте медицинское заключение у врачей по конкретному атлету —
                  снижает professional liability + ускоряет return-to-play.
                </p>
              </div>
            </div>
          </div>

          {/* W7 Day 34: highlight the new service builder */}
          <div className="rounded-2xl border border-orange-200 bg-orange-50/40 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center flex-shrink-0">
                <i className="ki-filled ki-shop text-lg" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-foreground">Coach Services · /coach/services</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Разовые услуги: консультации, разовые занятия, оценки.
                  Активные карточки появятся в общем каталоге.
                </p>
                <Link href="/coach/services"
                  className="mt-2 inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-white hover:bg-orange-50 text-orange-700 px-3 py-1.5 text-xs font-semibold">
                  Открыть редактор услуг →
                </Link>
              </div>
            </div>
          </div>

          {/* W8 Day 38: pass-plans (multi-session subscriptions) */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <i className="ki-filled ki-cup text-lg" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-foreground">Pass plans · /coach/pass-plans</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Многосессионные абонементы: пакеты тренировок, безлимит на месяц, групповые блоки.
                </p>
                <Link href="/coach/pass-plans"
                  className="mt-2 inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white hover:bg-amber-50 text-amber-700 px-3 py-1.5 text-xs font-semibold">
                  Открыть редактор абонементов →
                </Link>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            После завершения откроется ваша панель тренера. Эти шаги можно пройти снова в любой момент.
          </p>
        </div>
      )}
    </WizardShell>
  )
}
