'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { SportType } from '@/types/org.types'

type RoleChoice = 'athlete' | 'coach' | 'organization'

const ROLES: { value: RoleChoice; label: string; icon: string; desc: string }[] = [
  { value: 'athlete',      label: 'Athlete',       icon: 'ki-abstract-26',  desc: 'Log training, track metrics' },
  { value: 'coach',        label: 'Coach',          icon: 'ki-people',       desc: 'Manage athletes, leave notes' },
  { value: 'organization', label: 'Organization',   icon: 'ki-office-bag',   desc: 'Sports club, federation, team' },
]

const SPORT_TYPES: { value: SportType; label: string }[] = [
  { value: 'athletics',  label: 'Athletics' },
  { value: 'swimming',   label: 'Swimming' },
  { value: 'cycling',    label: 'Cycling' },
  { value: 'triathlon',  label: 'Triathlon' },
  { value: 'football',   label: 'Football' },
  { value: 'basketball', label: 'Basketball' },
  { value: 'tennis',     label: 'Tennis' },
  { value: 'volleyball', label: 'Volleyball' },
  { value: 'wrestling',  label: 'Wrestling' },
  { value: 'other',      label: 'Other' },
]

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [role, setRole] = useState<RoleChoice>('athlete')

  // Personal details
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Org-specific fields
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [sportType, setSportType] = useState<SportType>('other')
  const [city, setCity] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleOrgNameChange(val: string) {
    setOrgName(val)
    setOrgSlug(slugify(val))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (step === 1) { setStep(2); return }
    if (step === 2 && role === 'organization') { setStep(3); return }

    setLoading(true)
    setError('')
    const supabase = createClient()

    const orgMeta = role === 'organization'
      ? { org_name: orgName, org_slug: orgSlug, sport_type: sportType, city }
      : {}

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role, ...orgMeta } },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // If organization role — create the organizations record
    if (role === 'organization' && data.user) {
      // The trigger or post-signup hook should handle this, but we also try directly
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', data.user.id)
        .single()

      if (userData) {
        await supabase.from('organizations').insert({
          user_id: userData.id,
          org_name: orgName,
          org_slug: orgSlug,
          sport_type: sportType,
          city: city || null,
        })
      }
    }

    router.push('/dashboard')
    router.refresh()
  }

  const totalSteps = role === 'organization' ? 3 : 2
  const stepLabels = ['Choose role', 'Your details', ...(role === 'organization' ? ['Organization'] : [])]

  return (
    <div className="w-full max-w-[480px] pf-page-enter">
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
            {[1, 2, ...(role === 'organization' ? [3] : [])].map((s, idx) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${s <= step ? 'text-white' : 'bg-slate-100 text-slate-400'}`}
                  style={s <= step ? { background: '#F97316' } : {}}
                >
                  {s < step ? <i className="ki-filled ki-check" /> : s}
                </div>
                {idx < (role === 'organization' ? 2 : 1) && (
                  <div className={`h-px w-8 transition-all ${step > s ? 'bg-orange-400' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
            <span className="ml-2 text-xs text-slate-400">{stepLabels[(step as number) - 1]}</span>
          </div>

          <h1 className="pf-num text-2xl text-slate-900 mb-6">
            {step === 1 ? 'How will you use ProForm?' : step === 2 ? 'Create your account' : 'Organization details'}
          </h1>

          {error && (
            <div className="flex items-center gap-3 rounded-xl p-4 mb-5 bg-red-50 border border-red-200">
              <i className="ki-filled ki-information-5 text-red-500" />
              <span className="text-sm text-red-600">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* STEP 1: role selection */}
            {step === 1 && (
              <div className="grid grid-cols-1 gap-3">
                {ROLES.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${role === r.value ? 'border-[#F97316] bg-orange-50' : 'border-[#E2E8F0] hover:border-slate-300'}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${role === r.value ? 'bg-orange-100' : 'bg-slate-100'}`}>
                      <i className={`ki-filled ${r.icon} text-xl ${role === r.value ? 'text-[#F97316]' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-slate-800">{r.label}</div>
                      <div className="text-xs text-slate-400 leading-snug">{r.desc}</div>
                    </div>
                    {role === r.value && (
                      <i className="ki-filled ki-check-circle text-[#F97316] text-lg ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* STEP 2: personal details */}
            {step === 2 && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Full name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    placeholder="Alex Petrov"
                    className="w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Min 8 characters"
                    className="w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>
              </>
            )}

            {/* STEP 3: org details (only for organization role) */}
            {step === 2 && role === 'organization' && (
              /* Shown together with personal details for org flow — we show org fields on a 3rd step */
              null
            )}

            {(step as number) === 3 && role === 'organization' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Organization name *</label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={e => handleOrgNameChange(e.target.value)}
                    required
                    placeholder="e.g. Moscow Athletic Club"
                    className="w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Slug (public URL)
                  </label>
                  <div className="flex items-center rounded-xl border border-[#E2E8F0] overflow-hidden focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-blue-100 transition">
                    <span className="px-3 py-3 text-xs text-slate-400 bg-slate-50 border-r border-[#E2E8F0] shrink-0">proform.app/</span>
                    <input
                      type="text"
                      value={orgSlug}
                      onChange={e => setOrgSlug(slugify(e.target.value))}
                      required
                      placeholder="moscow-athletic-club"
                      className="flex-1 px-3 py-3 text-sm outline-none bg-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Sport type</label>
                  <select
                    value={sportType}
                    onChange={e => setSportType(e.target.value as SportType)}
                    className="w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition bg-white"
                  >
                    {SPORT_TYPES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="Moscow"
                    className="w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>
              </>
            )}

            <div className="flex gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(prev => (prev - 1) as 1 | 2 | 3)}
                  className="px-4 py-3 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition"
                style={{ background: loading ? '#FDA96A' : '#F97316' }}
              >
                {loading
                  ? 'Creating account…'
                  : step === 1
                  ? 'Continue'
                  : role === 'organization' && step === 2
                  ? 'Next: Org details'
                  : 'Create account'}
              </button>
            </div>
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
