'use client'
/**
 * /onboarding/doctor — Sprint W6 Day 31 (PR #49).
 *
 * 3-step wizard for first-time doctors:
 *   1. Specialty     → preset (cardio / orthopedic / sports / general / other)
 *                      + free-text main_focus
 *   2. Availability  → weekly_hours number + preferred_days multi-select
 *   3. Compliance    → 152-ФЗ medical data handling + Terms of Service
 *                      + optional emergency_contact toggle
 *
 * On finish:
 *   - patchMyOnboarding({ doctor: {...} }) — все данные в onboarding_state.doctor
 *   - markOnboardingComplete
 *   - redirect to /doctor/inquiries (W5 Day 26 queue UI)
 *
 * Doctor profile fields are intentionally lightweight here — full
 * profile (license №, certifications, hospital affiliations) lives
 * in /settings/profile already; wizard captures intent + consent only.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'
import WizardShell, { type WizardStep } from '@/components/onboarding/WizardShell'
import {
  loadMyOnboarding, patchMyOnboarding, markOnboardingComplete,
  type DoctorWizardData,
} from '@/services/onboarding.service'

const ACCENT = '#7C3AED'   // violet — matches doctor role tint in /doctor/inquiries

const SPECIALTIES: Array<{ key: string; label: string; emoji: string; hint: string }> = [
  { key: 'cardiology',      label: 'Кардиология',         emoji: '❤️', hint: 'Нагрузочные тесты, ЭКГ, допуск к нагрузкам' },
  { key: 'orthopedic',      label: 'Ортопедия',           emoji: '🦴', hint: 'ОДА, реабилитация, возврат к спорту' },
  { key: 'sports_medicine', label: 'Спортивная медицина', emoji: '🏃', hint: 'Спортивный скрининг, фарм-сопровождение' },
  { key: 'general',         label: 'Терапия',             emoji: '🩺', hint: 'Общий осмотр, диспансеризация' },
  { key: 'other',           label: 'Другое',              emoji: '⭐', hint: 'Психология, питание, физиотерапия' },
]

const DAY_KEYS: Array<{ key: string; label: string }> = [
  { key: 'mon', label: 'Пн' },
  { key: 'tue', label: 'Вт' },
  { key: 'wed', label: 'Ср' },
  { key: 'thu', label: 'Чт' },
  { key: 'fri', label: 'Пт' },
  { key: 'sat', label: 'Сб' },
  { key: 'sun', label: 'Вс' },
]

export default function DoctorOnboardingPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [specialty, setSpecialty]       = useState('')
  const [mainFocus, setMainFocus]       = useState('')
  const [weeklyHours, setWeeklyHours]   = useState<number>(10)
  const [days, setDays]                 = useState<string[]>(['mon', 'wed', 'fri'])
  const [consent152, setConsent152]     = useState(false)
  const [acceptTerms, setAcceptTerms]   = useState(false)
  const [emergency, setEmergency]       = useState(false)
  const [busy, setBusy]                 = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [hydrated, setHydrated]         = useState(false)

  useEffect(() => {
    if (userLoading) return
    if (!user) { router.replace('/auth/login'); return }
    let cancelled = false
    void (async () => {
      const state = await loadMyOnboarding()
      if (cancelled) return
      if (state.completed) { router.replace('/doctor/inquiries'); return }
      const d = (state.doctor ?? {}) as DoctorWizardData
      if (d.medical_specialty) setSpecialty(d.medical_specialty)
      if (d.main_focus)        setMainFocus(d.main_focus)
      if (typeof d.weekly_hours === 'number') setWeeklyHours(d.weekly_hours)
      if (Array.isArray(d.preferred_days) && d.preferred_days.length > 0) setDays(d.preferred_days)
      if (d.consent_152fz)      setConsent152(true)
      if (d.accept_terms)       setAcceptTerms(true)
      if (d.emergency_contact)  setEmergency(true)
      if (!state.started_at) {
        await patchMyOnboarding({
          started_at:        new Date().toISOString(),
          role_when_started: 'doctor',
          step:              'specialty',
        })
      }
      setHydrated(true)
    })()
    return () => { cancelled = true }
  }, [user, userLoading, router])

  const persistStep = useCallback(async (stepKey: string, patch: Partial<DoctorWizardData>) => {
    await patchMyOnboarding({ step: stepKey, doctor: patch }).catch(() => {})
  }, [])

  function toggleDay(d: string) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  function next() {
    setError(null)
    if (currentIndex === 0) {
      if (!specialty) { setError('Выберите специальность'); return }
      void persistStep('availability', { medical_specialty: specialty, main_focus: mainFocus.trim() || undefined })
    } else if (currentIndex === 1) {
      if (weeklyHours < 1 || weeklyHours > 60) { setError('Часов в неделю: 1-60'); return }
      void persistStep('compliance', { weekly_hours: weeklyHours, preferred_days: days })
    }
    setCurrentIndex(i => Math.min(i + 1, 2))
  }
  function prev() { setError(null); setCurrentIndex(i => Math.max(i - 1, 0)) }

  async function finish() {
    setError(null)
    if (!specialty)  { setError('Шаг 1: укажите специальность'); return }
    if (!consent152) { setError('Шаг 3: требуется согласие 152-ФЗ'); return }
    if (!acceptTerms){ setError('Шаг 3: примите Terms of Service'); return }
    setBusy(true)
    try {
      await patchMyOnboarding({
        doctor: {
          medical_specialty:  specialty,
          main_focus:         mainFocus.trim() || undefined,
          weekly_hours:       weeklyHours,
          preferred_days:     days,
          consent_152fz:      true,
          accept_terms:       true,
          emergency_contact:  emergency,
        },
      })
      const ok = await markOnboardingComplete()
      if (!ok) { setError('Не удалось отметить onboarding'); setBusy(false); return }
      router.replace('/doctor/inquiries')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'FINISH_FAILED')
      setBusy(false)
    }
  }

  const steps: WizardStep[] = [
    {
      key:         'specialty',
      title:       'Ваша специальность',
      description: 'Используется для маршрутизации запросов от тренеров и поиска по каталогу.',
      canAdvance:  !!specialty,
    },
    {
      key:         'availability',
      title:       'Загруженность',
      description: 'Сколько часов в неделю готовы отвечать на запросы тренеров? Без жёстких SLA — для ориентировки.',
      canAdvance:  weeklyHours >= 1 && weeklyHours <= 60,
    },
    {
      key:         'compliance',
      title:       'Согласия и compliance',
      description: '152-ФЗ + Terms of Service. Это обязательно для работы с медицинскими данными атлетов.',
      canAdvance:  consent152 && acceptTerms,
    },
  ]

  if (userLoading || !hydrated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  return (
    <WizardShell
      roleLabel="Врач"
      accentColor={ACCENT}
      steps={steps}
      currentIndex={currentIndex}
      busy={busy}
      error={error}
      onPrev={prev}
      onNext={next}
      onFinish={finish}
      finishLabel="Принять и открыть очередь запросов"
    >
      {currentIndex === 0 && (
        <div className="space-y-3">
          {SPECIALTIES.map(s => {
            const sel = specialty === s.key
            return (
              <button key={s.key} type="button" onClick={() => setSpecialty(s.key)}
                className={`rounded-2xl border-2 px-4 py-3 text-left transition w-full flex items-start gap-3 ${
                  sel ? 'border-violet-400 bg-violet-50' : 'border-border bg-background hover:border-violet-200'
                }`}>
                <span className="text-2xl flex-shrink-0">{s.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-foreground">{s.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.hint}</div>
                </div>
              </button>
            )
          })}

          {specialty && (
            <div className="mt-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Основной фокус (опц.)
              </label>
              <input type="text" value={mainFocus} onChange={e => setMainFocus(e.target.value)}
                placeholder="Например: возврат после ACL, нагрузочные тесты, юношеский спорт"
                maxLength={200}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-violet-400" />
            </div>
          )}
        </div>
      )}

      {currentIndex === 1 && (
        <div className="space-y-5">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Часов в неделю
            </label>
            <div className="mt-2 flex items-center gap-3">
              <input type="range" min={1} max={40} value={weeklyHours}
                onChange={e => setWeeklyHours(Number(e.target.value))}
                className="flex-1 accent-violet-600" />
              <div className="w-16 text-center font-bold text-lg text-foreground pf-num">{weeklyHours}ч</div>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Без жёстких обязательств — это ориентировка для тренеров.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
              Удобные дни
            </label>
            <div className="grid grid-cols-7 gap-1.5">
              {DAY_KEYS.map(d => {
                const sel = days.includes(d.key)
                return (
                  <button key={d.key} type="button" onClick={() => toggleDay(d.key)}
                    className={`rounded-xl border-2 py-2 text-xs font-bold transition ${
                      sel ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-border bg-background text-muted-foreground hover:border-violet-200'
                    }`}>
                    {d.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {currentIndex === 2 && (
        <div className="space-y-3">
          <label className="flex items-start gap-3 p-3 rounded-xl border border-border bg-accent/30 cursor-pointer">
            <input type="checkbox" checked={consent152} onChange={e => setConsent152(e.target.checked)}
              className="mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-foreground">Согласие на обработку медданных (152-ФЗ)</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Я понимаю, что медицинская переписка с атлетами и тренерами в системе — это обработка
                персональных данных. Соблюдаю требования 152-ФЗ. ProForm хранит данные в Supabase
                EU-Central, доступ RLS-ограничен.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-border bg-accent/30 cursor-pointer">
            <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)}
              className="mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-foreground">Принимаю Terms of Service</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Доступно по ссылке <Link href="/legal/terms" className="text-violet-600 underline">/legal/terms</Link>.
                Ключевое: ответы врача — это рекомендации, не заменяют clinical examination.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-rose-200 bg-rose-50 cursor-pointer">
            <input type="checkbox" checked={emergency} onChange={e => setEmergency(e.target.checked)}
              className="mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-rose-900">Принимаю Red Flag запросы (24ч SLA)</div>
              <div className="text-xs text-rose-700 mt-0.5">
                Открытая очередь red_flag inquiries покажет вас как кандидата.
                Можно изменить позже в /settings.
              </div>
            </div>
          </label>

          <div className="rounded-xl border border-dashed border-border bg-accent/30 p-3 text-[11px] text-muted-foreground">
            После завершения откроется ваша очередь запросов /doctor/inquiries.
            Coach создаёт inquiry → вы получаете email + видите в очереди.
          </div>
        </div>
      )}
    </WizardShell>
  )
}
