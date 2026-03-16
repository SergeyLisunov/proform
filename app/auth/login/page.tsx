'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="w-full max-w-[440px] pf-page-enter">
      {/* Logo */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#F97316' }}>
          <i className="ki-filled ki-abstract-26 text-white text-xl" />
        </div>
        <span className="pf-num text-3xl tracking-wide text-slate-900">ProForm</span>
      </div>

      <div className="card shadow-sm border border-[#E2E8F0] rounded-2xl">
        <div className="card-body p-8 lg:p-10">
          <h1 className="pf-num text-2xl text-slate-900 mb-1">Sign in</h1>
          <p className="text-sm text-slate-500 mb-7">Enter your credentials to access your dashboard</p>

          {error && (
            <div className="kt-alert kt-alert-destructive flex items-center gap-3 rounded-xl p-4 mb-5 bg-red-50 border border-red-200">
              <i className="ki-filled ki-information-5 text-red-500 text-base" />
              <span className="text-sm text-red-600">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="kt-input w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm text-slate-900 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="kt-input w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm text-slate-900 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 outline-none transition"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="kt-btn w-full py-3 rounded-xl text-sm font-semibold text-white transition"
              style={{ background: loading ? '#FDA96A' : '#F97316' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="kt-spinner kt-spinner-sm border-white/30 border-t-white" />
                  Signing in…
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            No account?{' '}
            <Link href="/auth/register" className="text-[#2563EB] font-medium hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 mt-6">
        ProForm × WHOOP · Powered by Supabase
      </p>
    </div>
  )
}
