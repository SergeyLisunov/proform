'use client'

import { type FormEvent, type KeyboardEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, TimerReset } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// W18 Day 94 C1 SECURITY FIX:
// Demo password gate. Previously hardcoded `'proform123'` rendered в UI
// + auto-filled на demo login click — security exposure (admin@proform.test
// share same password). Now sourced от NEXT_PUBLIC_DEMO_PASSWORD env var.
// Если env unset → demo section hidden entirely + DEMO_PASSWORD null.
//
// For production deploy: leave NEXT_PUBLIC_DEMO_PASSWORD unset → no demo
// access exposed. For dev/staging: set env var к whatever password seeded
// для test accounts.
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? null
const DEMO_ENABLED = DEMO_PASSWORD !== null

const TEST_ACCOUNTS = [
  {
    label: 'Атлет',
    email: 'athlete@proform.test',
    hint: 'Дневник, самочувствие, нагрузка',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    ring: 'hover:border-orange-200 hover:bg-orange-50/60',
  },
  {
    label: 'Тренер',
    email: 'coach@proform.test',
    hint: 'Группы, комментарии, контроль формы',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    ring: 'hover:border-green-200 hover:bg-green-50/60',
  },
  {
    label: 'Организация',
    email: 'org@proform.test',
    hint: 'Участники, коммуникация, структура клуба',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    ring: 'hover:border-blue-200 hover:bg-blue-50/60',
  },
  {
    label: 'Администратор',
    email: 'admin@proform.test',
    hint: 'Пользователи, события, аудит действий',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    ring: 'hover:border-violet-200 hover:bg-violet-50/60',
  },
  {
    label: 'Доктор',
    email: 'doctor@proform.test',
    hint: 'Медицинские заметки, восстановление, травмы',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    ring: 'hover:border-red-200 hover:bg-red-50/60',
  },
]

// W14 Day 71: marketing sidebar removed (now lives на public `/`).
// Login page focused on auth + demo-accounts only.

function getSafeRedirect(target: string | null) {
  if (!target || !target.startsWith('/') || target.startsWith('//')) {
    return '/dashboard'
  }

  return target
}

