'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const ROLES = [
  { value: 'athlete', label: 'Athlete', icon: 'ki-abstract-26', desc: 'Log training, track metrics' },
  { value: 'coach',   label: 'Coach',   icon: 'ki-people',       desc: 'Manage athletes, leave notes' },
]

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [role, setRole] = useState<'athlete' | 'coach'>('athlete')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (step === 1) { setStep(2); return }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role } },
    })
    if (error) { setError(error.message); setLoading(false) }
    else { router.push('/dashboard'); router.refresh() }
  }

  return (
    <div className="w-full max-w-[440px] pf-page-enter">
      <div className="flex items-center justify-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#F97316' }}>
          <i className="ki-filled ki-abstract-26 text-white text-xl" />
        </div>
        <span className="pf-num text-3xl tracking-wide text-slate-900">ProForm</span>
      </div>

      <div className="card shadow-sm border border-[#E2E8F0] rounded-2xl">
        <div className="card-body p-8 lg:p-10">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {[1, 2].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${s <= step ? 'text-white' : 'bg-slate-100 text-slate-400'}`}
                  style={s <= step ? { background: '#F97316' } : {}}>
                  {s < step ? <i className="ki-filled ki-check" /> : s}
                </div>
                {s < 2 && <div className={`h-px w-8 transition-all ${step > s ? 'bg-orange-400' : 'bg-slate-200'}`} />}
              </div>
            ))}
            <span className="ml-2 text-xs text-slate-400">{step === 1 ? 'Choose role' : 'Your details'}</span>
          </div>

          <h1 className="pf-num text-2xl text-slate-900 mb-6">{step === 1 ? 'How will you use ProForm?' : 'Create your account'}</h1>

          {error && (
            <div className="flex items-center gap-3 rounded-xl p-4 mb-5 bg-red-50 border border-red-200">
              <i className="ki-filled ki-information-5 text-red-500" />
              <span className="text-sm text-red-600">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {step === 1 && (
              <div className="grid grid-cols-2 gap-3">
                {ROLES.map(r => (
                  <button key={r.value} type="button" onClick={() => setRole(r.value as 'athlete' | 'coach')}
                    className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all cursor-pointer text-left ${role === r.value ? 'border-[#F97316] bg-orange-50' : 'border-[#E2E8F0] hover:border-slate-300'}`}>
                    <i className={`ki-filled ${r.icon} text-2xl ${role === r.value ? 'text-[#F97316]' : 'text-slate-400'}`} />
                    <span className="font-semibold text-sm text-slate-800">{r.label}</span>
                    <span className="text-xs text-slate-400 text-center leading-snug">{r.desc}</span>
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Full name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Alex Petrov"
                    className="w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
                    className="w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="Min 8 characters"
                    className="w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition" />
                </div>
              </>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition"
              style={{ background: loading ? '#FDA96A' : '#F97316' }}>
              {loading ? 'Creating account…' : step === 1 ? 'Continue' : 'Create account'}
            </button>
          </form>

          {step === 1 && (
            <p className="text-center text-sm text-slate-500 mt-5">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-[#2563EB] font-medium hover:underline">Sign in</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
