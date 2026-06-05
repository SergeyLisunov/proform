'use client'

/**
 * /auth/register-as-parent — tenant refactor #4b-ii.
 *
 * Focused 2-step wizard for a parent registering a child athlete:
 *   1. Parent account (email, password, name) — standard supabase.auth.signUp;
 *      role defaults to 'athlete' (parent_links is what makes them a parent,
 *      not a global role).
 *   2. Child profile (name, dob, optional email) → POST /api/parent/register-child
 *      which creates the child auth user via admin client + parent_links row.
 *
 * 152-ФЗ note: для детей <14 родитель действует от их имени. UI показывает
 * соответствующее подтверждение, БД не enforces age-gate в этой версии.
 */
import { type FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, User as UserIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Step = 'parent' | 'child' | 'done'

function validatePassword(pwd: string): string {
  if (pwd.length < 8) return 'Минимум 8 символов'
  if (!/[A-Z]/.test(pwd)) return 'Нужна хотя бы одна заглавная буква'
  if (!/[0-9]/.test(pwd)) return 'Нужна хотя бы одна цифра'
  return ''
}

export default function RegisterAsParentPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('parent')

  // Parent fields
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [showPwd, setShowPwd]   = useState(false)

  // Child fields
  const [childName, setChildName]   = useState('')
  const [childDob, setChildDob]     = useState('')
  const [childEmail, setChildEmail] = useState('')

  // Flow state
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [childCreatedName, setChildCreatedName] = useState('')
  const [usedSyntheticEmail, setUsedSyntheticEmail] = useState(false)

  async function handleParentSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const pwdErr = validatePassword(password)
    if (pwdErr) { setPwdError(pwdErr); return }
    setPwdError('')
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role: 'athlete' } },
    })
    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }
    // Anti-enumeration check (same pattern as #158 register fix):
    // empty identities → email already exists, no email sent.
    const identities = signUpData?.user?.identities
    if (Array.isArray(identities) && identities.length === 0) {
      setError('Этот email уже зарегистрирован. Войдите и добавьте ребёнка из настроек.')
      setLoading(false)
      return
    }

    setLoading(false)
    setStep('child')
  }

  async function handleChildSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/parent/register-child', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        childName,
        childDob:   childDob || undefined,
        childEmail: childEmail.trim() || undefined,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setLoading(false)

    if (!res.ok || !json.ok) {
      const msg = json.error === 'email_taken'
        ? 'Этот email ребёнка уже занят. Уберите его или укажите другой.'
        : json.error === 'unauthorized'
          ? 'Сессия родителя истекла. Войдите снова.'
          : `Не удалось создать аккаунт ребёнка: ${json.error ?? 'неизвестная ошибка'}`
      setError(msg)
      return
    }

    setChildCreatedName(json.child_name)
    setUsedSyntheticEmail(!!json.used_synthetic_email)
    setStep('done')
  }

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(243,87,3,0.14),_transparent_32%),linear-gradient(180deg,#FFF8F1_0%,#FFFFFF_48%,#FFFDF9_100%)] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-6">

        <div className="flex items-center justify-between gap-4">
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground no-underline"
          >
            <ArrowLeft size={15} />
            Обычная регистрация
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

        <div className="rounded-[28px] border border-orange-100/80 bg-white px-6 py-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:px-10 sm:py-10">

          {/* Step indicator */}
          <div className="mb-6 flex items-center gap-2">
            {(['parent', 'child', 'done'] as const).map((s, i) => {
              const order  = (['parent', 'child', 'done'] as const).indexOf(step)
              const active = s === step
              const done   = i < order
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className={[
                    'flex h-7 w-7 items-center justify-center rounded-full text-2xs font-bold',
                    active ? 'bg-orange-500 text-white' :
                    done   ? 'bg-green-500 text-white' :
                             'bg-muted text-muted-foreground',
                  ].join(' ')}>
                    {done ? <i className="ki-filled ki-check text-[10px]" /> : i + 1}
                  </div>
                  {i < 2 && <span className="h-px w-6 bg-border" />}
                </div>
              )
            })}
            <span className="ml-3 text-2xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {step === 'parent' ? 'Ваш аккаунт' : step === 'child' ? 'Профиль ребёнка' : 'Готово'}
            </span>
          </div>

          {step === 'parent' && (
            <>
              <div className="mb-4 inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.24em] text-orange-700">
                Родитель / опекун
              </div>
              <h1 className="pf-num text-[36px] leading-none text-navy-500 sm:text-[40px]">Создать аккаунт</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                Сначала свой аккаунт, потом — профиль ребёнка. Под этим аккаунтом вы будете видеть
                расписание, абонементы и комментарии тренера.
              </p>

              <form onSubmit={handleParentSubmit} className="mt-7 flex flex-col gap-4">
                {error && (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <i className="ki-filled ki-information-4 mt-0.5 text-red-400" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Ваше имя *
                  </label>
                  <div className="relative">
                    <UserIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
                    <input type="text" required autoComplete="name" value={name}
                      onChange={(e) => setName(e.target.value)} placeholder="Анна Иванова"
                      className="w-full rounded-2xl border border-input bg-background py-3 pl-11 pr-4 text-sm text-foreground outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10" />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Электронная почта *
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
                    <input type="email" required autoComplete="email" value={email}
                      onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                      className="w-full rounded-2xl border border-input bg-background py-3 pl-11 pr-4 text-sm text-foreground outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10" />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Пароль *
                    </label>
                    <span className="text-2xs text-muted-foreground">8+ символов, заглавная, цифра</span>
                  </div>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
                    <input type={showPwd ? 'text' : 'password'} required autoComplete="new-password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setPwdError('') }}
                      placeholder="••••••••"
                      className={`w-full rounded-2xl border bg-background py-3 pl-11 pr-14 text-sm text-foreground outline-none transition-all focus:ring-4 ${
                        pwdError ? 'border-red-400 focus:ring-red-200' : 'border-input focus:border-orange-400 focus:ring-orange-500/10'
                      }`} />
                    <button type="button" onClick={() => setShowPwd((v) => !v)} aria-label={showPwd ? 'Скрыть пароль' : 'Показать пароль'}
                      className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:bg-orange-50 hover:text-orange-600">
                      {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {pwdError && <p className="mt-1 text-2xs text-red-500">{pwdError}</p>}
                </div>

                <button type="submit" disabled={loading}
                  className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? (
                    <><span className="pf-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />Создаём…</>
                  ) : (
                    <>Продолжить<ArrowRight size={16} /></>
                  )}
                </button>
              </form>
            </>
          )}

          {step === 'child' && (
            <>
              <div className="mb-4 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                Шаг 2 из 2
              </div>
              <h1 className="pf-num text-[32px] leading-none text-navy-500 sm:text-[36px]">Профиль ребёнка</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                Создадим аккаунт ребёнка-спортсмена и автоматически свяжем его с вашим. Email
                необязателен — если оставить пустым, ребёнок задаст его позже, когда вырастет.
              </p>

              <form onSubmit={handleChildSubmit} className="mt-7 flex flex-col gap-4">
                {error && (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <i className="ki-filled ki-information-4 mt-0.5 text-red-400" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Имя ребёнка *
                  </label>
                  <input type="text" required value={childName} onChange={(e) => setChildName(e.target.value)}
                    placeholder="Миша" maxLength={80}
                    className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10" />
                </div>

                <div>
                  <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Дата рождения (опционально)
                  </label>
                  <input type="date" value={childDob} onChange={(e) => setChildDob(e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                    className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10" />
                  <p className="mt-1 text-2xs text-muted-foreground">
                    Поможем подобрать корректные нормы по возрасту в будущем.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Email ребёнка (опционально)
                  </label>
                  <input type="email" value={childEmail} onChange={(e) => setChildEmail(e.target.value)}
                    placeholder="не обязателен"
                    className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10" />
                  <p className="mt-1 text-2xs text-muted-foreground">
                    Если не указать — сгенерируем технический. Позже ребёнок сможет привязать свой
                    email через настройки.
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-2xs leading-relaxed text-amber-900">
                  Регистрируя ребёнка, вы подтверждаете, что вы родитель или законный опекун, и
                  действуете от его имени. Медицинские данные ребёнка будут видны только тренеру и
                  врачу — в кабинете родителя они не показываются.
                </div>

                <button type="submit" disabled={loading || !childName.trim()}
                  className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? (
                    <><span className="pf-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />Создаём аккаунт ребёнка…</>
                  ) : (
                    <>Создать ребёнка и подключить<ArrowRight size={16} /></>
                  )}
                </button>
              </form>
            </>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-5 py-2 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-green-200 bg-green-50">
                <i className="ki-filled ki-check-circle text-3xl text-green-500" />
              </div>
              <div>
                <h1 className="pf-num text-[30px] leading-none text-navy-500">Готово!</h1>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Аккаунт ребёнка <span className="font-semibold text-foreground">{childCreatedName}</span> создан
                  и подключён к вашему. Откройте кабинет родителя — там расписание, абонементы и
                  комментарии тренера.
                </p>
                {usedSyntheticEmail && (
                  <p className="mt-3 text-2xs leading-relaxed text-muted-foreground">
                    Email для ребёнка был сгенерирован автоматически. Когда ребёнок захочет
                    собственный логин — задаст email через настройки своего профиля.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="button"
                  onClick={() => { router.replace('/parent/dashboard'); router.refresh() }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-600">
                  Открыть кабинет родителя
                  <ArrowRight size={16} />
                </button>
                <button type="button"
                  onClick={() => { setChildName(''); setChildDob(''); setChildEmail(''); setStep('child'); setError('') }}
                  className="rounded-2xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-muted">
                  Добавить ещё ребёнка
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
