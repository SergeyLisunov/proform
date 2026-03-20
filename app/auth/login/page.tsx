'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const DEMO = [
  { role: 'Athlete', email: 'athlete@proform.test', color: '#2563EB', bg: '#EFF6FF' },
  { role: 'Coach',   email: 'coach@proform.test',   color: '#F97316', bg: '#FFF7ED' },
  { role: 'Admin',   email: 'admin@proform.test',   color: '#7C3AED', bg: '#F5F3FF' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pass,  setPass]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await createClient().auth.signInWithPassword({ email, password: pass })
    if (error) { setError(error.message); setLoading(false) }
    else { router.push('/dashboard'); router.refresh() }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ display: 'flex', width: '100%', maxWidth: 900, background: '#fff', borderRadius: 24, border: '1px solid #E4E4E7', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.06)' }}>

        {/* Left – editorial branding */}
        <div className="hidden lg:flex" style={{ width: 380, flexShrink: 0, background: '#09090B', flexDirection: 'column', justifyContent: 'space-between', padding: 48, position: 'relative', overflow: 'hidden' }}>
          {/* grid bg */}
          <div style={{ position: 'absolute', inset: 0, opacity: 0.04,
            backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
            backgroundSize: '36px 36px' }} />
          {/* orange top line */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#F97316,transparent)' }} />

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ki-filled ki-abstract-26" style={{ color: '#fff', fontSize: 15 }} />
            </div>
            <span className="pf-num" style={{ fontSize: 22, color: '#fff', letterSpacing: '0.06em' }}>ProForm</span>
          </div>

          <div style={{ position: 'relative' }}>
            <div className="pf-num" style={{ fontSize: 52, color: '#fff', lineHeight: 1.05, marginBottom: 20 }}>
              TRAIN<br />
              <span style={{ color: '#F97316' }}>SMART</span><br />
              ER.
            </div>
            <p style={{ fontSize: 13, color: '#52525B', lineHeight: 1.7 }}>
              Professional training diary for athletes & coaches.
              Built on real WHOOP biometric data.
            </p>
          </div>

          <div style={{ position: 'relative', display: 'flex', gap: 32 }}>
            {[{ v: '100K', l: 'Records' }, { v: '286', l: 'Athletes' }, { v: '39', l: 'Metrics' }].map(({ v, l }) => (
              <div key={l}>
                <div className="pf-num" style={{ fontSize: 30, color: '#fff' }}>{v}</div>
                <div style={{ fontSize: 10, color: '#52525B', marginTop: 2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right – form */}
        <div style={{ flex: 1, padding: '48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="lg:hidden" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ki-filled ki-abstract-26" style={{ color: '#fff', fontSize: 13 }} />
            </div>
            <span className="pf-num" style={{ fontSize: 20, color: '#09090B' }}>ProForm</span>
          </div>

          <h1 className="pf-num" style={{ fontSize: 38, color: '#09090B', marginBottom: 4 }}>Sign in</h1>
          <p style={{ fontSize: 13, color: '#A1A1AA', marginBottom: 32 }}>Welcome back — your training data awaits</p>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ki-filled ki-shield-cross" style={{ color: '#EF4444', fontSize: 13 }} />
              <span style={{ fontSize: 12, color: '#DC2626' }}>{error}</span>
            </div>
          )}

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Email', type: 'email', val: email, set: setEmail, ph: 'you@example.com' },
              { label: 'Password', type: 'password', val: pass, set: setPass, ph: '••••••••' },
            ].map(({ label, type, val, set, ph }) => (
              <div key={label}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#71717A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>{label}</label>
                <input type={type} value={val} onChange={e => set(e.target.value)} required placeholder={ph}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E4E4E7', background: '#FAFAFA', fontSize: 14, color: '#09090B', outline: 'none', transition: 'border-color 0.15s, background 0.15s', fontFamily: "'DM Sans',sans-serif" }}
                  onFocus={e => { e.target.style.borderColor = '#F97316'; e.target.style.background = '#fff' }}
                  onBlur={e => { e.target.style.borderColor = '#E4E4E7'; e.target.style.background = '#FAFAFA' }}
                />
              </div>
            ))}
            <button type="submit" disabled={loading}
              style={{ marginTop: 4, padding: '12px', borderRadius: 10, border: 'none', background: '#F97316', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'opacity 0.15s', opacity: loading ? 0.7 : 1 }}>
              {loading
                ? <><div className="pf-spin" style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff', borderRadius: '50%' }} />Signing in…</>
                : 'Sign in →'}
            </button>
          </form>

          <p style={{ fontSize: 13, color: '#A1A1AA', marginTop: 24, textAlign: 'center' }}>
            No account?{' '}
            <Link href="/auth/register" style={{ color: '#F97316', fontWeight: 600, textDecoration: 'none' }}>Create one</Link>
          </p>

          {/* Test credentials */}
          <div style={{ marginTop: 28, padding: '16px', background: '#FAFAFA', borderRadius: 12, border: '1px solid #F4F4F5' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#A1A1AA', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 10 }}>
              Quick access — test accounts
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {DEMO.map(d => (
                <button key={d.role} type="button" onClick={() => { setEmail(d.email); setPass('proform123') }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: '#fff', border: '1px solid #E4E4E7', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = d.color)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#E4E4E7')}
                >
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: d.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="pf-num" style={{ fontSize: 11, color: d.color }}>{d.role[0]}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#09090B' }}>{d.role}</div>
                    <div style={{ fontSize: 11, color: '#A1A1AA', fontFamily: 'monospace' }}>{d.email}</div>
                  </div>
                  <span style={{ fontSize: 10, color: '#D4D4D8' }}>click to fill</span>
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#D4D4D8', marginTop: 8 }}>Password for all: <code style={{ color: '#A1A1AA' }}>proform123</code></p>
          </div>
        </div>
      </div>
    </div>
  )
}
