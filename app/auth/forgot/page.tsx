'use client'

/**
 * /auth/forgot — request a password-reset email.
 *
 * Sends a Supabase recovery email via `resetPasswordForEmail`, pointing the
 * link back at /auth/reset (same origin, so it adapts to localhost / preview /
 * prod automatically). The /auth/reset path must be present in the Supabase
 * Auth "Redirect URLs" allow-list — see docs/runbooks/auth-email-smtp.md.
 *
 * Anti-enumeration: we always show the same "письмо отправлено" confirmation,
 * regardless of whether the address exists, so the form can't be used to probe
 * which emails are registered. Only genuine transport problems (rate limit,
 * network) surface an error.
 */
import { type FormEvent, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Mail, MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const normalizedEmail = email.trim().toLowerCase()
    const redirectTo = `${window.location.origin}/auth/reset`

    const { error: resetError } = await createClient().auth.resetPasswordForEmail(
      normalizedEmail,
      { redirectTo },
    )

    setLoading(false)

    if (resetError) {
      // Surface only rate-limit / transport errors. "User not found" style
      // responses are swallowed to avoid leaking account existence.
      if (/rate|too many|429/i.test(resetError.message)) {
        setError('Слишком много запросов. Подождите минуту и попробуйте снова.')
        return
      }
      if (/network|fetch/i.test(resetError.message)) {
        setError('Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз.')
        return
      }
      // Anything else — treat as success (don't reveal enumeration signal).
    }

    setSent(true)
  }

  return (
    <main
      id="main-content"
      className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(243,87,3,0.14),_transparent_32%),linear-gradient(180deg,#FFF8F1_0%,#FFFFFF_48%,#FFFDF9_100%)] px-4 py-8 sm:px-6 lg:px-10"
    >
      <div className="mx-auto flex w-full max-w-[480px] flex-col gap-6">
        {/* Top bar: back-to-login + logo */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground no-underline"
          >
            <ArrowLeft size={15} />
            Ко входу
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
          {sent ? (
            <div className="flex flex-col items-center gap-5 py-2 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-green-200 bg-green-50">
                <MailCheck className="text-green-500" size={30} />
              </div>
              <div>
                <h1 className="pf-num text-[30px] leading-none text-navy-500">Письмо отправлено</h1>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Если аккаунт с адресом <span className="font-semibold text-foreground">{email.trim().toLowerCase()}</span> существует,
                  мы отправили на него ссылку для сброса пароля. Проверьте входящие и папку «Спам».
                </p>
                <p className="mt-3 text-2xs leading-relaxed text-muted-foreground">
                  Ссылка действует ограниченное время. Не пришло за пару минут — проверьте адрес и попробуйте снова.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white no-underline transition-all hover:bg-orange-600"
                >
                  Вернуться ко входу
                  <ArrowRight size={16} />
                </Link>
                <button
                  type="button"
                  onClick={() => { setSent(false); setError('') }}
                  className="rounded-2xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-muted"
                >
                  Отправить ещё раз
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.24em] text-orange-700">
                Восстановление доступа
              </div>

              <h1 className="pf-num text-[38px] leading-none text-navy-500 sm:text-[44px]">Забыли пароль?</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                Укажите email, на который зарегистрирован аккаунт. Пришлём ссылку, чтобы задать новый пароль.
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

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <span className="pf-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />
                      Отправляем ссылку...
                    </>
                  ) : (
                    <>
                      Отправить ссылку
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-5 text-center text-2sm text-muted-foreground">
                Вспомнили пароль?{' '}
                <Link href="/auth/login" className="font-semibold text-orange-500 no-underline hover:text-orange-600">
                  Войти
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
