'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const TEST = [
  { role: 'Athlete', email: 'athlete@proform.test', col: '#2563EB', bg: '#EFF6FF' },
  { role: 'Coach',   email: 'coach@proform.test',   col: '#F97316', bg: '#FFF7ED' },
  { role: 'Admin',   email: 'admin@proform.test',   col: '#7C3AED', bg: '#F5F3FF' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else { router.push('/dashboard'); router.refresh() }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#fff' }}>

      {/* ── LEFT: branding panel ── */}
      <div className="hidden lg:flex" style={{
        width: 520, flexShrink: 0, flexDirection: 'column', justifyContent: 'space-between',
        padding: '48px 52px', background: '#FAFAFA', borderRight: '1px solid #F0F0F0',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle dot grid */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.5,
          backgroundImage: 'radial-gradient(#D4D4D8 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />
        {/* Orange corner accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: 'linear-gradient(180deg, #F97316 0%, #F97316 40%, transparent 100%)' }} />

        {/* Logo */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ki-filled ki-abstract-26" style={{ color: '#fff', fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: '#09090B', letterSpacing: '0.06em', lineHeight: 1 }}>ProForm</div>
            <div style={{ fontSize: 10, color: '#A1A1AA', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Training Diary</div>
          </div>
        </div>

        {/* Headline */}
        <div style={{ position: 'relative' }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 64, lineHeight: 0.95, color: '#09090B', letterSpacing: '0.01em', marginBottom: 20 }}>
            TRACK<br />
            <span style={{ color: '#F97316' }}>EVERY</span><br />
            REP.
          </div>
          <p style={{ fontSize: 15, color: '#71717A', lineHeight: 1.7, maxWidth: 340 }}>
            The training diary for serious athletes and their coaches. Powered by real WHOOP biometric data.
          </p>
          {/* Three feature pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 24 }}>
            {['100K WHOOP Records', 'HR Zone Tracking', 'Coach + Athlete Roles', 'Recovery Scores'].map(f => (
              <span key={f} style={{ padding: '5px 12px', borderRadius: 20, background: '#fff', border: '1px solid #E4E4E7', fontSize: 11, color: '#52525B', fontWeight: 500 }}>
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom stats */}
        <div style={{ position: 'relative', display: 'flex', gap: 40 }}>
          {[{ v: '100K', l: 'Records' }, { v: '286', l: 'Athletes' }, { v: '39', l: 'Metrics' }].map(({ v, l }) => (
            <div key={l}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, color: '#09090B', lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 3, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT: form panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>

        {/* Mobile logo */}
        <div className="lg:hidden" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ki-filled ki-abstract-26" style={{ color: '#fff', fontSize: 15 }} />
          </div>
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: '#09090B', letterSpacing: '0.06em' }}>ProForm</span>
        </div>

        <div style={{ width: '100%', maxWidth: 400 }}>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 40, color: '#09090B', letterSpacing: '0.02em', lineHeight: 1, marginBottom: 6 }}>Sign in</h1>
          <p style={{ fontSize: 14, color: '#A1A1AA', marginBottom: 28 }}>Welcome back — your dashboard awaits</p>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: '#FFF1F2', border: '1px solid #FECDD3', marginBottom: 20 }}>
              <i className="ki-filled ki-shield-cross" style={{ color: '#EF4444', fontSize: 14, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#BE123C' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#A1A1AA', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 7 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
                style={{ width: '100%', padding: '11px 14px', borderRadius: 11, border: '1.5px solid #E4E4E7', fontSize: 14, color: '#09090B', outline: 'none', background: '#fff', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor='#F97316'}
                onBlur={e => e.target.style.borderColor='#E4E4E7'}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#A1A1AA', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 7 }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                style={{ width: '100%', padding: '11px 14px', borderRadius: 11, border: '1.5px solid #E4E4E7', fontSize: 14, color: '#09090B', outline: 'none', background: '#fff', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor='#F97316'}
                onBlur={e => e.target.style.borderColor='#E4E4E7'}
              />
            </div>

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px', borderRadius: 12, border: 'none',
              background: '#F97316', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.75 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: "'DM Sans',sans-serif", transition: 'opacity 0.15s',
            }}>
              {loading
                ? <><div style={{ width:16,height:16,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/> Signing in…</>
                : 'Sign in →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 13, color: '#A1A1AA', marginTop: 20 }}>
            No account?{' '}
            <Link href="/auth/register" style={{ color: '#F97316', fontWeight: 600, textDecoration: 'none' }}>Create one</Link>
          </p>

          {/* Quick-fill test credentials */}
          <div style={{ marginTop: 28, borderRadius: 14, border: '1px solid #F0F0F0', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: '#FAFAFA', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#D4D4D8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Test accounts</span>
              <span style={{ fontSize: 10, color: '#D4D4D8' }}>click row to fill</span>
            </div>
            {TEST.map(({ role, email: e, col, bg }) => (
              <button key={role} type="button"
                onClick={() => { setEmail(e); setPassword('proform123') }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid #F5F5F5', cursor: 'pointer', textAlign: 'left' }}
                className="pf-test-row"
              >
                <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: bg, color: col }}>{role}</span>
                <span style={{ fontSize: 12, color: '#71717A', fontFamily: 'monospace', flex: 1 }}>{e}</span>
                <span style={{ fontSize: 11, color: '#D4D4D8' }}>proform123</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .pf-test-row:hover { background: #FAFAFA !important; }
      `}</style>
    </div>
  )
}
