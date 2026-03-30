'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const TEST_ACCOUNTS = [
  { label: 'Атлет',         email: 'athlete@proform.test', iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
  { label: 'Тренер',        email: 'coach@proform.test',   iconBg: 'bg-green-100',  iconColor: 'text-green-600' },
  { label: 'Организация',   email: 'org@proform.test',     iconBg: 'bg-blue-100',   iconColor: 'text-blue-600'  },
  { label: 'Администратор', email: 'admin@proform.test',   iconBg: 'bg-violet-100', iconColor: 'text-violet-600'},
]

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await createClient().auth.signInWithPassword({ email, password })
    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      // жёсткий редирект — сбрасывает кэш сессии
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-5">
      <div className="w-full max-w-[920px] flex rounded-2xl overflow-hidden border border-border bg-card shadow-lg shadow-black/5">

        {/* ── Левая панель ── */}
        <div className="hidden lg:flex w-[380px] shrink-0 flex-col bg-zinc-950 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '36px 36px' }} />
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-transparent" />
          <div className="relative flex items-center gap-2.5 p-10 pb-0">
            <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
              <i className="ki-filled ki-abstract-26 text-white text-[15px]" />
            </div>
            <span className="pf-num text-[22px] text-white tracking-wide">ProForm</span>
          </div>
          <div className="relative flex-1 flex flex-col justify-center px-10">
            <p className="pf-num text-[52px] text-white leading-[1.05] mb-5">
              TRAIN<br /><span className="text-orange-500">SMART</span><br />ER.
            </p>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Professional training diary for athletes & coaches. Built on real WHOOP biometric data.
            </p>
          </div>
          <div className="relative flex gap-8 px-10 pb-10">
            {[{ value: '100K', label: 'Records' }, { value: '286', label: 'Athletes' }, { value: '39', label: 'Metrics' }].map(s => (
              <div key={s.label}>
                <div className="pf-num text-[28px] text-white leading-none">{s.value}</div>
                <div className="text-2xs text-zinc-600 uppercase tracking-widest mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Правая панель ── */}
        <div className="flex-1 flex flex-col justify-center px-8 py-10 sm:px-12">
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <i className="ki-filled ki-abstract-26 text-white text-sm" />
            </div>
            <span className="pf-num text-xl text-foreground">ProForm</span>
          </div>

          <h1 className="pf-num text-[38px] text-foreground leading-none mb-1">Войти</h1>
          <p className="text-2sm text-muted-foreground mb-8">Добро пожаловать — ваши данные тренировок ждут</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                <i className="ki-filled ki-information-4 text-red-400" />
                {error}
              </div>
            )}
            <div>
              <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Электронная почта</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 transition-all" />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Пароль</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 transition-all" />
            </div>
            <button type="submit" disabled={loading}
              className="mt-1 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full pf-spin" /> Вход…</>
                : <>Войти <i className="ki-filled ki-right text-xs" /></>}
            </button>
          </form>

          <p className="text-2sm text-muted-foreground mt-5 text-center">
            Нет аккаунта?{' '}
            <Link href="/auth/register" className="text-orange-500 font-semibold hover:text-orange-600 no-underline">
              Зарегистрироваться
            </Link>
          </p>

          {/* Быстрый доступ */}
          <div className="mt-6 p-4 bg-background rounded-xl border border-border">
            <div className="text-2xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
              Быстрый доступ — тестовые аккаунты
            </div>
            <div className="flex flex-col gap-2">
              {TEST_ACCOUNTS.map(a => (
                <button key={a.email} type="button"
                  onClick={() => { setEmail(a.email); setPassword('proform123') }}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card border border-border hover:border-orange-200 hover:bg-orange-50/40 transition-all text-left">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${a.iconBg}`}>
                    <span className={`pf-num text-xs ${a.iconColor}`}>{a.label[0]}</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-2sm font-semibold text-foreground leading-tight">{a.label}</div>
                    <div className="text-2xs text-muted-foreground font-mono">{a.email}</div>
                  </div>
                  <span className="text-2xs text-muted-foreground/50">нажмите для заполнения</span>
                </button>
              ))}
            </div>
            <p className="text-2xs text-muted-foreground/50 mt-2.5">
              Пароль для всех: <code className="text-muted-foreground">proform123</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
