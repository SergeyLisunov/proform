'use client'

/**
 * /auth/claim-child/[token] — tenant refactor #4b-v.
 *
 * Публичная страница для ребёнка-атлета: получает claim-токен от родителя,
 * задаёт свой email + пароль. POST → /api/auth/claim-child обновляет
 * auth.users.email/password + public.users.email через admin client и
 * помечает токен claimed.
 *
 * После успеха ребёнок может войти в /auth/login со своим email + паролем.
 */
import { type FormEvent, use, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'

function validatePassword(pwd: string): string {
  if (pwd.length < 8) return 'Минимум 8 символов'
  if (!/[A-Z]/.test(pwd)) return 'Нужна хотя бы одна заглавная буква'
  if (!/[0-9]/.test(pwd)) return 'Нужна хотя бы одна цифра'
  return ''
}

interface PageProps {
  params: Promise<{ token: string }>
}

export default function ClaimChildPage({ params }: PageProps) {
  const { token } = use(params)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState<{ email: string } | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const pwdErr = validatePassword(password)
    if (pwdErr) { setError(pwdErr); return }
    if (password !== confirm) { setError('Пароли не совпадают'); return }
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/claim-child', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, email, password }),
    })
    const json = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok || !json.ok) {
      const msg = json.error === 'email_taken'
        ? 'Этот email уже занят. Выберите другой.'
        : json.error === 'expired'
          ? 'Срок ссылки истёк. Попросите родителя выдать новую.'
          : json.error === 'already_claimed'
            ? 'Ссылка уже использована.'
            : json.error === 'invalid_token'
              ? 'Ссылка недействительна.'
              : `Не удалось привязать аккаунт: ${json.error ?? 'неизвестная ошибка'}`
      setError(msg)
      return
    }
    setDone({ email: json.email })
  }

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(243,87,3,0.14),_transparent_32%),linear-gradient(180deg,#FFF8F1_0%,#FFFFFF_48%,#FFFDF9_100%)] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[480px] flex-col gap-6">
        <Link href="/" className="self-center flex items-center gap-2.5 no-underline">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-500 shadow-md shadow-orange-500/20">
            <i className="ki-filled ki-abstract-26 text-sm text-white" />
          </div>
          <div className="text-right">
            <div className="pf-num text-lg text-foreground">Sporteo</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground -mt-0.5">Спортивная платформа</div>
          </div>
        </Link>

        <div className="rounded-[28px] border border-orange-100/80 bg-white px-6 py-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:px-10 sm:py-10">
          {done ? (
            <div className="flex flex-col items-center gap-5 py-2 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-green-200 bg-green-50">
                <ShieldCheck className="text-green-500" size={30} />
              </div>
              <div>
                <h1 className="pf-num text-[30px] leading-none text-navy-500">Аккаунт привязан</h1>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Войдите со своим email <span className="font-semibold text-foreground">{done.email}</span> и паролем,
                  который вы только что задали.
                </p>
              </div>
              <Link href="/auth/login"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white no-underline transition-all hover:bg-orange-600">
                Войти в Sporteo
                <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-4 inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.24em] text-orange-700">
                Привязка аккаунта
              </div>
              <h1 className="pf-num text-[34px] leading-none text-navy-500 sm:text-[40px]">Задайте свой логин</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                Ваш аккаунт уже создан родителем. Теперь задайте свой email и пароль — после этого
                сможете входить самостоятельно.
              </p>

              <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
                {error && (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <i className="ki-filled ki-information-4 mt-0.5 text-red-400" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Ваш email *
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
                      onChange={(e) => { setPassword(e.target.value); setError('') }}
                      placeholder="••••••••"
                      className="w-full rounded-2xl border border-input bg-background py-3 pl-11 pr-14 text-sm text-foreground outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10" />
                    <button type="button" onClick={() => setShowPwd((v) => !v)} aria-label={showPwd ? 'Скрыть' : 'Показать'}
                      className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:bg-orange-50 hover:text-orange-600">
                      {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Повторите пароль *
                  </label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
                    <input type={showPwd ? 'text' : 'password'} required autoComplete="new-password"
                      value={confirm} onChange={(e) => { setConfirm(e.target.value); setError('') }}
                      placeholder="••••••••"
                      className="w-full rounded-2xl border border-input bg-background py-3 pl-11 pr-4 text-sm text-foreground outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10" />
                  </div>
                </div>

                <button type="submit" disabled={loading || !email.trim() || !password || password !== confirm}
                  className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? (
                    <><span className="pf-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />Привязываем…</>
                  ) : (
                    <>Привязать аккаунт<ArrowRight size={16} /></>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
