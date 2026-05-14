'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import { useRouter } from 'next/navigation'
import AskDoctorButton from '@/components/medical/AskDoctorButton'
import CoachReviewsBlock from '@/components/profile/CoachReviewsBlock'

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
  // athlete
  primary_sport?: string | null
  fitness_level?: string | null
  goal?: string | null
  height_cm?: number | null
  weight_kg?: number | null
  club?: string | null
  weekly_training_hours?: number | null
  profile_public?: boolean
  // coach/doctor common
  specialization?: string | null
  experience_years?: number | null
  coach_specialization?: string | null
  medical_specialization?: string | null
  workplace?: string | null
  education?: string | null
  sports?: string[] | null
  languages?: string[] | null
  certifications?: unknown
  telegram_url?: string | null
  instagram_url?: string | null
  youtube_url?: string | null
  website_url?: string | null
  whatsapp_url?: string | null
  email_public?: string | null
  // coach
  coaching_philosophy?: string | null
  session_formats?: string[] | null
  achievements?: unknown
  past_workplaces?: unknown
  hourly_rate?: number | null
  athletes_count?: number | null
  accepts_new_athletes?: boolean
  currency?: string | null
  // doctor
  license_number?: string | null
  license_authority?: string | null
  license_expires_at?: string | null
  main_focus?: string | null
  services?: string[] | null
  consultation_formats?: string[] | null
  hospital_affiliations?: string[] | null
  scientific_publications?: unknown
  consultation_fee?: number | null
  accepts_new_patients?: boolean
  emergency_contact?: boolean
  degree?: string | null
  // organization
  org_name?: string | null
  org_slug?: string | null
  org_type?: string | null
  sport_type?: string | null
  description?: string | null
  founded_year?: number | null
  members_count?: number | null
  coaches_count?: number | null
  training_base?: string | null
  license_info?: string | null
  contact_person?: string | null
  address?: string | null
  membership_types?: unknown
}

const SESSION_FORMAT_LABELS: Record<string, string> = {
  offline: 'Очно', online: 'Онлайн', home: 'Выезд',
  group: 'Группа', camp: 'Сборы', async: 'Async-план',
}
const CONSULT_FORMAT_LABELS: Record<string, string> = {
  offline: 'Очно', online: 'Телемедицина',
  home: 'На дому', emergency: 'Экстренно',
}
const SERVICE_LABELS: Record<string, string> = {
  checkup: 'Диспансеризация', cardio_test: 'Нагрузочный тест',
  ecg: 'ЭКГ / Холтер', body_composition: 'Биоимпеданс',
  vo2max: 'VO₂max', blood_panel: 'Биохимия',
  nutrition_plan: 'Питание', injury_rehab: 'Реабилитация',
  sleep_analysis: 'Сон / HRV', psych_support: 'Психология',
}
const ORG_SERVICE_LABELS: Record<string, string> = {
  training: 'Тренировки', competitions: 'Соревнования', camps: 'Сборы',
  individual: 'Персональный', nutrition: 'Питание', medical: 'Медсопровождение',
  recovery: 'Восстановление', rental: 'Аренда площадки',
}
const ORG_TYPE_LABELS: Record<string, string> = {
  club: '🏅 Клуб', federation: '🏛 Федерация', team: '🚴 Команда',
  school: '🎓 Школа', gym: '💪 Фитнес-центр', academy: '📘 Академия', other: 'Другое',
}

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(x => {
    if (typeof x === 'string') return x
    if (typeof x === 'object' && x) {
      const o = x as { text?: string; name?: string }
      return o.text ?? o.name ?? ''
    }
    return ''
  }).filter(Boolean)
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
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              {connectionStatus === 'active' ? (
                <>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '9px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                    background: '#F0FDF4', color: '#16A34A', border: '1.5px solid #BBF7D0',
                  }}>
                    <i className="ki-filled ki-check-circle text-sm" />Связаны
                  </span>
                  {/* W6 Day 28: coach → athlete drawer to ask doctor */}
                  {user && user.role === 'coach' && profile.role === 'athlete' && (
                    <AskDoctorButton
                      athleteId={profile.id}
                      athleteName={displayName}
                    />
                  )}
                </>
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

      {/* Coach — rich profile */}
      {profile.role === 'coach' && <CoachProfile profile={profile} />}
      {profile.role === 'coach' && <CoachReviewsBlock coachId={profile.id} summary={null} />}
      {profile.role === 'doctor' && <DoctorProfile profile={profile} />}
      {profile.role === 'organization' && <OrgProfile profile={profile} />}

      {/* Socials */}
      {(profile.telegram_url || profile.instagram_url || profile.youtube_url || profile.website_url || profile.whatsapp_url) && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '18px 20px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Контакты</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {profile.telegram_url && <SocialLink href={profile.telegram_url} icon="ki-send" label="Telegram" color="#0284C7" />}
            {profile.whatsapp_url && <SocialLink href={profile.whatsapp_url} icon="ki-whatsapp" label="WhatsApp" color="#16A34A" />}
            {profile.instagram_url && <SocialLink href={profile.instagram_url} icon="ki-instagram" label="Instagram" color="#E11D48" />}
            {profile.youtube_url && <SocialLink href={profile.youtube_url} icon="ki-youtube" label="YouTube" color="#DC2626" />}
            {profile.website_url && <SocialLink href={profile.website_url} icon="ki-earth" label="Сайт" color="#0D9488" />}
          </div>
        </div>
      )}

      {profile.role === 'coach' && (profile.accepts_new_athletes === true || profile.hourly_rate != null) && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '18px 20px', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {profile.accepts_new_athletes === true && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 99, background: '#F0FDF4', color: '#16A34A', fontSize: 12, fontWeight: 700, border: '1px solid #BBF7D0' }}>
              <i className="ki-filled ki-check-circle text-xs" /> Принимает новых атлетов
            </span>
          )}
          {profile.hourly_rate != null && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Ставка за час</p>
              <p className="pf-num" style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)' }}>{profile.hourly_rate}<span style={{ fontSize: 12, color: 'var(--muted-foreground)', marginLeft: 6 }}>{profile.currency ?? 'RUB'}</span></p>
            </div>
          )}
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

