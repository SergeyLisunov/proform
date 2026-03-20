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
    if (error) { setError(error.message); setLoading(false) }
    else { router.push('/dashboard'); router.refresh() }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#09090B' }}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #111113 0%, #1a1a1e 100%)' }}>
        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />
        {/* Orange accent line top */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, #F97316, transparent)' }} />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#F97316' }}>
            <i className="ki-filled ki-abstract-26 text-white text-base" />
          </div>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: '#fff', letterSpacing: '0.06em' }}>
            ProForm
          </span>
        </div>

        {/* Center quote */}
        <div className="relative">
          <div className="text-5xl mb-6" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F97316', lineHeight: 1, letterSpacing: '0.02em' }}>
            TRAIN<br />SMARTER.<br /><span style={{ color: '#ffffff' }}>NOT<br />HARDER.</span>
          </div>
          <p style={{ color: '#52525B', fontSize: 14, lineHeight: 1.7 }}>
            Professional training diary for athletes and coaches.<br />
            Powered by real WHOOP biometric data.
          </p>
        </div>

        {/* Stats row */}
        <div className="relative flex gap-8">
          {[{ v: '100K', l: 'WHOOP Records' }, { v: '286', l: 'Athletes' }, { v: '39', l: 'Metrics' }].map(({ v, l }) => (
            <div key={l}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#fff', lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 10, color: '#52525B', marginTop: 3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8" style={{ background: '#09090B' }}>
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F97316' }}>
            <i className="ki-filled ki-abstract-26 text-white text-sm" />
          </div>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: '#fff', letterSpacing: '0.06em' }}>ProForm</span>
        </div>

        <div className="w-full max-w-[380px]">
          <div className="mb-8">
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: '#fff', letterSpacing: '0.02em', lineHeight: 1 }}>
              Sign in
            </h1>
            <p style={{ color: '#71717A', fontSize: 14, marginTop: 8 }}>
              Welcome back — your training data awaits
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-3 rounded-xl p-4 mb-6"
              style={{ background: '#1c0a0a', border: '1px solid #3f1515' }}>
              <i className="ki-filled ki-shield-cross text-sm" style={{ color: '#EF4444' }} />
              <span style={{ fontSize: 13, color: '#EF4444' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#52525B', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="you@example.com"
                style={{ width: '100%', background: '#111113', border: '1px solid #27272A', borderRadius: 12, padding: '12px 16px', fontSize: 14, color: '#fff', outline: 'none', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = '#F97316'}
                onBlur={e => e.target.style.borderColor = '#27272A'}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#52525B', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>
                Password
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••"
                style={{ width: '100%', background: '#111113', border: '1px solid #27272A', borderRadius: 12, padding: '12px 16px', fontSize: 14, color: '#fff', outline: 'none', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = '#F97316'}
                onBlur={e => e.target.style.borderColor = '#27272A'}
              />
            </div>

            <button type="submit" disabled={loading}
              className="mt-2"
              style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: loading ? '#7c3810' : '#F97316', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.15s' }}>
              {loading ? (
                <>
                  <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Signing in…
                </>
              ) : 'Sign in →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 13, color: '#52525B', marginTop: 24 }}>
            No account?{' '}
            <Link href="/auth/register" style={{ color: '#F97316', fontWeight: 600, textDecoration: 'none' }}>
              Create one
            </Link>
          </p>

          {/* Test credentials hint */}
          <div className="mt-8 rounded-xl p-4" style={{ background: '#111113', border: '1px solid #1d1d20' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#3f3f46', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>
              Test credentials
            </div>
            {[
              { r: 'Athlete', e: 'athlete@proform.test' },
              { r: 'Coach', e: 'coach@proform.test' },
              { r: 'Admin', e: 'admin@proform.test' },
            ].map(({ r, e }) => (
              <button key={r} type="button"
                onClick={() => { setEmail(e); setPassword('proform123') }}
                style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '6px 0', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: '1px solid #1d1d20' }}>
                <span style={{ fontSize: 12, color: '#52525B' }}>{r}</span>
                <span style={{ fontSize: 12, color: '#3f3f46', fontFamily: 'monospace' }}>{e}</span>
              </button>
            ))}
            <p style={{ fontSize: 11, color: '#3f3f46', marginTop: 8 }}>Password: <code style={{ color: '#52525B' }}>proform123</code> · click row to fill</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
