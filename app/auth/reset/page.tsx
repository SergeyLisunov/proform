'use client'

/**
 * /auth/reset — landing page for the password-recovery link.
 *
 * The recovery link can arrive in two shapes depending on Supabase's flow:
 *   • PKCE (default for @supabase/ssr): …/auth/reset?code=<uuid>
 *   • Implicit/hash:                    …/auth/reset#access_token=…&type=recovery
 * In both cases the supabase-js client, with `detectSessionInUrl` (on by
 * default), establishes a short-lived recovery session on load. We poll
 * `getSession()` to wait for that to settle, fall back to a manual
 * `exchangeCodeForSession` for the PKCE case if needed, and only then reveal
 * the "set a new password" form. `updateUser({ password })` writes the new
 * password against that recovery session.
 *
 * Expired/invalid links come back with an `error` in the URL hash
 * (e.g. `#error=access_denied&error_code=otp_expired`) — we detect that and
 * point the user back to /auth/forgot to request a fresh link.
 */
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Phase = 'verifying' | 'ready' | 'invalid' | 'done'

function validatePassword(pwd: string): string {
  if (pwd.length < 8) return 'Минимум 8 символов'
  if (!/[A-Z]/.test(pwd)) return 'Нужна хотя бы одна заглавная буква'
  if (!/[0-9]/.test(pwd)) return 'Нужна хотя бы одна цифра'
  return ''
}

