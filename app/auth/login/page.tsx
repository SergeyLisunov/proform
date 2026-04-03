'use client'

import { type FormEvent, type KeyboardEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, TimerReset, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const DEMO_PASSWORD = 'proform123'

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
]

const FEATURE_STRIPS = [
  { icon: Zap, label: 'Аналитика с поддержкой WHOOP' },
  { icon: ShieldCheck, label: 'Прозрачность для тренера' },
  { icon: TimerReset, label: 'Быстрый demo-доступ' },
]

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
    setSelectedDemoEmail(accountEmail)
    setEmail(accountEmail)
    setPassword(DEMO_PASSWORD)
    setError('')
  }

  async function handleDemoLogin(accountEmail: string) {
    applyDemoAccount(accountEmail)
    await signIn(accountEmail, DEMO_PASSWORD)
  }

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.18),_transparent_32%),linear-gradient(180deg,#FFF8F1_0%,#FFFFFF_48%,#FFFDF9_100%)] px-4 py-6 sm:px-6 lg:px-10">
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
              <div className="pf-num text-[24px] tracking-wide text-white">ProForm</div>
              <div className="text-2xs uppercase tracking-[0.34em] text-zinc-500">Платформа атлета</div>
            </div>
          </div>

          <div className="relative flex-1 px-10 pb-10 pt-12">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.24em] text-orange-300">
              Тренировочный интеллект
            </div>

            <p className="pf-num mb-5 mt-8 text-[64px] leading-[0.92] text-white">
              BUILD
              <br />
              <span className="text-orange-500">РИТМ.</span>
              <br />
              ВЫИГРЫВАЙ ЦИКЛ.
            </p>

            <p className="max-w-[280px] text-sm leading-relaxed text-zinc-400">
              Тренировки, восстановление, тренерская обратная связь и командная координация в одном рабочем процессе.
            </p>

            <div className="mt-8 grid gap-3">
              {FEATURE_STRIPS.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-orange-400">
                    <Icon size={17} />
                  </div>
                  <div className="text-sm font-medium text-white">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative grid grid-cols-3 gap-3 border-t border-white/10 px-10 py-7">
            {[
              { value: '100K', label: 'записей' },
              { value: '286', label: 'атлетов' },
              { value: '39', label: 'метрик' },
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
                <div className="pf-num text-2xl text-foreground">ProForm</div>
                <div className="text-2xs uppercase tracking-[0.28em] text-muted-foreground">Платформа атлета</div>
              </div>
            </div>

            <div className="hidden rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.24em] text-orange-700 sm:inline-flex">
              Рабочее пространство
            </div>
          </div>

          <div className="max-w-[520px]">
            <h1 className="pf-num text-[42px] leading-none text-foreground sm:text-[48px]">Войти</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
              Возвращайтесь в тренировочный ритм без лишних действий. Вход запоминает последний email и поддерживает быстрый demo-сценарий.
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
                  <span className="text-2xs text-muted-foreground">Demo password: {DEMO_PASSWORD}</span>
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
                Для всех demo-аккаунтов используется пароль <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-foreground">{DEMO_PASSWORD}</code>.
                Вы можете либо подставить данные, либо сразу войти одним кликом.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
