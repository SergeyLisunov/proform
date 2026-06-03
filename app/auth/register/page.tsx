'use client'

import { type FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/utils/errors'

// ── UTM attribution (Sprint W5 Day 23 / PR #39) ───────────────────────
// Reads UTM params from URL on mount and passes them to signUp() options.data.
// handle_new_auth_user() trigger (migration 061) копирует их в users.utm_*
// и автоматически matches tool_leads по email (sets user_id + converted_at).
//
// Using window.location.search вместо useSearchParams() — избегаем
// Suspense boundary requirement для full page (page is client-only).
interface UtmCapture {
  utm_source:      string | null
  utm_medium:      string | null
  utm_campaign:    string | null
  utm_content:     string | null
  utm_term:        string | null
  signup_referrer: string | null
}

function readUtmFromUrl(): UtmCapture {
  if (typeof window === 'undefined') {
    return { utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null, signup_referrer: null }
  }
  const sp = new URLSearchParams(window.location.search)
  const safe = (key: string, max = 80): string | null => {
    const v = sp.get(key)?.trim()
    if (!v) return null
    // Lightweight sanitization — strip control chars, cap length
    return v.replace(/[\x00-\x1F\x7F]/g, '').slice(0, max) || null
  }
  return {
    utm_source:      safe('utm_source',   80),
    utm_medium:      safe('utm_medium',   80),
    utm_campaign:    safe('utm_campaign', 120),
    utm_content:     safe('utm_content',  120),
    utm_term:        safe('utm_term',     120),
    signup_referrer: typeof document !== 'undefined'
      ? (document.referrer ? document.referrer.slice(0, 500) : null)
      : null,
  }
}

type Role = 'athlete' | 'coach' | 'organization' | 'doctor'
type Plan = 'free' | 'pro' | 'team'
type Step = 'role' | 'account' | 'athlete_profile' | 'plan' | 'done'

const ROLES: { value: Role; label: string; desc: string; icon: string; bg: string; text: string; border: string }[] = [
  {
    value: 'athlete',
    label: 'Атлет',
    desc: 'Веду дневник тренировок, отслеживаю прогресс и восстановление',
    icon: 'ki-abstract-26',
    bg: '#FFF7ED',
    text: '#F35703',
    border: '#FED7AA',
  },
  {
    value: 'coach',
    label: 'Тренер',
    desc: 'Наблюдаю за атлетами, оставляю пометки и управляю нагрузкой',
    icon: 'ki-notepad-edit',
    bg: '#F0FDF4',
    text: '#16A34A',
    border: '#BBF7D0',
  },
  {
    value: 'organization',
    label: 'Организация',
    desc: 'Управляю участниками, рассылками и рабочими процессами команды',
    icon: 'ki-office-bag',
    bg: '#EFF6FF',
    text: '#2563EB',
    border: '#BFDBFE',
  },
  {
    value: 'doctor',
    label: 'Доктор',
    desc: 'Наблюдаю здоровье и восстановление, оставляю медицинские заметки',
    icon: 'ki-heart-circle',
    bg: '#FEF2F2',
    text: '#DC2626',
    border: '#FECACA',
  },
]

const PLANS: { value: Plan; label: string; price: string; desc: string; features: string[]; accent: string; bg: string; border: string }[] = [
  {
    value: 'free',
    label: 'Free',
    price: '0 ₽',
    desc: 'Для знакомства с платформой',
    features: ['До 10 тренировок в месяц', 'Основной дневник', 'Профиль и связи'],
    accent: '#64748B',
    bg: '#F8FAFC',
    border: '#E2E8F0',
  },
  {
    value: 'pro',
    label: 'Pro',
    price: '599 ₽/мес',
    desc: 'Для активных атлетов и тренеров',
    features: ['Безлимит тренировок', 'Аналитика и экспорт', 'Циклы и соревнования', 'Мессенджер'],
    accent: '#F35703',
    bg: '#FFF7ED',
    border: '#FED7AA',
  },
  {
    value: 'team',
    label: 'Team',
    price: '1999 ₽/мес',
    desc: 'Для команды и организации',
    features: ['Всё из Pro', 'До 20 атлетов', 'CRM и рассылки', 'Приоритетная поддержка'],
    accent: '#2563EB',
    bg: '#EFF6FF',
    border: '#BFDBFE',
  },
]

const SPORTS = [
  'Бег',
  'Велоспорт',
  'Плавание',
  'Триатлон',
  'Силовые',
  'Кроссфит',
  'Футбол',
  'Баскетбол',
  'Теннис',
  'Лёгкая атлетика',
  'Лыжи',
  'Другое',
]

const FITNESS_LEVELS = [
  { value: 'beginner', label: 'Новичок', desc: 'Начинаю заниматься спортом' },
  { value: 'recreational', label: 'Любитель', desc: 'Тренируюсь регулярно для удовольствия' },
  { value: 'competitive', label: 'Соревновательный', desc: 'Участвую в соревнованиях' },
  { value: 'elite', label: 'Элитный', desc: 'Профессиональный уровень / сборная' },
]

const GOALS = [
  { value: 'health', label: 'Здоровье и самочувствие' },
  { value: 'weight_loss', label: 'Снижение веса' },
  { value: 'performance', label: 'Улучшение результатов' },
  { value: 'competition', label: 'Подготовка к соревнованиям' },
  { value: 'recovery', label: 'Реабилитация и восстановление' },
]

function validatePassword(pwd: string): string {
  if (pwd.length < 8) return 'Минимум 8 символов'
  if (!/[A-Z]/.test(pwd)) return 'Нужна хотя бы одна заглавная буква'
  if (!/[0-9]/.test(pwd)) return 'Нужна хотя бы одна цифра'
  return ''
}

function StepIndicator({ current, role }: { current: Step; role: Role | null }) {
  const steps: { id: Step; label: string; hint: string }[] = [
    { id: 'role', label: 'Роль', hint: 'Выберите сценарий' },
    { id: 'account', label: 'Аккаунт', hint: 'Контакт и пароль' },
    ...(role === 'athlete' ? [{ id: 'athlete_profile' as Step, label: 'Профиль', hint: 'Опциональные данные' }] : []),
    { id: 'plan' as Step, label: 'Тариф', hint: 'Free / Pro / Team' },
  ]

  const currentIdx = steps.findIndex((step) => step.id === current)
  const progress = ((Math.max(currentIdx, 0) + 1) / steps.length) * 100

  return (
    <div className="mb-8 rounded-[24px] border border-border bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF9F4_100%)] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Шаги регистрации</div>
          <div className="mt-1 text-sm font-medium text-foreground">
            {current === 'role' && 'Начните с роли, чтобы собрать нужные поля'}
            {current === 'account' && 'Теперь создадим доступ к аккаунту'}
            {current === 'athlete_profile' && 'Осталось заполнить профиль атлета'}
            {current === 'done' && 'Регистрация завершена'}
          </div>
        </div>
        <div className="text-right">
          <div className="pf-num text-xl text-foreground">{Math.max(currentIdx, 0) + 1}/{steps.length}</div>
          <div className="text-2xs uppercase tracking-[0.24em] text-muted-foreground">{Math.round(progress)}%</div>
        </div>
      </div>

      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-300 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {steps.map((step, index) => {
          const isActive = index === currentIdx
          const isDone = index < currentIdx

          return (
            <div
              key={step.id}
              className={[
                'flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-all',
                isActive
                  ? 'border-orange-200 bg-orange-50/80'
                  : isDone
                    ? 'border-emerald-200 bg-emerald-50/70'
                    : 'border-border bg-background',
              ].join(' ')}
            >
              <div
                className={[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-all',
                  isDone || isActive ? 'bg-orange-500 text-white' : 'bg-border text-muted-foreground',
                ].join(' ')}
              >
                {isDone ? <i className="ki-filled ki-check text-[11px]" /> : index + 1}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{step.label}</div>
                <div className="text-2xs text-muted-foreground">{step.hint}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('role')
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // UTM capture — read once on mount, persist в state до signUp
  const [utm, setUtm] = useState<UtmCapture>({
    utm_source: null, utm_medium: null, utm_campaign: null,
    utm_content: null, utm_term: null, signup_referrer: null,
  })
  // W10 Day 52: admin invite token — read on mount, claim after signUp
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  useEffect(() => {
    setUtm(readUtmFromUrl())
    if (typeof window === 'undefined') return
    try {
      const params = new URLSearchParams(window.location.search)
      const token = params.get('invite')
      const roleParam = params.get('role')
      if (token && /^[0-9a-f-]{36}$/i.test(token)) setInviteToken(token)
      if (roleParam && (roleParam === 'athlete' || roleParam === 'coach' || roleParam === 'doctor' || roleParam === 'organization')) {
        setSelectedRole(roleParam as Role)
        setStep('account')
      }
    } catch { /* noop */ }
  }, [])

  const [athleteForm, setAthleteForm] = useState({
    first_name: '',
    last_name: '',
    birth_date: '',
    gender: '',
    height_cm: '',
    weight_kg: '',
    primary_sport: '',
    fitness_level: '',
    goal: '',
    weekly_training_hours: '',
    city: '',
  })
  const [athleteSaving, setAthleteSaving] = useState(false)
  const [athleteError, setAthleteError] = useState('')

  const [selectedPlan, setSelectedPlan] = useState<Plan>('free')
  const [planSaving, setPlanSaving] = useState(false)
  const [planError, setPlanError] = useState('')

  function handleRoleNext() {
    if (!selectedRole) return
    setStep('account')
  }

  async function handleAccountSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const pwdErr = validatePassword(password)
    if (pwdErr) {
      setPwdError(pwdErr)
      return
    }

    setPwdError('')
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role: selectedRole,
          // UTM attribution — picked up by handle_new_auth_user() trigger
          // (migration 061) which copies in users.utm_* + auto-matches
          // tool_leads by email.
          ...(utm.utm_source      ? { utm_source:      utm.utm_source }      : {}),
          ...(utm.utm_medium      ? { utm_medium:      utm.utm_medium }      : {}),
          ...(utm.utm_campaign    ? { utm_campaign:    utm.utm_campaign }    : {}),
          ...(utm.utm_content     ? { utm_content:     utm.utm_content }     : {}),
          ...(utm.utm_term        ? { utm_term:        utm.utm_term }        : {}),
          ...(utm.signup_referrer ? { signup_referrer: utm.signup_referrer } : {}),
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // W10 Day 52: claim admin invite (silent-fail, never blocks signup flow)
    if (inviteToken) {
      try {
        await fetch('/api/admin/invite/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: inviteToken, email }),
        })
      } catch (e) {
        console.warn('[register] invite claim failed:', e instanceof Error ? e.message : e)
      }
    }

    setLoading(false)

    if (selectedRole === 'athlete') {
      setStep('athlete_profile')
    } else {
      setStep('plan')
    }
  }

  async function handleAthleteSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAthleteSaving(true)
    setAthleteError('')

    try {
      const supabase = createClient() as any

      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (!userRow?.id) throw new Error('Пользователь не найден. Попробуйте войти позже.')

      const payload: Record<string, string | number | null> = {
        id: userRow.id,
        first_name: athleteForm.first_name || null,
        last_name: athleteForm.last_name || null,
        birth_date: athleteForm.birth_date || null,
        gender: athleteForm.gender || null,
        height_cm: athleteForm.height_cm ? parseFloat(athleteForm.height_cm) : null,
        weight_kg: athleteForm.weight_kg ? parseFloat(athleteForm.weight_kg) : null,
        primary_sport: athleteForm.primary_sport || null,
        fitness_level: athleteForm.fitness_level || null,
        goal: athleteForm.goal || null,
        weekly_training_hours: athleteForm.weekly_training_hours ? parseFloat(athleteForm.weekly_training_hours) : null,
        city: athleteForm.city || null,
      }

      const { error: upsertErr } = await supabase
        .from('athletes')
        .upsert(payload, { onConflict: 'id' })

      if (upsertErr) throw upsertErr

      setStep('plan')
    } catch (err: unknown) {
      setAthleteError(getErrorMessage(err, 'Не удалось сохранить профиль'))
    } finally {
      setAthleteSaving(false)
    }
  }

  function skipAthleteProfile() {
    setStep('plan')
  }

  async function handlePlanSubmit() {
    setPlanSaving(true)
    setPlanError('')
    try {
      const supabase = createClient() as any
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (userRow?.id) {
        // Сохраняем выбор тарифа в subscriptions (если таблица есть — upsert)
        await supabase
          .from('subscriptions')
          .upsert(
            {
              user_id: userRow.id,
              plan: selectedPlan,
              status: selectedPlan === 'free' ? 'active' : 'trial',
              expires_at: null,
            },
            { onConflict: 'user_id' }
          )
      }
    } catch (err: unknown) {
      // Не блокируем регистрацию, если таблицы нет — просто логируем
      console.warn('subscription save skipped:', getErrorMessage(err))
    } finally {
      setPlanSaving(false)
      setStep('done')
    }
  }

  const selectedRoleMeta = ROLES.find((role) => role.value === selectedRole)

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.16),_transparent_32%),linear-gradient(180deg,#FFF8F1_0%,#FFFFFF_48%,#FFFDF9_100%)] px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[1180px] overflow-hidden rounded-[30px] border border-orange-100/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.10)]">
        <div className="relative hidden w-[430px] shrink-0 overflow-hidden bg-zinc-950 lg:flex lg:flex-col">
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
              backgroundSize: '36px 36px',
            }}
          />
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-transparent" />
          <div className="absolute right-[-92px] top-[-74px] h-56 w-56 rounded-full bg-orange-500/25 blur-3xl" />
          <div className="absolute bottom-[-120px] left-[-80px] h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative flex items-center gap-3 px-10 pb-0 pt-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-500/30">
              <i className="ki-filled ki-abstract-26 text-[16px] text-white" />
            </div>
            <div>
              <div className="pf-num text-[24px] tracking-wide text-white">Sporteo</div>
              <div className="text-2xs uppercase tracking-[0.34em] text-zinc-500">Платформа атлета</div>
            </div>
          </div>

          <div className="relative flex-1 px-10 pb-10 pt-12">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.24em] text-orange-300">
              Поток onboarding
            </div>

            <p className="pf-num mb-5 mt-8 text-[64px] leading-[0.92] text-white">
              BUILD
              <br />
              <span className="text-orange-500">СВОЙ</span>
              <br />
              ПРОЦЕСС.
            </p>

            <p className="max-w-[290px] text-sm leading-relaxed text-zinc-400">
              Создайте аккаунт под свою роль, а затем откройте только те поля профиля, которые действительно нужны.
            </p>

            <div className="mt-8 grid gap-3">
              {[
                { label: 'Сначала роль', note: 'Сценарии для атлета, тренера и организации' },
                { label: 'Понятный шаг аккаунта', note: 'Ясные подсказки по паролю и email' },
                { label: 'Профиль атлета только по делу', note: 'Опциональные метрики без лишнего шума' },
              ].map((item, index) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-orange-400">
                    <i className={['ki-filled', index === 0 ? 'ki-user-square' : index === 1 ? 'ki-shield-tick' : 'ki-profile-circle', 'text-[17px]'].join(' ')} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{item.label}</div>
                    <div className="text-2xs text-zinc-400">{item.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative grid grid-cols-3 gap-3 border-t border-white/10 px-10 py-7">
            {[
              { value: '3', label: 'роли' },
              { value: '1', label: 'поток' },
              { value: '0', label: 'лишних шагов' },
            ].map((item) => (
              <div key={item.label}>
                <div className="pf-num text-[30px] text-white">{item.value}</div>
                <div className="mt-1 text-2xs uppercase tracking-[0.28em] text-zinc-600">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center px-6 py-8 sm:px-10 lg:px-14">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-500/20">
                <i className="ki-filled ki-abstract-26 text-sm text-white" />
              </div>
              <div>
                <div className="pf-num text-2xl text-foreground">Sporteo</div>
                <div className="text-2xs uppercase tracking-[0.28em] text-muted-foreground">Платформа атлета</div>
              </div>
            </div>

            <div className="hidden rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.24em] text-orange-700 sm:inline-flex">
              Рабочее пространство
            </div>
          </div>

          <div className="max-w-[580px]">
            <h1 className="pf-num text-[42px] leading-none text-foreground sm:text-[48px]">Регистрация</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
              Настройте аккаунт под свою роль, а затем, если вы атлет, добавьте профиль для более точной персонализации.
            </p>

            <StepIndicator current={step} role={selectedRole} />

            {step === 'role' && (
              <div className="pf-enter">
                <div className="mb-5">
                  <div className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Шаг 1</div>
                  <h2 className="pf-num mt-1 text-[28px] leading-none text-foreground sm:text-[32px]">Кто вы?</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Выберите сценарий, и мы покажем только нужные поля и следующий шаг.
                  </p>
                </div>

                <div className="grid gap-3">
                  {ROLES.map((role) => {
                    const isActive = selectedRole === role.value

                    return (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setSelectedRole(role.value)}
                        className={[
                          'group flex items-start gap-4 rounded-[24px] border p-4 text-left transition-all',
                          isActive
                            ? 'border-orange-200 bg-orange-50/80 shadow-[0_10px_30px_rgba(249,115,22,0.08)]'
                            : 'border-border bg-background hover:border-orange-200 hover:bg-orange-50/40',
                        ].join(' ')}
                      >
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
                          style={{ background: role.bg, borderColor: role.border }}
                        >
                          <i className={`ki-filled ${role.icon} text-[18px]`} style={{ color: role.text }} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-foreground">{role.label}</div>
                              <div className="mt-0.5 text-2xs text-muted-foreground">{role.desc}</div>
                            </div>
                            {isActive && (
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
                                <i className="ki-filled ki-check text-[11px]" />
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleRoleNext}
                    disabled={!selectedRole}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Продолжить
                    <i className="ki-filled ki-right text-xs" />
                  </button>
                </div>

                <p className="mt-4 text-center text-2sm text-muted-foreground">
                  Уже есть аккаунт?{' '}
                  <Link href="/auth/login" className="font-semibold text-orange-500 no-underline hover:text-orange-600">
                    Войти
                  </Link>
                </p>
              </div>
            )}

            {step === 'account' && (
              <div className="pf-enter">
                <button
                  onClick={() => setStep('role')}
                  className="mb-5 inline-flex items-center gap-1.5 text-2xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <i className="ki-filled ki-left text-[10px]" />
                  Назад к выбору роли
                </button>

                <div className="mb-5">
                  <div className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Шаг 2</div>
                  <h2 className="pf-num mt-1 text-[28px] leading-none text-foreground sm:text-[32px]">Создать аккаунт</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Регистрация как{' '}
                    <span className="font-semibold text-foreground">{selectedRoleMeta?.label ?? 'пользователь'}</span>.
                    Пароль должен быть не короче 8 символов, с заглавной буквой и цифрой.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <i className="ki-filled ki-information-4 mt-0.5 text-red-400" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleAccountSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Имя *
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Иван Иванов"
                      className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                    />
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Пароль *
                      </label>
                      <span className="text-2xs text-muted-foreground">8+ символов, заглавная буква и цифра</span>
                    </div>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value)
                        setPwdError('')
                      }}
                      placeholder="••••••••"
                      className={`w-full rounded-2xl border bg-background px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:ring-4 ${
                        pwdError
                          ? 'border-red-400 focus:ring-red-200'
                          : 'border-input focus:border-orange-400 focus:ring-orange-500/10'
                      }`}
                    />
                    {pwdError && <p className="mt-1 text-2xs text-red-500">{pwdError}</p>}

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {[
                        { label: '8+ символов', ok: password.length >= 8 },
                        { label: 'Заглавная', ok: /[A-Z]/.test(password) },
                        { label: 'Цифра', ok: /[0-9]/.test(password) },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                          <span className={`h-2 w-2 rounded-full ${item.ok ? 'bg-green-500' : 'bg-border'}`} />
                          <span className={`text-2xs font-medium ${item.ok ? 'text-green-700' : 'text-muted-foreground'}`}>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <span className="pf-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />
                        Создание аккаунта...
                      </>
                    ) : (
                      <>
                        {selectedRole === 'athlete' ? 'Продолжить' : 'Создать аккаунт'}
                        <i className="ki-filled ki-right text-xs" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {step === 'athlete_profile' && (
              <div className="pf-enter">
                <div className="mb-5">
                  <div className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Шаг 3</div>
                  <h2 className="pf-num mt-1 text-[28px] leading-none text-foreground sm:text-[32px]">Профиль атлета</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Эти данные помогут персонализировать аналитику и рекомендации. Все поля необязательны, можно пропустить этот шаг.
                  </p>
                </div>

                {athleteError && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <i className="ki-filled ki-information-4 mt-0.5 text-red-400" />
                    <span>{athleteError}</span>
                  </div>
                )}

                <form onSubmit={handleAthleteSubmit} className="flex flex-col gap-5">
                  <section className="rounded-[24px] border border-border bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF9F4_100%)] p-4 sm:p-5">
                    <div className="mb-4">
                      <div className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Личные данные</div>
                      <div className="mt-1 text-sm font-medium text-foreground">Базовая информация для профиля</div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Имя
                        </label>
                        <input
                          type="text"
                          value={athleteForm.first_name}
                          onChange={(event) => setAthleteForm((form) => ({ ...form, first_name: event.target.value }))}
                          placeholder="Иван"
                          className="w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Фамилия
                        </label>
                        <input
                          type="text"
                          value={athleteForm.last_name}
                          onChange={(event) => setAthleteForm((form) => ({ ...form, last_name: event.target.value }))}
                          placeholder="Иванов"
                          className="w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Дата рождения
                        </label>
                        <input
                          type="date"
                          value={athleteForm.birth_date}
                          onChange={(event) => setAthleteForm((form) => ({ ...form, birth_date: event.target.value }))}
                          max={new Date().toISOString().slice(0, 10)}
                          className="w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Пол
                        </label>
                        <select
                          value={athleteForm.gender}
                          onChange={(event) => setAthleteForm((form) => ({ ...form, gender: event.target.value }))}
                          className="w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                        >
                          <option value="">— Выбрать —</option>
                          <option value="male">Мужской</option>
                          <option value="female">Женский</option>
                          <option value="other">Другой</option>
                          <option value="prefer_not_to_say">Не указывать</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-border bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF9F4_100%)] p-4 sm:p-5">
                    <div className="mb-4">
                      <div className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Антропометрия</div>
                      <div className="mt-1 text-sm font-medium text-foreground">Измерения для аналитики и рекомендаций</div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Рост (см)
                        </label>
                        <input
                          type="number"
                          min="100"
                          max="250"
                          step="0.1"
                          value={athleteForm.height_cm}
                          onChange={(event) => setAthleteForm((form) => ({ ...form, height_cm: event.target.value }))}
                          placeholder="175"
                          className="w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Вес (кг)
                        </label>
                        <input
                          type="number"
                          min="30"
                          max="300"
                          step="0.1"
                          value={athleteForm.weight_kg}
                          onChange={(event) => setAthleteForm((form) => ({ ...form, weight_kg: event.target.value }))}
                          placeholder="70"
                          className="w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-border bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF9F4_100%)] p-4 sm:p-5">
                    <div className="mb-4">
                      <div className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Спортивный профиль</div>
                      <div className="mt-1 text-sm font-medium text-foreground">Вид спорта, уровень и цель</div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <div>
                        <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Основной вид спорта
                        </label>
                        <select
                          value={athleteForm.primary_sport}
                          onChange={(event) => setAthleteForm((form) => ({ ...form, primary_sport: event.target.value }))}
                          className="w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                        >
                          <option value="">— Выбрать —</option>
                          {SPORTS.map((sport) => (
                            <option key={sport} value={sport}>
                              {sport}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Уровень подготовки
                          </label>
                          <span className="text-2xs text-muted-foreground">Можно выбрать только один</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {FITNESS_LEVELS.map((level) => {
                            const isActive = athleteForm.fitness_level === level.value

                            return (
                              <button
                                key={level.value}
                                type="button"
                                onClick={() => setAthleteForm((form) => ({ ...form, fitness_level: level.value }))}
                                className={[
                                  'rounded-2xl border px-3 py-3 text-left transition-all',
                                  isActive
                                    ? 'border-orange-200 bg-orange-50'
                                    : 'border-border bg-background hover:border-orange-200 hover:bg-orange-50/50',
                                ].join(' ')}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className={`text-2xs font-semibold ${isActive ? 'text-orange-700' : 'text-foreground'}`}>
                                      {level.label}
                                    </div>
                                    <div className="mt-1 text-[10px] leading-tight text-muted-foreground">{level.desc}</div>
                                  </div>
                                  {isActive && (
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
                                      <i className="ki-filled ki-check text-[10px]" />
                                    </div>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Основная цель
                          </label>
                          <span className="text-2xs text-muted-foreground">Несколько опций, выбирается одна</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {GOALS.map((goal) => {
                            const isActive = athleteForm.goal === goal.value

                            return (
                              <button
                                key={goal.value}
                                type="button"
                                onClick={() => setAthleteForm((form) => ({ ...form, goal: goal.value }))}
                                className={[
                                  'rounded-full border px-3 py-2 text-2xs font-semibold transition-all',
                                  isActive
                                    ? 'border-orange-200 bg-orange-50 text-orange-700'
                                    : 'border-border bg-background text-muted-foreground hover:border-orange-200 hover:text-orange-600',
                                ].join(' ')}
                              >
                                {goal.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Часов тренировок в неделю
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="40"
                            step="0.5"
                            value={athleteForm.weekly_training_hours}
                            onChange={(event) => setAthleteForm((form) => ({ ...form, weekly_training_hours: event.target.value }))}
                            placeholder="8"
                            className="w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Город
                          </label>
                          <input
                            type="text"
                            value={athleteForm.city}
                            onChange={(event) => setAthleteForm((form) => ({ ...form, city: event.target.value }))}
                            placeholder="Москва"
                            className="w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                    <button
                      type="submit"
                      disabled={athleteSaving}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {athleteSaving ? (
                        <>
                          <span className="pf-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />
                          Сохранение...
                        </>
                      ) : (
                        <>
                          <i className="ki-filled ki-check text-xs" />
                          Сохранить и войти
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={skipAthleteProfile}
                      className="rounded-2xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-muted"
                    >
                      Пропустить шаг
                    </button>
                  </div>
                </form>
              </div>
            )}

            {step === 'plan' && (
              <div className="pf-enter">
                <div className="mb-5">
                  <div className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Последний шаг</div>
                  <h2 className="pf-num mt-1 text-[28px] leading-none text-foreground sm:text-[32px]">Выберите тариф</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Можно начать с Free и обновиться позже в настройках аккаунта.
                  </p>
                </div>

                {planError && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <i className="ki-filled ki-information-4 mt-0.5 text-red-400" />
                    <span>{planError}</span>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  {PLANS.map((plan) => {
                    const isActive = selectedPlan === plan.value
                    return (
                      <button
                        key={plan.value}
                        type="button"
                        onClick={() => setSelectedPlan(plan.value)}
                        className={[
                          'group flex flex-col gap-3 rounded-[24px] border p-4 text-left transition-all',
                          isActive
                            ? 'shadow-[0_10px_30px_rgba(15,23,42,0.08)]'
                            : 'hover:shadow-sm',
                        ].join(' ')}
                        style={{
                          background: isActive ? plan.bg : '#FFFFFF',
                          borderColor: isActive ? plan.accent : '#E5E7EB',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs uppercase tracking-[0.24em]" style={{ color: plan.accent }}>
                              {plan.label}
                            </div>
                            <div className="pf-num mt-1 text-[22px] leading-none text-foreground">{plan.price}</div>
                          </div>
                          {isActive && (
                            <div
                              className="flex h-7 w-7 items-center justify-center rounded-full text-white"
                              style={{ background: plan.accent }}
                            >
                              <i className="ki-filled ki-check text-[11px]" />
                            </div>
                          )}
                        </div>
                        <p className="text-2xs text-muted-foreground">{plan.desc}</p>
                        <ul className="flex flex-col gap-1.5 text-2xs text-foreground">
                          {plan.features.map((f) => (
                            <li key={f} className="flex items-start gap-2">
                              <i className="ki-filled ki-check-circle mt-0.5 text-[11px]" style={{ color: plan.accent }} />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handlePlanSubmit}
                    disabled={planSaving}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {planSaving ? (
                      <>
                        <span className="pf-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />
                        Сохранение...
                      </>
                    ) : (
                      <>
                        Завершить регистрацию
                        <i className="ki-filled ki-right text-xs" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === 'done' && (
              <div className="pf-enter flex flex-col items-center gap-5 py-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 border border-green-200">
                  <i className="ki-filled ki-check-circle text-3xl text-green-500" />
                </div>
                <div>
                  <div className="mb-2 inline-flex items-center rounded-full border border-green-200 bg-green-50 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.24em] text-green-700">
                    Готово
                  </div>
                  <h2 className="pf-num text-[28px] leading-none text-foreground">Аккаунт создан!</h2>
                  <p className="mt-2 text-2sm text-muted-foreground">
                    Проверьте почту <span className="font-semibold text-foreground">{email}</span> и подтвердите адрес,
                    затем войдите в приложение.
                  </p>
                  {/* W7 Day 33: telegraph the next step so users know what's coming */}
                  <p className="mt-2 text-2sm text-muted-foreground">
                    После входа — короткая настройка профиля (3-4 минуты).
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/auth/login"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white no-underline transition-all hover:bg-orange-600"
                  >
                    Войти в Sporteo
                    <i className="ki-filled ki-right text-xs" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