function prettyLinkError(raw: string): string {
  const normalized = decodeURIComponent(raw).toLowerCase()
  if (/expired|otp_expired/.test(normalized)) {
    return 'Ссылка устарела. Запросите новое письмо для сброса пароля.'
  }
  if (/access_denied|invalid/.test(normalized)) {
    return 'Ссылка недействительна или уже использована. Запросите новое письмо.'
  }
  return 'Не удалось подтвердить ссылку. Запросите новое письмо для сброса пароля.'
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [phase, setPhase] = useState<Phase>('verifying')
  const [linkError, setLinkError] = useState('')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setPhase('ready')
      }
    })

    async function resolveSession() {
      // 1) Expired / denied links carry the error in the URL hash.
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const hashErr = hashParams.get('error_description') || hashParams.get('error')
      const queryErr = new URL(window.location.href).searchParams.get('error')
      if (hashErr || queryErr) {
        if (!active) return
        setLinkError(prettyLinkError(hashErr || queryErr || ''))
        setPhase('invalid')
        return
      }

      // 2) Wait for detectSessionInUrl to establish the recovery session.
      for (let i = 0; i < 8 && active; i++) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          if (active) setPhase('ready')
          return
        }
        await sleep(250)
      }

      // 3) Fallback — manual PKCE exchange if a code is still present.
      const code = new URL(window.location.href).searchParams.get('code')
      if (code && active) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (!exchangeError && active) {
          setPhase('ready')
          return
        }
      }

      if (active) {
        setLinkError('Ссылка недействительна или устарела. Запросите новое письмо для сброса пароля.')
        // Don't clobber a 'ready' that the onAuthStateChange listener may have
        // set in a late race — only fail if we're still verifying.
        setPhase((current) => (current === 'verifying' ? 'invalid' : current))
      }
    }

    void resolveSession()

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const pwdErr = validatePassword(password)
    if (pwdErr) {
      setPwdError(pwdErr)
      return
    }
    if (password !== confirm) {
      setPwdError('Пароли не совпадают')
      return
    }

    setPwdError('')
    setSaving(true)
    setError('')

    const { error: updateError } = await supabase.auth.updateUser({ password })

    setSaving(false)

    if (updateError) {
      if (/same.*password|should be different/i.test(updateError.message)) {
        setError('Новый пароль должен отличаться от текущего.')
        return
      }
      if (/session|expired|jwt/i.test(updateError.message)) {
        setLinkError('Сессия сброса истекла. Запросите новое письмо.')
        setPhase('invalid')
        return
      }
      setError(updateError.message)
      return
    }

    setPhase('done')
  }

  return (
    <main
      id="main-content"
      className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(243,87,3,0.14),_transparent_32%),linear-gradient(180deg,#FFF8F1_0%,#FFFFFF_48%,#FFFDF9_100%)] px-4 py-8 sm:px-6 lg:px-10"
    >
      <div className="mx-auto flex w-full max-w-[480px] flex-col gap-6">
        {/* Logo */}
        <div className="flex items-center justify-center">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-500 shadow-md shadow-orange-500/20">
              <i className="ki-filled ki-abstract-26 text-sm text-white" />
            </div>
            <div>
              <div className="pf-num text-lg text-foreground">Sporteo</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground -mt-0.5">Спортивная платформа</div>
            </div>
          </Link>
        </div>

        <div className="rounded-[28px] border border-orange-100/80 bg-white px-6 py-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:px-10 sm:py-10">
          {phase === 'verifying' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <span className="pf-spin h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent" />
              <p className="text-sm text-muted-foreground">Проверяем ссылку...</p>
            </div>
          )}

          {phase === 'invalid' && (
            <div className="flex flex-col items-center gap-5 py-2 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-200 bg-red-50">
                <i className="ki-filled ki-information-4 text-3xl text-red-400" />
              </div>
              <div>
                <h1 className="pf-num text-[30px] leading-none text-navy-500">Ссылка не сработала</h1>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{linkError}</p>
              </div>
              <Link
                href="/auth/forgot"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white no-underline transition-all hover:bg-orange-600"
              >
                Запросить новое письмо
                <ArrowRight size={16} />
              </Link>
            </div>
          )}

          {phase === 'ready' && (
            <>
              <div className="mb-4 inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.24em] text-orange-700">
                Новый пароль
              </div>
              <h1 className="pf-num text-[36px] leading-none text-navy-500 sm:text-[42px]">Задайте пароль</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                Придумайте новый пароль для входа. Минимум 8 символов, заглавная буква и цифра.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
                {error && (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <i className="ki-filled ki-information-4 mt-0.5 text-red-400" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Новый пароль
                  </label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(event) => { setPassword(event.target.value); setPwdError('') }}
                      placeholder="••••••••"
                      className={`w-full rounded-2xl border bg-background py-3 pl-11 pr-14 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:ring-4 ${
                        pwdError ? 'border-red-400 focus:ring-red-200' : 'border-input focus:border-orange-400 focus:ring-orange-500/10'
                      }`}
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

                <div>
                  <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Повторите пароль
                  </label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={confirm}
                      onChange={(event) => { setConfirm(event.target.value); setPwdError('') }}
                      placeholder="••••••••"
                      className="w-full rounded-2xl border border-input bg-background py-3 pl-11 pr-4 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                    />
                  </div>
                  {confirm && (
                    <p className={`mt-2 flex items-center gap-1.5 text-2xs font-medium ${confirm === password ? 'text-green-700' : 'text-red-500'}`}>
                      <i className={`ki-filled ${confirm === password ? 'ki-check-circle' : 'ki-cross-circle'} text-xs`} />
                      {confirm === password ? 'Пароли совпадают' : 'Пароли не совпадают'}
                    </p>
                  )}
                  {pwdError && <p className="mt-1 text-2xs text-red-500">{pwdError}</p>}
                </div>

                <button
                  type="submit"
                  disabled={saving || !password || password !== confirm}
                  className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <span className="pf-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />
                      Сохраняем...
                    </>
                  ) : (
                    <>
                      Сохранить пароль
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {phase === 'done' && (
            <div className="flex flex-col items-center gap-5 py-2 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-green-200 bg-green-50">
                <ShieldCheck className="text-green-500" size={30} />
              </div>
              <div>
                <h1 className="pf-num text-[30px] leading-none text-navy-500">Пароль обновлён</h1>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Новый пароль сохранён. Теперь можно войти в Sporteo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { router.replace('/dashboard'); router.refresh() }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-600"
              >
                Перейти в приложение
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
