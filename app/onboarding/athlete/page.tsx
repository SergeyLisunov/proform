'use client'
/**
 * /onboarding/athlete — Sprint W6 Day 30 (PR #48).
 *
 * 3-step wizard for first-time athletes:
 *   1. Sport          → choose primary discipline
 *   2. Goal           → preset or custom (creates athlete_goals row on finish)
 *   3. Level          → beginner / intermediate / advanced
 *
 * On finish:
 *   - createGoal({ metric, metric_label, notes }) → athlete_goals row
 *   - markOnboardingComplete() → users.onboarding_state.completed = true
 *   - redirect to /athlete/dashboard
 *
 * State is persisted on each Next via patchMyOnboarding, so closing the
 * tab and returning resumes at the same step.
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'
import WizardShell, { type WizardStep } from '@/components/onboarding/WizardShell'
import {
  loadMyOnboarding, patchMyOnboarding, markOnboardingComplete,
  type AthleteWizardData,
} from '@/services/onboarding.service'
import { createGoal } from '@/services/athlete-goals.service'

const SPORTS: Array<{ key: string; label: string; emoji: string }> = [
  { key: 'running',    label: 'Бег',                 emoji: '🏃' },
  { key: 'cycling',    label: 'Велоспорт',           emoji: '🚴' },
  { key: 'swimming',   label: 'Плавание',            emoji: '🏊' },
  { key: 'strength',   label: 'Силовой тренинг',     emoji: '🏋️' },
  { key: 'team_sport', label: 'Командный спорт',     emoji: '⚽' },
  { key: 'multi',      label: 'Многоборье / другое', emoji: '🎯' },
]

const GOAL_PRESETS: Array<{ key: string; label: string; metric_label: string; metric: string }> = [
  { key: '5k',        label: 'Подготовиться к 5K',          metric_label: 'Финиш 5K',          metric: 'race_finish' },
  { key: '10k',       label: 'Подготовиться к 10K',         metric_label: 'Финиш 10K',         metric: 'race_finish' },
  { key: 'half',      label: 'Подготовиться к полумарафону', metric_label: 'Финиш полумарафона', metric: 'race_finish' },
  { key: 'marathon',  label: 'Подготовиться к марафону',     metric_label: 'Финиш марафона',     metric: 'race_finish' },
  { key: 'fitness',   label: 'Общая физическая форма',       metric_label: 'Общая форма',       metric: 'general_fitness' },
  { key: 'weight',    label: 'Снижение веса',               metric_label: 'Целевой вес',       metric: 'weight_loss' },
]

const LEVELS: Array<{ key: 'beginner' | 'intermediate' | 'advanced'; label: string; hint: string }> = [
  { key: 'beginner',     label: 'Новичок',     hint: 'Тренируюсь нерегулярно или начинаю с нуля' },
  { key: 'intermediate', label: 'Любитель',    hint: '3-5 тренировок в неделю, есть базовая подготовка' },
  { key: 'advanced',     label: 'Продвинутый', hint: 'Регулярно, со структурой, участвую в стартах' },
]

const ACCENT = '#F35703'

export default function AthleteOnboardingPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [sport, setSport]               = useState<string>('')
  const [goalKey, setGoalKey]           = useState<string>('')
  const [goalCustom, setGoalCustom]     = useState<string>('')
  const [level, setLevel]               = useState<'beginner' | 'intermediate' | 'advanced' | ''>('')
  const [busy, setBusy]                 = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [hydrated, setHydrated]         = useState(false)

  // Hydrate from server state on mount (resume support).
  useEffect(() => {
    if (userLoading) return
    if (!user) { router.replace('/auth/login'); return }
    let cancelled = false
    void (async () => {
      const state = await loadMyOnboarding()
      if (cancelled) return
      if (state.completed) { router.replace('/athlete/dashboard'); return }
      const a = (state.athlete ?? {}) as AthleteWizardData
      if (a.sport) setSport(a.sport)
      if (a.goal)  setGoalKey(a.goal)
      if (a.level) setLevel(a.level)
      // First time the user hits the wizard → mark started_at.
      if (!state.started_at) {
        await patchMyOnboarding({
          started_at:        new Date().toISOString(),
          role_when_started: 'athlete',
          step:              'sport',
        })
      }
      setHydrated(true)
    })()
    return () => { cancelled = true }
  }, [user, userLoading, router])

  const persistStep = useCallback(async (stepKey: string, patch: Partial<AthleteWizardData>) => {
    await patchMyOnboarding({ step: stepKey, athlete: patch }).catch(() => {})
  }, [])

  function next() {
    setError(null)
    if (currentIndex === 0) {
      if (!sport) { setError('Выберите вид спорта'); return }
      void persistStep('goal', { sport })
    } else if (currentIndex === 1) {
      const finalGoal = goalKey === 'custom' ? goalCustom.trim() : goalKey
      if (!finalGoal) { setError('Выберите или укажите цель'); return }
      void persistStep('level', { goal: goalKey })
    }
    setCurrentIndex(i => Math.min(i + 1, 2))
  }

  function prev() {
    setError(null)
    setCurrentIndex(i => Math.max(i - 1, 0))
  }

  async function finish() {
    setError(null)
    if (!sport || !level) { setError('Заполните все шаги'); return }
    setBusy(true)
    try {
      const preset = GOAL_PRESETS.find(g => g.key === goalKey)
      const metric       = preset?.metric ?? 'general_fitness'
      const metric_label = preset?.metric_label ?? (goalCustom.trim() || 'Моя цель')
      const notes        = `Спорт: ${sport} · Уровень: ${level}${goalKey === 'custom' && goalCustom ? ' · Описание: ' + goalCustom : ''}`

      const created = await createGoal({ metric, metric_label, notes })
      if (!created) {
        setError('Не удалось создать первую цель. Можно сделать это позже из /athlete/goals.')
        // Don't block onboarding — still mark complete.
      }

      await patchMyOnboarding({ athlete: { sport, goal: goalKey, level: level as 'beginner' | 'intermediate' | 'advanced' } })
      const ok = await markOnboardingComplete()
      if (!ok) {
        setError('Не удалось отметить onboarding как пройденный')
        setBusy(false)
        return
      }
      router.replace('/athlete/dashboard')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'FINISH_FAILED')
      setBusy(false)
    }
  }

  const steps: WizardStep[] = [
    {
      key:         'sport',
      title:       'Какой спорт основной?',
      description: 'Это поможет персонализировать рекомендации и отбор тренеров.',
      canAdvance:  !!sport,
    },
    {
      key:         'goal',
      title:       'Какая цель сейчас?',
      description: 'Создадим первую цель — её можно изменить или добавить ещё позже в /athlete/goals.',
      canAdvance:  goalKey === 'custom' ? goalCustom.trim().length >= 3 : !!goalKey,
    },
    {
      key:         'level',
      title:       'Какой у вас уровень?',
      description: 'Влияет на дефолтные шаблоны тренировок и интенсивность.',
      canAdvance:  !!level,
    },
  ]

  if (userLoading || !hydrated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  return (
    <WizardShell
      roleLabel="Атлет"
      accentColor={ACCENT}
      steps={steps}
      currentIndex={currentIndex}
      busy={busy}
      error={error}
      onPrev={prev}
      onNext={next}
      onFinish={finish}
      finishLabel="Создать цель и открыть dashboard"
    >
      {currentIndex === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SPORTS.map(s => {
            const sel = sport === s.key
            return (
              <button key={s.key} type="button" onClick={() => setSport(s.key)}
                className={`rounded-2xl border-2 px-3 py-4 text-sm font-semibold transition flex flex-col items-center gap-1 ${
                  sel ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-border bg-background hover:border-orange-200 text-foreground'
                }`}>
                <span className="text-2xl">{s.emoji}</span>
                <span>{s.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {currentIndex === 1 && (
        <div className="flex flex-col gap-2">
          {GOAL_PRESETS.map(g => {
            const sel = goalKey === g.key
            return (
              <button key={g.key} type="button" onClick={() => setGoalKey(g.key)}
                className={`rounded-2xl border-2 px-4 py-3 text-sm text-left transition flex items-center gap-3 ${
                  sel ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-border bg-background hover:border-orange-200 text-foreground'
                }`}>
                <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                  style={{ borderColor: sel ? ACCENT : 'var(--border)', background: sel ? ACCENT : 'transparent' }}>
                  {sel && <i className="ki-filled ki-check text-[10px] text-white" />}
                </span>
                <span className="font-semibold">{g.label}</span>
              </button>
            )
          })}
          <button type="button" onClick={() => setGoalKey('custom')}
            className={`rounded-2xl border-2 px-4 py-3 text-sm text-left transition ${
              goalKey === 'custom' ? 'border-orange-400 bg-orange-50' : 'border-border bg-background hover:border-orange-200'
            }`}>
            <div className="flex items-center gap-3 mb-2">
              <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                style={{ borderColor: goalKey === 'custom' ? ACCENT : 'var(--border)', background: goalKey === 'custom' ? ACCENT : 'transparent' }}>
                {goalKey === 'custom' && <i className="ki-filled ki-check text-[10px] text-white" />}
              </span>
              <span className="font-semibold">Своя цель</span>
            </div>
            {goalKey === 'custom' && (
              <input type="text" value={goalCustom} onChange={e => setGoalCustom(e.target.value)}
                placeholder="Например: пробежать первый триатлон до конца сезона"
                maxLength={120}
                className="ml-9 w-[calc(100%-2.25rem)] rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400" />
            )}
          </button>
        </div>
      )}

      {currentIndex === 2 && (
        <div className="flex flex-col gap-2">
          {LEVELS.map(l => {
            const sel = level === l.key
            return (
              <button key={l.key} type="button" onClick={() => setLevel(l.key)}
                className={`rounded-2xl border-2 px-4 py-3 text-left transition ${
                  sel ? 'border-orange-400 bg-orange-50' : 'border-border bg-background hover:border-orange-200'
                }`}>
                <div className="text-sm font-bold text-foreground">{l.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{l.hint}</div>
              </button>
            )
          })}
        </div>
      )}
    </WizardShell>
  )
}
