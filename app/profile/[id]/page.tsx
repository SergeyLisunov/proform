'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import { useRouter } from 'next/navigation'

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  athlete:      { label: 'Атлет',      color: '#F97316', bg: '#FFF7ED' },
  coach:        { label: 'Тренер',     color: '#16A34A', bg: '#F0FDF4' },
  organization: { label: 'Организация', color: '#2563EB', bg: '#EFF6FF' },
  admin:        { label: 'Админ',      color: '#7C3AED', bg: '#F5F3FF' },
  doctor:       { label: 'Доктор',     color: '#DC2626', bg: '#FEF2F2' },
}

type Profile = {
  id: string
  nickname: string | null
  first_name: string | null
  last_name: string | null
  role: string
  avatar_url: string | null
  sport: string | null
  discipline: string | null
  city: string | null
  country: string | null
  bio: string | null
  coach_specialization: string | null
  experience_years: number | null
  primary_sport: string | null
  fitness_level: string | null
  goal: string | null
  height_cm: number | null
  weight_kg: number | null
  club: string | null
  weekly_training_hours: number | null
  profile_public: boolean
}

function getConnectionType(myRole: string, theirRole: string): string | null {
  // Сортируем пару ролей, чтобы логика была симметричной
  const pair = [myRole, theirRole].sort().join('|')
  const map: Record<string, string> = {
    'athlete|coach':        'coach_athlete',
    'athlete|organization': 'org_athlete',
    'coach|organization':   'org_coach',
    'athlete|doctor':       'doctor_athlete',
    'coach|doctor':         'coach_doctor',
    'doctor|organization':  'org_doctor',
    'admin|doctor':         'admin_doctor',
  }
  return map[pair] ?? null
}

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user } = useUser()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [connectionStatus, setConnectionStatus] = useState('none')
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [isOwn, setIsOwn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    fetch(`/api/users/${id}`)
      .then(r => r.json())
      .then(d => {
        setProfile(d.profile)
        setConnectionStatus(d.connectionStatus)
        setConnectionId(d.connectionId)
        setIsOwn(d.isOwn)
      })
      .finally(() => setLoading(false))
  }, [id])

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleConnect() {
    if (!profile || !user) return
    const connType = getConnectionType(user.role, profile.role)
    if (!connType) return
    setActing(true)
    try {
      const res = await fetch('/api/connections', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: profile.id, connection_type: connType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Ошибка')
      setConnectionStatus('pending')
      setConnectionId(data.connection?.id ?? null)
      showToast('Приглашение отправлено', true)
    } catch (e: any) { showToast(e.message, false) }
    finally { setActing(false) }
  }

  async function handleCancel() {
    if (!connectionId) return
    setActing(true)
    try {
      await fetch(`/api/connections/${connectionId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      setConnectionStatus('none'); setConnectionId(null)
      showToast('Приглашение отозвано', true)
    } catch { showToast('Ошибка', false) }
    finally { setActing(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!profile) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <p className="text-lg font-semibold text-foreground">Профиль не найден</p>
        <Link href="/search" className="mt-4 inline-block text-sm text-orange-500 hover:text-orange-600">← Назад к поиску</Link>
      </div>
    </div>
  )

  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.nickname || 'Пользователь'
  const roleMeta = ROLE_META[profile.role] ?? { label: profile.role, color: '#64748B', bg: '#F8FAFC' }
  const connType = user ? getConnectionType(user.role, profile.role) : null

  return (
    <div className="flex flex-col gap-6 pf-enter" style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>

      {/* Back */}
      <div>
        <button onClick={() => router.back()} style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 10, border: '1.5px solid var(--border)',
          background: 'var(--card)', color: 'var(--muted-foreground)', cursor: 'pointer',
        }}>
          <i className="ki-filled ki-left" style={{ fontSize: 13 }} />
        </button>
      </div>

      {/* Hero card */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 24, padding: '28px 24px',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{
            width: 80, height: 80, borderRadius: 20, flexShrink: 0,
            background: profile.avatar_url ? 'transparent' : `linear-gradient(135deg,${roleMeta.color}40,${roleMeta.color}10)`,
            border: `2px solid ${roleMeta.color}30`, overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 28, fontWeight: 800, color: roleMeta.color }}>{displayName[0]?.toUpperCase()}</span>
            }
          </div>

          {/* Name + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>{displayName}</h1>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                background: roleMeta.bg, color: roleMeta.color, border: `1px solid ${roleMeta.color}22`,
              }}>{roleMeta.label}</span>
            </div>
            {profile.nickname && (
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '3px 0 0' }}>@{profile.nickname}</p>
            )}
            <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
              {(profile.primary_sport || profile.sport) && (
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <i className="ki-filled ki-abstract-26 text-[11px]" />{profile.primary_sport || profile.sport}
                </span>
              )}
              {profile.city && (
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <i className="ki-filled ki-map-marker text-[11px]" />{profile.city}{profile.country ? `, ${profile.country}` : ''}
                </span>
              )}
              {profile.club && (
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <i className="ki-filled ki-people text-[11px]" />{profile.club}
                </span>
              )}
            </div>
          </div>

          {/* Action button */}
          {!isOwn && connType && (
            <div style={{ flexShrink: 0 }}>
              {connectionStatus === 'active' ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  background: '#F0FDF4', color: '#16A34A', border: '1.5px solid #BBF7D0',
                }}>
                  <i className="ki-filled ki-check-circle text-sm" />Связаны
                </span>
              ) : connectionStatus === 'pending' ? (
                <button onClick={handleCancel} disabled={acting} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  background: '#FFF7ED', color: '#F97316', border: '1.5px solid #FED7AA',
                  cursor: 'pointer',
                }}>
                  <i className="ki-filled ki-time text-sm" />Ожидает · Отозвать
                </button>
              ) : (
                <button onClick={handleConnect} disabled={acting} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  background: acting ? 'var(--muted)' : 'linear-gradient(135deg,#F97316,#EA580C)',
                  color: 'white', border: 'none', cursor: acting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 3px 12px rgba(249,115,22,0.3)',
                }}>
                  {acting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Отправка…</>
                    : <><i className="ki-filled ki-user-plus text-sm" />Пригласить</>}
                </button>
              )}
            </div>
          )}
          {isOwn && (
            <Link href="/settings" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
              border: '1.5px solid var(--border)', background: 'var(--card)',
              color: 'var(--foreground)', textDecoration: 'none',
            }}>
              <i className="ki-filled ki-pencil text-sm" />Редактировать
            </Link>
          )}
        </div>

        {/* Bio */}
        {profile.bio && (
          <div style={{ padding: '14px 16px', borderRadius: 14, background: 'var(--accent)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.6, margin: 0 }}>{profile.bio}</p>
          </div>
        )}
      </div>

      {/* Stats grid */}
      {(profile.height_cm || profile.weight_kg || profile.weekly_training_hours || profile.fitness_level) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          {profile.height_cm && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', textAlign: 'center' }}>
              <p className="pf-num" style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>{profile.height_cm}</p>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>см</p>
            </div>
          )}
          {profile.weight_kg && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', textAlign: 'center' }}>
              <p className="pf-num" style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>{profile.weight_kg}</p>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>кг</p>
            </div>
          )}
          {profile.weekly_training_hours && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', textAlign: 'center' }}>
              <p className="pf-num" style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>{profile.weekly_training_hours}</p>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>ч/нед</p>
            </div>
          )}
          {profile.fitness_level && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{profile.fitness_level}</p>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>уровень</p>
            </div>
          )}
        </div>
      )}

      {/* Coach specialization */}
      {profile.role === 'coach' && (profile.coach_specialization || profile.experience_years) && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '18px 20px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Тренерская деятельность</p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {profile.coach_specialization && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ki-filled ki-teacher text-sm text-green-600" />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>Специализация</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>{profile.coach_specialization}</p>
                </div>
              </div>
            )}
            {profile.experience_years && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ki-filled ki-medal-star text-sm text-green-600" />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>Опыт</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>{profile.experience_years} лет</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: '12px 18px', borderRadius: 14,
          background: toast.ok ? '#F0FDF4' : '#FEF2F2',
          border: `1px solid ${toast.ok ? '#BBF7D0' : '#FECACA'}`,
          color: toast.ok ? '#15803D' : '#DC2626',
          fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        }}>
          <i className={`ki-filled ${toast.ok ? 'ki-check-circle' : 'ki-information-5'} text-sm`} />
          {toast.msg}
        </div>
      )}
    </div>
  )
}