function SectionCard({ title, color, bg, children }: { title: string; color: string; bg: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '18px 20px' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12, display: 'inline-block', background: bg, padding: '3px 10px', borderRadius: 99 }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  )
}

function ChipRow({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {items.map(t => (
        <span key={t} style={{
          fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 99,
          background: 'var(--accent)', color: 'var(--foreground)', border: '1px solid var(--border)',
        }}>{t}</span>
      ))}
    </div>
  )
}

function FactRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((t, i) => (
        <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--foreground)', lineHeight: 1.5 }}>
          <span style={{ color: '#F97316', fontWeight: 700 }}>•</span><span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

function SocialLink({ href, icon, label, color }: { href: string; icon: string; label: string; color: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px',
      borderRadius: 12, border: `1px solid ${color}33`, background: `${color}0D`,
      color, fontSize: 12, fontWeight: 600, textDecoration: 'none',
    }}>
      <i className={`ki-filled ${icon} text-[12px]`} />{label}
    </a>
  )
}

function CoachProfile({ profile }: { profile: Profile }) {
  const formats = (profile.session_formats ?? []).map(k => SESSION_FORMAT_LABELS[k] ?? k)
  const achievements = asStringList(profile.achievements)
  const pastWork = asStringList(profile.past_workplaces)
  const certs = asStringList(profile.certifications)
  const sports = profile.sports ?? []
  const langs  = profile.languages ?? []
  const hasAny =
    profile.specialization || profile.coach_specialization || profile.experience_years != null ||
    profile.workplace || profile.coaching_philosophy || formats.length ||
    achievements.length || pastWork.length || certs.length || sports.length || langs.length

  if (!hasAny) return null

  return (
    <>
      <SectionCard title="Тренерская деятельность" color="#16A34A" bg="#F0FDF4">
        <FactRow label="Специализация" value={profile.specialization || profile.coach_specialization} />
        <FactRow label="Опыт" value={profile.experience_years ? `${profile.experience_years} лет` : null} />
        <FactRow label="Атлетов под руководством" value={profile.athletes_count} />
        <FactRow label="Место работы" value={profile.workplace} />
        {sports.length > 0 && <div><p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>Виды спорта</p><ChipRow items={sports} /></div>}
        {langs.length > 0 && <div><p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>Языки</p><ChipRow items={langs} /></div>}
      </SectionCard>

      {(profile.coaching_philosophy || formats.length > 0) && (
        <SectionCard title="Методика и форматы" color="#8B5CF6" bg="#F5F3FF">
          {profile.coaching_philosophy && <p style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.6, margin: 0 }}>{profile.coaching_philosophy}</p>}
          {formats.length > 0 && <ChipRow items={formats} />}
        </SectionCard>
      )}

      {achievements.length > 0 && (
        <SectionCard title="Достижения" color="#0D9488" bg="#ECFDF5"><BulletList items={achievements} /></SectionCard>
      )}

      {(certs.length > 0 || profile.education) && (
        <SectionCard title="Образование и сертификаты" color="#2563EB" bg="#EFF6FF">
          {profile.education && <p style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.5, margin: 0 }}>{profile.education}</p>}
          {certs.length > 0 && <BulletList items={certs} />}
        </SectionCard>
      )}

      {pastWork.length > 0 && (
        <SectionCard title="Опыт работы" color="#D97706" bg="#FFFBEB"><BulletList items={pastWork} /></SectionCard>
      )}
    </>
  )
}