function getAuthErrorMessage(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'Неверная электронная почта или пароль.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'Подтвердите электронную почту перед входом.'
  }

  if (normalized.includes('network')) {
    return 'Не удалось связаться с сервером. Проверьте подключение и попробуйте еще раз.'
  }

  return message
}

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [lastLoginEmail, setLastLoginEmail] = useState('')
  const [selectedDemoEmail, setSelectedDemoEmail] = useState('')
  const [redirectTo, setRedirectTo] = useState('/dashboard')

  useEffect(() => {
    try {
      const savedEmail = window.localStorage.getItem('pf:last-login-email')
      const search = new URLSearchParams(window.location.search)
      setRedirectTo(getSafeRedirect(search.get('redirectTo')))
      if (savedEmail) {
        setLastLoginEmail(savedEmail)
        setEmail(savedEmail)
      }
    } catch {
      // localStorage can be unavailable in strict privacy modes.
    }
  }, [])

  function handlePasswordKey(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLockOn(event.getModifierState('CapsLock'))
  }

  async function signIn(nextEmail: string, nextPassword: string) {
    setLoading(true)
    setError('')

    const normalizedEmail = nextEmail.trim().toLowerCase()
    const { error: authError } = await createClient().auth.signInWithPassword({
      email: normalizedEmail,
      password: nextPassword,
    })

    if (authError) {
      setError(getAuthErrorMessage(authError.message))
      setLoading(false)
      return
    }

    try {
      window.localStorage.setItem('pf:last-login-email', normalizedEmail)
    } catch {
      // Ignore local persistence issues.
    }

    router.replace(redirectTo)
    router.refresh()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await signIn(email, password)
  }

  function applyDemoAccount(accountEmail: string) {
    if (!DEMO_PASSWORD) return  // demo disabled via env
    setSelectedDemoEmail(accountEmail)
    setEmail(accountEmail)
    setPassword(DEMO_PASSWORD)
    setError('')
  }

  async function handleDemoLogin(accountEmail: string) {
    if (!DEMO_PASSWORD) return  // demo disabled via env
    applyDemoAccount(accountEmail)
    await signIn(accountEmail, DEMO_PASSWORD)
  }

  return (
    <main
      id="main-content"
      className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.14),_transparent_32%),linear-gradient(180deg,#FFF8F1_0%,#FFFFFF_48%,#FFFDF9_100%)] px-4 py-8 sm:px-6 lg:px-10"
    >
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
        {/* Top bar: back-to-landing + logo */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground no-underline"
          >
            <ArrowLeft size={15} />
            На главную
          </Link>
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-500 shadow-md shadow-orange-500/20">
              <i className="ki-filled ki-abstract-26 text-sm text-white" />
            </div>
            <div className="text-right">
              <div className="pf-num text-lg text-foreground">Sporteo</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground -mt-0.5">Спортивная платформа</div>
            </div>
          </Link>
        </div>

        {/* Auth card */}
        <div className="rounded-[28px] border border-orange-100/80 bg-white px-6 py-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:px-10 sm:py-10">
          {/* Header strip (small visual only — marketing moved to /) */}
          <div className="mb-4 inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.24em] text-orange-700">
            Рабочее пространство
          </div>

          <div>
            <h1 className="pf-num text-[40px] leading-none text-foreground sm:text-[46px]">Войти</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
              Прогресс спортсмена в одной системе для всех, кто рядом.
              {DEMO_ENABLED ? ' Войдите в свой профиль — или попробуйте demo для одной из 5 ролей.' : ' Войдите в свой профиль.'}
            </p>

            {redirectTo !== '/dashboard' && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <ShieldCheck className="mt-0.5 shrink-0 text-blue-600" size={17} />
                <div>
                  Для продолжения нужно войти в аккаунт. После авторизации вернем вас на нужный экран автоматически.
                </div>
              </div>
            )}

            {lastLoginEmail && lastLoginEmail !== email && (
              <button
                type="button"
                onClick={() => setEmail(lastLoginEmail)}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-2sm text-foreground transition-colors hover:border-orange-200 hover:text-orange-600"
              >
                <TimerReset size={15} />
                Продолжить как {lastLoginEmail}
              </button>
            )}

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
              {error && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <i className="ki-filled ki-information-4 mt-0.5 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Электронная почта
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-2xl border border-input bg-background py-3 pl-11 pr-4 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Пароль
                  </label>
                  {DEMO_ENABLED && (
                    <span className="text-2xs text-muted-foreground">Демо пароль: {DEMO_PASSWORD}</span>
                  )}
                </div>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyUp={handlePasswordKey}
                    onKeyDown={handlePasswordKey}
                    onBlur={() => setCapsLockOn(false)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-input bg-background py-3 pl-11 pr-14 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-orange-50 hover:text-orange-600"
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                <div className="mt-2 flex min-h-5 items-center justify-between gap-2 text-2xs">
                  <span className={capsLockOn ? 'text-amber-600' : 'text-muted-foreground'}>
                    {capsLockOn ? 'Caps Lock включен: проверьте регистр символов.' : 'Используйте рабочий email спортсмена, тренера или команды.'}
                  </span>
                  {selectedDemoEmail && <span className="text-orange-600">Выбран demo-профиль</span>}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="pf-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />
                    Входим в систему...
                  </>
                ) : (
                  <>
                    Открыть рабочее пространство
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <p className="mt-5 text-center text-2sm text-muted-foreground">
              Нет аккаунта?{' '}
              <Link href="/auth/register" className="font-semibold text-orange-500 no-underline hover:text-orange-600">
                Зарегистрироваться
              </Link>
            </p>

            {/* W18 Day 94 C1 — entire demo section gated на DEMO_ENABLED.
                Production (NEXT_PUBLIC_DEMO_PASSWORD unset) → hidden.
                Dev/staging (env set) → visible с current behavior. */}
            {DEMO_ENABLED && (
            <div className="mt-7 rounded-[24px] border border-border bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF9F4_100%)] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
                    Быстрый доступ
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    Тестовые аккаунты для роли и сценария использования
                  </div>
                </div>
                <div className="rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.24em] text-orange-700">
                  Demo в один клик
                </div>
              </div>

              <div className="mt-4 grid gap-2.5">
                {TEST_ACCOUNTS.map((account) => (
                  <div
                    key={account.email}
                    className={`flex flex-col gap-3 rounded-2xl border border-border bg-white p-3 transition-all sm:flex-row sm:items-center ${account.ring}`}
                  >
                    <button
                      type="button"
                      onClick={() => applyDemoAccount(account.email)}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${account.iconBg}`}>
                        <span className={`pf-num text-sm ${account.iconColor}`}>{account.label[0]}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-foreground">{account.label}</div>
                          {selectedDemoEmail === account.email && (
                            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-700">
                              выбран
                            </span>
                          )}
                        </div>
                        <div className="truncate font-mono text-2xs text-muted-foreground">{account.email}</div>
                        <div className="mt-1 text-2xs text-muted-foreground">{account.hint}</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDemoLogin(account.email)}
                      disabled={loading}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-2sm font-semibold text-orange-700 transition-colors hover:bg-orange-100 disabled:opacity-60"
                    >
                      Войти в demo
                      <ArrowRight size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-2xs leading-relaxed text-muted-foreground">
                Demo пароль предустановлен. Нажмите «Войти в demo» — данные подставятся автоматически.
              </p>
            </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
