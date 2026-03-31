'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'

// ── Types ──────────────────────────────────────────────────────────────────────
type AthleteProfile = {
  // users table
  name: string
  email: string
  // athletes table
  sport_type: string | null
  weight_kg: number | null
  height_cm: number | null
  avatar_url: string | null
  background_url: string | null
  instagram_url: string | null
  twitter_url: string | null
  threads_url: string | null
  bio: string | null
}

type WorkoutStats = {
  total: number
  totalMinutes: number
  avgStrain: number
  thisWeek: number
}

// ── Supabase client ────────────────────────────────────────────────────────────
function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Social Edit Modal ──────────────────────────────────────────────────────────
function SocialEditModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: AthleteProfile
  onClose: () => void
  onSaved: (p: Partial<AthleteProfile>) => void
}) {
  const { user } = useUser()
  const [instagram, setInstagram] = useState(profile.instagram_url ?? '')
  const [twitter, setTwitter] = useState(profile.twitter_url ?? '')
  const [threads, setThreads] = useState(profile.threads_url ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!user) return
    setSaving(true)
    const sb = getSB()
    await sb.from('athletes').update({
      instagram_url: instagram || null,
      twitter_url: twitter || null,
      threads_url: threads || null,
    }).eq('id', user.id)
    onSaved({ instagram_url: instagram || null, twitter_url: twitter || null, threads_url: threads || null })
    setSaving(false)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'relative', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, width: 400, maxWidth: '95vw', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Социальные сети</h3>
          <button onClick={onClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
            <i className="ki-filled ki-cross text-sm" />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Instagram', value: instagram, set: setInstagram, placeholder: 'https://instagram.com/username', icon: '📸', color: '#E1306C' },
            { label: 'Twitter / X', value: twitter, set: setTwitter, placeholder: 'https://x.com/username', icon: '🐦', color: '#1DA1F2' },
            { label: 'Threads', value: threads, set: setThreads, placeholder: 'https://threads.net/@username', icon: '🧵', color: '#000' },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>
                {f.icon} {f.label}
              </label>
              <input
                type="url"
                value={f.value}
                onChange={e => f.set(e.target.value)}
                placeholder={f.placeholder}
                className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400"
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={handleSave} disabled={saving} className="kt-btn kt-btn-primary flex-1">
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button onClick={onClose} className="kt-btn kt-btn-outline">Отмена</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AthleteProfileCard() {
  const { user } = useUser()
  const [profile, setProfile] = useState<AthleteProfile | null>(null)
  const [stats, setStats] = useState<WorkoutStats>({ total: 0, totalMinutes: 0, avgStrain: 0, thisWeek: 0 })
  const [loading, setLoading] = useState(true)
  const [showSocialEdit, setShowSocialEdit] = useState(false)

  useEffect(() => {
    if (!user) return
    const sb = getSB()

    async function load() {
      const [{ data: athleteData }, { data: workoutsData }] = await Promise.all([
        sb.from('athletes').select('*').eq('id', user!.id).single(),
        sb.from('workouts').select('activity_duration_min, activity_strain, event_date').eq('athlete_id', user!.id),
      ])

      const p: AthleteProfile = {
        name: user!.name ?? user!.email ?? 'Атлет',
        email: user!.email ?? '',
        sport_type: athleteData?.sport_type ?? null,
        weight_kg: athleteData?.weight_kg ?? null,
        height_cm: athleteData?.height_cm ?? null,
        avatar_url: athleteData?.avatar_url ?? null,
        background_url: athleteData?.background_url ?? null,
        instagram_url: athleteData?.instagram_url ?? null,
        twitter_url: athleteData?.twitter_url ?? null,
        threads_url: athleteData?.threads_url ?? null,
        bio: athleteData?.bio ?? null,
      }
      setProfile(p)

      if (workoutsData) {
        const now = new Date()
        now.setHours(0, 0, 0, 0)
        const weekAgo = new Date(now.getTime() - 7 * 86400000)
        const weekWorkouts = workoutsData.filter(w => w.event_date && new Date(w.event_date + 'T00:00:00') >= weekAgo)
        const totalMin = workoutsData.reduce((s, w) => s + (w.activity_duration_min ?? 0), 0)
        const strains = workoutsData.filter(w => w.activity_strain != null)
        const avgStrain = strains.length ? strains.reduce((s, w) => s + Number(w.activity_strain), 0) / strains.length : 0
        setStats({ total: workoutsData.length, totalMinutes: totalMin, avgStrain: Math.round(avgStrain * 10) / 10, thisWeek: weekWorkouts.length })
      }
      setLoading(false)
    }
    load()
  }, [user])

  function fmtHours(min: number) {
    if (min < 60) return `${min}м`
    const h = Math.floor(min / 60)
    return `${h}ч`
  }

  if (loading) return (
    <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-center min-h-[280px]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!profile) return null

  const initials = profile.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Background */}
        <div style={{
          height: 120,
          background: profile.background_url
            ? `url(${profile.background_url}) center/cover`
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f97316 100%)',
          position: 'relative',
        }}>
          {/* Edit background button */}
          <Link href="/settings"
            style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.35)', borderRadius: 8, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', color: 'white', fontSize: 11, fontWeight: 600 }}>
            <i className="ki-filled ki-pencil text-xs" />Изменить
          </Link>
        </div>

        <div style={{ padding: '0 24px 24px' }}>
          {/* Avatar row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -36 }}>
            <div style={{ position: 'relative' }}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.name}
                  style={{ width: 72, height: 72, borderRadius: '50%', border: '3px solid var(--card)', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: '50%', border: '3px solid var(--card)', background: 'linear-gradient(135deg, #f97316, #ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: 'white' }}>{initials}</span>
                </div>
              )}
              {/* Online dot */}
              <span style={{ position: 'absolute', bottom: 4, right: 4, width: 14, height: 14, borderRadius: '50%', background: '#22c55e', border: '2px solid var(--card)' }} />
            </div>

            {/* Social buttons */}
            <div style={{ display: 'flex', gap: 8, paddingBottom: 4 }}>
              {profile.instagram_url && (
                <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer"
                  className="kt-btn kt-btn-sm kt-btn-icon kt-btn-outline"
                  title="Instagram">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
                </a>
              )}
              {profile.twitter_url && (
                <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer"
                  className="kt-btn kt-btn-sm kt-btn-icon kt-btn-outline"
                  title="Twitter / X">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
              )}
              {profile.threads_url && (
                <a href={profile.threads_url} target="_blank" rel="noopener noreferrer"
                  className="kt-btn kt-btn-sm kt-btn-icon kt-btn-outline"
                  title="Threads">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.471 12.01v-.017c.029-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.293-1.806-1.817-.436 3.048-2.266 4.878-5.309 5.056-2.329.138-4.518-.988-4.62-3.411-.026-.634.032-1.219.17-1.742.422-1.578 1.674-2.564 3.492-2.773.852-.098 1.713-.09 2.562-.038.149.009.297.02.446.033l.018.002c-.051-.543-.186-.997-.4-1.35-.311-.513-.83-.81-1.647-.81-.607 0-1.127.153-1.543.454l-1.218-1.59C9.94 7.867 10.93 7.5 12.1 7.5c2.9 0 4.578 1.71 4.615 4.76.006.498-.002.998-.025 1.498-.021.465-.046.932-.08 1.395.532.175 1.002.391 1.398.65 1.37.888 2.086 2.146 2.086 3.637 0 3.42-2.875 5.56-7.906 5.56zm1.054-8.14c-1.134-.073-1.96.26-2.24 1.063-.069.2-.096.448-.073.752.097 1.3 1.206 1.63 2.317 1.63.184 0 .37-.01.553-.03 1.633-.178 2.474-1.128 2.613-2.962-.37-.05-.742-.087-1.113-.117a18.43 18.43 0 0 0-2.057-.336z"/></svg>
                </a>
              )}
              <button onClick={() => setShowSocialEdit(true)} className="kt-btn kt-btn-sm kt-btn-outline gap-1.5">
                <i className="ki-filled ki-plus text-xs" />
                {(profile.instagram_url || profile.twitter_url || profile.threads_url) ? 'Соцсети' : 'Добавить соцсети'}
              </button>
            </div>
          </div>

          {/* Name & bio */}
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>{profile.name}</h2>
              {profile.sport_type && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }}>
                  {profile.sport_type}
                </span>
              )}
            </div>
            {profile.bio && (
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '4px 0 0', lineHeight: 1.5 }}>{profile.bio}</p>
            )}
            {(profile.height_cm || profile.weight_kg) && (
              <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                {profile.height_cm && <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>📏 {profile.height_cm} см</span>}
                {profile.weight_kg && <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>⚖️ {profile.weight_kg} кг</span>}
              </div>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, marginTop: 20, background: 'var(--border)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {[
              { label: 'Тренировок', value: stats.total, icon: 'ki-abstract-26', href: '/diary', color: '#2563EB', bg: '#EFF6FF' },
              { label: 'Часов', value: fmtHours(stats.totalMinutes), icon: 'ki-time', href: '/diary', color: '#F97316', bg: '#FFF7ED' },
              { label: 'Ср. нагрузка', value: stats.avgStrain || '—', icon: 'ki-chart-line-up', href: '/calendar', color: '#DC2626', bg: '#FEF2F2' },
              { label: 'На неделе', value: stats.thisWeek, icon: 'ki-calendar', href: '/calendar', color: '#16A34A', bg: '#F0FDF4' },
            ].map(s => (
              <Link key={s.label} href={s.href}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 8px', background: 'var(--card)', textDecoration: 'none', transition: 'background 0.15s' }}
                className="hover:bg-accent/50">
                <div style={{ width: 32, height: 32, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                  <i className={`ki-filled ${s.icon} text-sm`} style={{ color: s.color }} />
                </div>
                <div className="pf-num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2, textAlign: 'center' }}>{s.label}</div>
              </Link>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Link href="/diary" className="kt-btn kt-btn-primary gap-2" style={{ flex: 1, justifyContent: 'center' }}>
              <i className="ki-filled ki-plus text-sm" />Новая тренировка
            </Link>
            <Link href="/settings" className="kt-btn kt-btn-outline gap-2">
              <i className="ki-filled ki-setting-2 text-sm" />Профиль
            </Link>
          </div>
        </div>
      </div>

      {/* Social Edit Modal */}
      {showSocialEdit && profile && (
        <SocialEditModal
          profile={profile}
          onClose={() => setShowSocialEdit(false)}
          onSaved={updates => setProfile(p => p ? { ...p, ...updates } : p)}
        />
      )}
    </>
  )
}