function DoctorProfile({ profile }: { profile: Profile }) {
  const services = (profile.services ?? []).map(k => SERVICE_LABELS[k] ?? k)
  const formats  = (profile.consultation_formats ?? []).map(k => CONSULT_FORMAT_LABELS[k] ?? k)
  const affils   = profile.hospital_affiliations ?? []
  const pubs     = asStringList(profile.scientific_publications)
  const certs    = asStringList(profile.certifications)
  const langs    = profile.languages ?? []
  const hasAny =
    profile.medical_specialization || profile.degree || profile.experience_years != null ||
    profile.workplace || profile.main_focus || services.length || formats.length ||
    affils.length || pubs.length || certs.length || langs.length ||
    profile.license_number || profile.license_expires_at || profile.consultation_fee != null

  if (!hasAny) return null

  return (
    <>
      <SectionCard title="Медицинская практика" color="#DC2626" bg="#FEF2F2">
        <FactRow label="Специализация" value={profile.medical_specialization} />
        <FactRow label="Учёная степень" value={profile.degree} />
        <FactRow label="Основной фокус" value={profile.main_focus} />
        <FactRow label="Стаж" value={profile.experience_years ? `${profile.experience_years} лет` : null} />
        <FactRow label="Место работы" value={profile.workplace} />
        <FactRow label="Лицензия" value={profile.license_number ? `№${profile.license_number}${profile.license_authority ? ' · ' + profile.license_authority : ''}` : null} />
        <FactRow label="Действует до" value={profile.license_expires_at} />
        <FactRow label="Стоимость консультации" value={profile.consultation_fee != null ? `${profile.consultation_fee} ${profile.currency ?? 'RUB'}` : null} />
        {profile.emergency_contact && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 99, background: '#FEE2E2', color: '#B91C1C', fontSize: 11, fontWeight: 700, border: '1px solid #FCA5A5', width: 'fit-content' }}>
            <i className="ki-filled ki-bandage text-[11px]" /> Принимает экстренные случаи
          </span>
        )}
        {langs.length > 0 && <div><p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>Языки приёма</p><ChipRow items={langs} /></div>}
      </SectionCard>

      {(services.length > 0 || formats.length > 0) && (
        <SectionCard title="Услуги и форматы" color="#0EA5E9" bg="#E0F2FE">
          {services.length > 0 && <div><p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>Услуги</p><ChipRow items={services} /></div>}
          {formats.length > 0 && <div><p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>Формат приёма</p><ChipRow items={formats} /></div>}
        </SectionCard>
      )}

      {(certs.length > 0 || profile.education) && (
        <SectionCard title="Образование и сертификаты" color="#2563EB" bg="#EFF6FF">
          {profile.education && <p style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.5, margin: 0 }}>{profile.education}</p>}
          {certs.length > 0 && <BulletList items={certs} />}
        </SectionCard>
      )}

      {affils.length > 0 && (
        <SectionCard title="Клинические аффилиации" color="#0D9488" bg="#ECFDF5"><ChipRow items={affils} /></SectionCard>
      )}

      {pubs.length > 0 && (
        <SectionCard title="Научные публикации" color="#8B5CF6" bg="#F5F3FF"><BulletList items={pubs} /></SectionCard>
      )}
    </>
  )
}

function OrgProfile({ profile }: { profile: Profile }) {
  const services = (profile.services ?? []).map(k => ORG_SERVICE_LABELS[k] ?? k)
  const memberships = asStringList(profile.membership_types)
  const langs = profile.languages ?? []
  const typeLabel = profile.org_type ? (ORG_TYPE_LABELS[profile.org_type] ?? profile.org_type) : null
  const hasAny =
    typeLabel || profile.sport_type || profile.founded_year || profile.members_count != null ||
    profile.coaches_count != null || profile.training_base || profile.license_info ||
    profile.contact_person || services.length || memberships.length

  if (!hasAny) return null

  return (
    <>
      <SectionCard title="Об организации" color="#2563EB" bg="#EFF6FF">
        <FactRow label="Тип" value={typeLabel} />
        <FactRow label="Вид спорта" value={profile.sport_type} />
        <FactRow label="Год основания" value={profile.founded_year} />
        <FactRow label="Участников" value={profile.members_count} />
        <FactRow label="Тренеров в штате" value={profile.coaches_count} />
        <FactRow label="Контактное лицо" value={profile.contact_person} />
        {langs.length > 0 && <div><p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>Языки</p><ChipRow items={langs} /></div>}
      </SectionCard>

      {(profile.training_base || profile.license_info || profile.address) && (
        <SectionCard title="Инфраструктура и лицензии" color="#0D9488" bg="#ECFDF5">
          <FactRow label="Адрес" value={profile.address} />
          {profile.training_base && <p style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.5, margin: 0 }}>{profile.training_base}</p>}
          <FactRow label="Лицензия" value={profile.license_info} />
        </SectionCard>
      )}

      {services.length > 0 && (
        <SectionCard title="Услуги" color="#F97316" bg="#FFF7ED"><ChipRow items={services} /></SectionCard>
      )}

      {memberships.length > 0 && (
        <SectionCard title="Тарифы и членство" color="#8B5CF6" bg="#F5F3FF"><BulletList items={memberships} /></SectionCard>
      )}
    </>
  )
}
