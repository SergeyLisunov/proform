'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import { useToast } from '@/lib/hooks/useToast'
import dynamic from 'next/dynamic'
import type { Workout } from '@/services/workouts.service'
import { recoveryColor } from '@/lib/utils/data'
import { createBrowserClient } from '@supabase/ssr'
import {
  WorkoutAddDrawer,
  WorkoutEditDrawer,
  CalendarEventEditDrawer,
} from '@/components/workout/WorkoutDrawers'
import { Card, ChartCard, Badge } from '@/components/ui/metronic'

const ApexChart    = dynamic(() => import('@/components/charts/ApexChart'), { ssr: false })
const QuickNoteWidget = dynamic(() => import('@/components/ui/QuickNoteWidget'), { ssr: false })
const DoctorDash = dynamic(() => import('./DoctorDashboard'), { ssr: false })
const OrgDash = dynamic(() => import('./OrganizationDashboard'), { ssr: false })
const AiCoachCard          = dynamic(() => import('@/components/widgets/AiCoachCard'),          { ssr: false })
const WeeklyInsightsCard   = dynamic(() => import('@/components/widgets/WeeklyInsightsCard'),   { ssr: false })
const RecoveryTrendWidget  = dynamic(() => import('@/components/widgets/RecoveryTrendWidget'),  { ssr: false })
const CoachBriefingCard    = dynamic(() => import('@/components/widgets/CoachBriefingCard'),    { ssr: false })
const WeeklyPlannerCard    = dynamic(() => import('@/components/widgets/WeeklyPlannerCard'),    { ssr: false })
const AnomalyAlertCard     = dynamic(() => import('@/components/widgets/AnomalyAlertCard'),     { ssr: false })
const TrainingLoadWidget   = dynamic(() => import('@/components/widgets/TrainingLoadWidget'),   { ssr: false })
const WorkoutCommentsDrawer = dynamic(() => import('@/components/workout/WorkoutCommentsDrawer'), { ssr: false })

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const ACTIVITY_CONFIG: Record<string, { icon: string; bg: string; border: string; text: string }> = {
  'Бег':       { icon: 'ki-abstract-26',  bg: '#EFF6FF', border: '#BFDBFE', text: '#2563EB' },
  'Велоспорт': { icon: 'ki-technology-4', bg: '#FFF7ED', border: '#FED7AA', text: '#D44A02' },
  'Плавание':  { icon: 'ki-abstract-14',  bg: '#E0F2FE', border: '#7DD3FC', text: '#0284C7' },
  'Силовые':   { icon: 'ki-abstract-45',  bg: '#FAF5FF', border: '#E9D5FF', text: '#9333EA' },
  'Ходьба':    { icon: 'ki-map',          bg: '#F0FDF4', border: '#BBF7D0', text: '#16A34A' },
  'Другое':    { icon: 'ki-calendar',     bg: '#F8FAFC', border: '#E2E8F0', text: '#64748B' },
}
const DEFAULT_AC = ACTIVITY_CONFIG['Другое']
function getAC(type: string | null) { return ACTIVITY_CONFIG[type ?? ''] ?? DEFAULT_AC }

// ── HERO AVATAR ───────────────────────────────────────────────────────────────
function HeroAvatar({ avatarUrl, name, userId, onAvatarUpdate }: {
  avatarUrl: string | null
  name: string
  userId: string
  onAvatarUpdate?: (url: string) => void
}) {
  const inputRef  = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [localUrl, setLocalUrl]   = useState<string | null>(null)

  const displayUrl = localUrl ?? avatarUrl
  const initials   = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  const handleUpload = async (file: File) => {
    setLocalUrl(URL.createObjectURL(file))
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `${userId}/${Date.now()}.${ext}`
      const { error } = await sb().storage.from('avatars').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = sb().storage.from('avatars').getPublicUrl(path)
      const url = `${publicUrl}?v=${Date.now()}`
      await sb().from('athletes').upsert({ id: userId, avatar_url: url }, { onConflict: 'id' })
      onAvatarUpdate?.(url)
    } catch {
      setLocalUrl(null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className="relative cursor-pointer group shrink-0"
      onClick={() => inputRef.current?.click()}
    >
      {displayUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displayUrl} alt={name}
          className="w-[72px] h-[72px] rounded-full object-cover"
          style={{ border: '3px solid var(--card)' }}
        />
      ) : (
        <div
          className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-white text-2xl font-black pf-num"
          style={{ background: 'linear-gradient(135deg,#F35703,#D44A02)', border: '3px solid var(--card)' }}
        >
          {initials}
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 rounded-full bg-black/45 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        {uploading
          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : <>
              <i className="ki-filled ki-camera text-white text-sm" />
              <span className="text-white text-[9px] font-bold mt-0.5">Изменить</span>
            </>
        }
      </div>

      <input
        ref={inputRef} type="file" className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }}
      />
    </div>
  )
}

// ── SOCIAL ICONS ──────────────────────────────────────────────────────────────
type SocialData = {
  instagram_url: string | null
  telegram_url:  string | null
  youtube_url:   string | null
  tiktok_url:    string | null
}

const SOCIAL_CFG = [
  {
    key: 'instagram_url' as const, label: 'Instagram',
    hoverBg: '#fcedee', hoverColor: '#E1306C',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <rect x="2" y="2" width="20" height="20" rx="5"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    key: 'telegram_url' as const, label: 'Telegram',
    hoverBg: '#e8f4fd', hoverColor: '#0088cc',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
  },
  {
    key: 'youtube_url' as const, label: 'YouTube',
    hoverBg: '#fff0f0', hoverColor: '#FF0000',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
      </svg>
    ),
  },
  {
    key: 'tiktok_url' as const, label: 'TikTok',
    hoverBg: '#f0f0f0', hoverColor: '#111111',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.96a8.22 8.22 0 0 0 4.81 1.54V7.04a4.85 4.85 0 0 1-1.04-.35z"/>
      </svg>
    ),
  },
]

function SocialIcons({ data, onEdit }: { data: SocialData; onEdit: () => void }) {
  const filled = SOCIAL_CFG.filter(s => !!data[s.key])

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      {filled.map(s => (
        <a
          key={s.key}
          href={data[s.key]!}
          target="_blank"
          rel="noopener noreferrer"
          title={s.label}
          style={{
            width: 26, height: 26, borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--accent)', border: '1px solid var(--border)',
            color: '#9CA3AF', textDecoration: 'none', flexShrink: 0,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget
            el.style.background   = s.hoverBg
            el.style.color        = s.hoverColor
            el.style.borderColor  = s.hoverColor + '55'
            el.style.transform    = 'translateY(-1px)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget
            el.style.background   = 'var(--accent)'
            el.style.color        = '#9CA3AF'
            el.style.borderColor  = 'var(--border)'
            el.style.transform    = 'translateY(0)'
          }}
        >
          {s.icon}
        </a>
      ))}

      <button
        onClick={onEdit}
        title={filled.length > 0 ? 'Редактировать соцсети' : 'Добавить соцсети'}
        style={{
          height: 26, borderRadius: 7, padding: '0 8px',
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'transparent', border: '1px dashed #CBD5E1',
          cursor: 'pointer', flexShrink: 0,
          transition: 'all 0.15s', color: '#CBD5E1',
          fontSize: 11, fontWeight: 700,
        }}
        onMouseEnter={e => {
          const b = e.currentTarget
          b.style.borderColor = '#F35703'; b.style.color = '#F35703'; b.style.background = '#FFF7ED'
        }}
        onMouseLeave={e => {
          const b = e.currentTarget
          b.style.borderColor = '#CBD5E1'; b.style.color = '#CBD5E1'; b.style.background = 'transparent'
        }}
      >
        <i className="ki-filled ki-pencil" style={{ fontSize: 9 }} />
        {filled.length > 0 ? 'Изменить' : '+ добавить'}
      </button>
    </div>
  )
}

// ── SOCIAL EDIT MODAL ─────────────────────────────────────────────────────────
function SocialEditModal({ userId, data, onClose, onSaved }: {
  userId: string
  data: SocialData
  onClose: () => void
  onSaved: (d: SocialData) => void
}) {
  const [ig, setIg] = useState(data.instagram_url ?? '')
  const [tg, setTg] = useState(data.telegram_url  ?? '')
  const [yt, setYt] = useState(data.youtube_url   ?? '')
  const [tt, setTt] = useState(data.tiktok_url    ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await sb().from('athletes').upsert(
      { id: userId, instagram_url: ig || null, telegram_url: tg || null, youtube_url: yt || null, tiktok_url: tt || null },
      { onConflict: 'id' }
    )
    onSaved({ instagram_url: ig || null, telegram_url: tg || null, youtube_url: yt || null, tiktok_url: tt || null })
    setSaving(false)
    onClose()
  }

  const fields = [
    { label: 'Instagram', value: ig, set: setIg, placeholder: 'https://instagram.com/username' },
    { label: 'Telegram',  value: tg, set: setTg, placeholder: 'https://t.me/username' },
    { label: 'YouTube',   value: yt, set: setYt, placeholder: 'https://youtube.com/@channel' },
    { label: 'TikTok',    value: tt, set: setTt, placeholder: 'https://tiktok.com/@username' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)' }} />
      <div style={{ position: 'relative', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, width: 400, maxWidth: '95vw', zIndex: 1, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.18)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#F35703', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>Профиль</p>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--foreground)', margin: '3px 0 0' }}>Социальные сети</h3>
          </div>
          <button onClick={onClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
            <i className="ki-filled ki-cross text-sm" />
          </button>
        </div>
        {/* Fields */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {fields.map(f => (
            <div key={f.label}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 5 }}>
                {f.label}
              </label>
              <input
                type="url" value={f.value}
                onChange={e => f.set(e.target.value)}
                placeholder={f.placeholder}
                className="w-full rounded-xl border border-input px-3 py-2.5 text-sm bg-background text-foreground outline-none focus:border-orange-400 transition-colors"
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={save} disabled={saving} className="kt-btn kt-btn-primary flex-1">
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
            <button onClick={onClose} className="kt-btn kt-btn-outline">Отмена</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── UPCOMING EVENT TYPE ───────────────────────────────────────────────────────
type UpcomingEvent = {
  id: string
  title: string
  event_date: string
  start_time: string | null
  activity_type: string | null
}

function fmtPastDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const today     = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const d = new Date(dateStr + 'T00:00:00')
  if (d.getTime() === today.getTime())     return 'Сегодня'
  if (d.getTime() === yesterday.getTime()) return 'Вчера'
  return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })
}

function fmtFutureDate(dateStr: string): string {
  const today    = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const d = new Date(dateStr + 'T00:00:00')
  if (d.getTime() === today.getTime())    return 'Сегодня'
  if (d.getTime() === tomorrow.getTime()) return 'Завтра'
  return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ── TRAINING WIDGET ───────────────────────────────────────────────────────────
function TrainingWidget({
  pastWorkouts, upcomingEvents, loading, onOpenWorkout, onOpenEvent, onPlan, onOpenComments,
}: {
  pastWorkouts: Workout[]
  upcomingEvents: UpcomingEvent[]
  loading: boolean
  onOpenWorkout: (w: Workout) => void
  onOpenEvent:   (ev: UpcomingEvent) => void
  onPlan:        () => void
  onOpenComments: (w: Workout) => void
}) {
  const { success, error } = useToast()
  const [sharing, setSharing] = useState<string | null>(null)

  async function handleShare(w: Workout) {
    if (sharing) return
    setSharing(w.id)
    try {
      const res = await fetch(`/api/workouts/${w.id}/share`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'SHARE_ERROR')
      const url = `${window.location.origin}/share/workout/${json.share.token}`
      try {
        await navigator.clipboard.writeText(url)
        success('Ссылка скопирована')
      } catch {
        window.prompt('Скопируйте ссылку:', url)
      }
    } catch (e) {
      error(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setSharing(null)
    }
  }

  return (
    <div
      className="border border-orange-100 rounded-[20px] overflow-hidden h-full flex flex-col"
      style={{ background: 'linear-gradient(160deg,#FFF7ED 0%,#FFFBF5 50%,#FFFFFF 100%)' }}
    >
      {/* Header — без ссылок и кнопки */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-orange-100/80 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-orange-100">
            <i className="ki-filled ki-abstract-26 text-[14px] text-orange-500" />
          </div>
          <h3 className="text-sm font-bold text-navy-500">Тренировки</h3>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">

          {/* ── Прошедшие ── */}
          <div className="px-5 pt-4 pb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
              Прошедшие
            </span>
          </div>

          {pastWorkouts.length === 0 ? (
            <p className="px-5 pb-3 text-2xs text-muted-foreground">Нет завершённых тренировок</p>
          ) : (
            <div className="divide-y divide-border/50">
              {pastWorkouts.map(w => (
                <div
                  key={w.id}
                  className="group flex items-center gap-3 px-5 py-3 hover:bg-accent/50 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onOpenWorkout(w)}
                    className="flex flex-1 min-w-0 items-center gap-3 bg-transparent text-left cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: getAC(w.activity_type).bg }}>
                      <i className={`ki-filled ${getAC(w.activity_type).icon} text-xs`} style={{ color: getAC(w.activity_type).text }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">
                        {w.name ?? w.activity_type ?? 'Тренировка'}
                      </div>
                      {w.activity_duration_min != null && (
                        <div className="text-2xs text-muted-foreground">{w.activity_duration_min} мин</div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xs font-semibold text-foreground">{fmtPastDate(w.event_date)}</div>
                      {w.activity_strain != null && (
                        <div className="text-2xs text-muted-foreground">strain {w.activity_strain.toFixed(1)}</div>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onOpenComments(w) }}
                    title="Комментарии"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
                  >
                    <i className="ki-filled ki-messages text-[13px]" />
                  </button>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleShare(w) }}
                    disabled={sharing === w.id}
                    title="Поделиться ссылкой"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                  >
                    {sharing === w.id ? (
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-blue-500 border-t-transparent pf-spin" />
                    ) : (
                      <i className="ki-filled ki-share text-[13px]" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Предстоящие ── */}
          <div className="px-5 pt-4 pb-1.5 border-t border-border/40 mt-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
              Предстоящие
            </span>
          </div>

          {upcomingEvents.length === 0 ? (
            <p className="px-5 pb-4 text-2xs text-muted-foreground">
              Нет запланированных тренировок ·{' '}
              <button onClick={onPlan} className="text-orange-500 hover:underline bg-transparent border-0 p-0 font-semibold cursor-pointer">
                Запланировать
              </button>
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {upcomingEvents.map(ev => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onOpenEvent(ev)}
                  className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-accent/50 transition-colors cursor-pointer last:pb-4"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: getAC(ev.activity_type).bg }}>
                    <i className={`ki-filled ${getAC(ev.activity_type).icon} text-xs`} style={{ color: getAC(ev.activity_type).text }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{ev.title}</div>
                    {ev.activity_type && (
                      <div className="text-2xs text-muted-foreground">{ev.activity_type}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xs font-semibold text-foreground">{fmtFutureDate(ev.event_date)}</div>
                    {ev.start_time && (
                      <div className="text-2xs text-muted-foreground">{ev.start_time.slice(0, 5)}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ── QUICK ADD WORKOUT CARD ────────────────────────────────────────────────────
function QuickAddWorkoutCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-[20px] border text-left transition-all hover:shadow-lg"
      style={{
        background: 'linear-gradient(135deg,#FFEDD5 0%,#FFF7ED 55%,#FFFBEB 100%)',
        borderColor: '#FED7AA',
      }}
    >
      {/* Both decorative blobs removed: top-right blob's blur-2xl bled
          orange tint above the actual button border (it had -top-10),
          which made the user perceive the button as "starting higher"
          than it actually rendered → title looked low-of-center.
          With blobs gone, the eye anchors on the actual button rect.
          Plus: leading-none on title compresses the line-box from 24px
          (text-base default 1.5) to 16px (font-size only), so the cap
          height is the dominant vertical metric and centers exactly on
          the icon centers. */}
      <div className="relative flex items-center gap-3 px-4 py-3.5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-md transition-transform group-hover:scale-105"
          style={{ background: 'linear-gradient(135deg,#F35703,#D44A02)' }}
        >
          <i className="ki-filled ki-plus text-white text-lg" />
        </div>
        <span className="min-w-0 flex-1 text-base font-extrabold leading-none text-foreground truncate">
          Добавить тренировку
        </span>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 border border-white/90 shadow-sm transition-transform group-hover:translate-x-1">
          <i className="ki-filled ki-arrow-right text-orange-500 text-base" />
        </div>
      </div>
    </button>
  )
}

// ── ATHLETE PROFILE TYPE ──────────────────────────────────────────────────────
type AthleteProfile = SocialData & {
  avatar_url: string | null
  nickname:   string | null
  weekly_training_hours: number | null
}

// ── ATHLETE DASHBOARD ─────────────────────────────────────────────────────────
function AthleteDash({ userId, name }: { userId: string; name: string }) {
  const [profile, setProfile]               = useState<AthleteProfile | null>(null)
  const [pastWorkouts, setPastWorkouts]     = useState<Workout[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([])
  const [weeklyMinutes, setWeeklyMinutes]   = useState(0)
  const [weeklyCount, setWeeklyCount]       = useState(0)
  const [loading, setLoading]               = useState(true)
  const [showSocialEdit, setShowSocialEdit] = useState(false)
  const [showAddWorkout, setShowAddWorkout] = useState(false)
  const [editWorkout, setEditWorkout]       = useState<Workout | null>(null)
  const [editEvent, setEditEvent]           = useState<UpcomingEvent | null>(null)
  const [commentsFor, setCommentsFor]       = useState<Workout | null>(null)

  const loadWeekly = useCallback(async () => {
    // Неделя: понедельник 00:00 (локальная TZ) … сегодня включительно
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dow = (today.getDay() + 6) % 7 // 0 = понедельник
    const monday = new Date(today)
    monday.setDate(today.getDate() - dow)

    const toLocalISO = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    const mondayStr = toLocalISO(monday)
    const todayStr  = toLocalISO(today)

    // Источник #1 — записи из дневника (workouts)
    const { data: wkData } = await sb()
      .from('workouts')
      .select('id, event_date, start_time, activity_duration_min, name')
      .eq('athlete_id', userId)
      .gte('event_date', mondayStr)
      .lte('event_date', todayStr)

    // Источник #2 — события в календаре, у которых указаны start+end (для старых/"внешних" записей, не продублированных в workouts)
    const { data: evData } = await sb()
      .from('calendar_events')
      .select('id, event_date, start_time, end_time, title, event_type')
      .eq('owner_id', userId)
      .eq('event_type', 'workout')
      .gte('event_date', mondayStr)
      .lte('event_date', todayStr)

    // Нормализуем: для каждого события считаем minutes. Если ни у workout, ни у связанного calendar_event нет
    // явной длительности, но есть start/end в календаре — берём её оттуда.
    type Slot = { key: string; minutes: number }
    const slots = new Map<string, Slot>()

    const keyOf = (date: string | null, title: string | null, start: string | null) =>
      `${date ?? ''}|${(title ?? '').trim().toLowerCase()}|${(start ?? '').slice(0, 5)}`

    for (const w of wkData ?? []) {
      const minutes = Math.max(0, Number(w.activity_duration_min ?? 0) || 0)
      if (minutes <= 0) continue
      const k = keyOf(w.event_date, w.name, w.start_time)
      slots.set(k, { key: k, minutes })
    }

    for (const ev of evData ?? []) {
      if (!ev.start_time || !ev.end_time) continue
      const [sh, sm] = String(ev.start_time).split(':').map(Number)
      const [eh, em] = String(ev.end_time).split(':').map(Number)
      if ([sh, sm, eh, em].some(n => Number.isNaN(n))) continue
      const diff = (eh * 60 + em) - (sh * 60 + sm)
      if (diff <= 0) continue
      const k = keyOf(ev.event_date, ev.title, ev.start_time)
      // Не перетираем — если уже есть по ключу из workouts, оставляем дневник как источник истины
      if (!slots.has(k)) slots.set(k, { key: k, minutes: diff })
    }

    let totalMin = 0
    for (const s of slots.values()) totalMin += s.minutes
    setWeeklyMinutes(totalMin)
    setWeeklyCount(slots.size)
  }, [userId])

  const loadLists = useCallback(async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    const todayStr = `${y}-${m}-${d}`

    const [{ data: pastData }, { data: upcomingData }] = await Promise.all([
      sb().from('workouts')
        .select('*')
        .eq('athlete_id', userId)
        .lt('event_date', todayStr)
        .order('event_date', { ascending: false })
        .limit(2),
      sb().from('calendar_events')
        .select('id, title, event_date, start_time, activity_type')
        .eq('owner_id', userId)
        .gte('event_date', todayStr)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(3),
    ])

    setPastWorkouts((pastData ?? []) as Workout[])
    setUpcomingEvents((upcomingData ?? []) as UpcomingEvent[])
  }, [userId])

  useEffect(() => {
    const handler = () => {
      loadWeekly()
      loadLists()
    }
    window.addEventListener('proform:workout-added', handler)
    return () => window.removeEventListener('proform:workout-added', handler)
  }, [loadWeekly, loadLists])

  // Cmd+K palette → open add-workout drawer
  useEffect(() => {
    const openHandler = () => setShowAddWorkout(true)
    window.addEventListener('proform:open-add-workout', openHandler)
    return () => window.removeEventListener('proform:open-add-workout', openHandler)
  }, [])

  useEffect(() => {
    async function load() {
      const [{ data: userData }, { data: athData }] = await Promise.all([
        sb().from('users').select('nickname').eq('id', userId).single(),
        sb().from('athletes')
          .select('avatar_url, instagram_url, telegram_url, youtube_url, tiktok_url, weekly_training_hours')
          .eq('id', userId).maybeSingle(),
      ])

      setProfile({
        avatar_url:            athData?.avatar_url            ?? null,
        nickname:              userData?.nickname             ?? null,
        instagram_url:         athData?.instagram_url         ?? null,
        telegram_url:          athData?.telegram_url          ?? null,
        youtube_url:           athData?.youtube_url           ?? null,
        tiktok_url:            athData?.tiktok_url            ?? null,
        weekly_training_hours: athData?.weekly_training_hours ?? null,
      })
      await Promise.all([loadLists(), loadWeekly()])
      setLoading(false)
    }
    load()
  }, [userId, loadWeekly, loadLists])

  const targetHours = profile?.weekly_training_hours ?? 0
  const actualHours = weeklyMinutes / 60

  const weekPct = targetHours > 0 ? Math.min(100, Math.round((actualHours / targetHours) * 100)) : 0
  const weekRingColor = weekPct === 0 ? '#9CA3AF' : weekPct < 50 ? '#DC2626' : weekPct < 80 ? '#F35703' : weekPct < 100 ? '#2563EB' : '#16A34A'
  const weekRingBg = weekPct === 0 ? '#F9FAFB' : weekPct < 50 ? '#FFF1F2' : weekPct < 80 ? '#FFF7ED' : weekPct < 100 ? '#EFF6FF' : '#F0FDF4'

  return (
    <div className="flex flex-col gap-6 pf-enter">

      {/* ── Hero ── */}
      <div className="overflow-hidden rounded-[28px] border border-border bg-card shadow-sm">
        {/* Gradient banner */}
        <div style={{
          background: 'linear-gradient(135deg,#FFF7ED 0%,#FFFBF5 60%,#F0F9FF 100%)',
          padding: '28px 32px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div className="flex flex-wrap items-start justify-between gap-6">

            {/* Left: profile */}
            <div className="flex items-center gap-4">
              <HeroAvatar
                avatarUrl={profile?.avatar_url ?? null}
                name={name}
                userId={userId}
                onAvatarUpdate={url => setProfile(p => p ? { ...p, avatar_url: url } : p)}
              />
              <div>
                <p style={{ fontSize:10, fontWeight:800, color:'#F35703', textTransform:'uppercase', letterSpacing:'0.22em', marginBottom:4 }}>
                  Профиль атлета
                </p>
                <h2 className="text-2xl font-extrabold text-navy-500 leading-tight tracking-tight">{name}</h2>
                {profile?.nickname
                  ? <p className="text-sm text-muted-foreground mt-0.5">@{profile.nickname}</p>
                  : <p className="text-xs text-muted-foreground/40 mt-0.5 italic">никнейм не задан</p>
                }
                {profile && <SocialIcons data={profile} onEdit={() => setShowSocialEdit(true)} />}
              </div>
            </div>

            {/* Right: stat chips */}
            <div className="flex flex-wrap items-center gap-3">
              {[
                {
                  label: 'Тренировок\nза неделю',
                  value: String(weeklyCount),
                  icon: 'ki-abstract-26',
                  color: '#F35703',
                  bg: '#FFF7ED',
                },
                {
                  label: 'Часов\nза неделю',
                  value: actualHours > 0
                    ? (actualHours % 1 === 0 ? actualHours.toFixed(0) : actualHours.toFixed(1)) + ' ч'
                    : '0 ч',
                  icon: 'ki-time',
                  color: '#2563EB',
                  bg: '#EFF6FF',
                },
                {
                  label: 'Цель\nна неделю',
                  value: targetHours > 0 ? targetHours + ' ч' : 'Не задана',
                  icon: 'ki-medal-star',
                  color: '#16A34A',
                  bg: '#F0FDF4',
                },
              ].map(s => (
                <div
                  key={s.label}
                  className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl border border-border min-w-[90px] text-center"
                  style={{ background: s.bg + 'cc' }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: s.bg }}
                  >
                    <i className={`ki-filled ${s.icon} text-sm`} style={{ color: s.color }} />
                  </div>
                  <span className="pf-num text-xl font-black text-foreground leading-none">{s.value}</span>
                  <span style={{ fontSize:9, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.08em', lineHeight:1.3, whiteSpace:'pre-line', textAlign:'center' }}>
                    {s.label}
                  </span>
                </div>
              ))}
              {/* Mini progress ring chip */}
              {(() => {
                const size = 52
                const r = 20
                const circ = 2 * Math.PI * r
                const dash = (weekPct / 100) * circ
                return (
                  <div
                    className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl border border-border min-w-[90px] text-center"
                    style={{ background: weekRingBg }}
                  >
                    <div style={{ position: 'relative', width: size, height: size }}>
                      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F2F2F3" strokeWidth={5} />
                        <circle
                          cx={size/2} cy={size/2} r={r} fill="none"
                          stroke={weekRingColor} strokeWidth={5}
                          strokeDasharray={`${dash} ${circ - dash}`}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dasharray .6s ease, stroke .4s' }}
                        />
                      </svg>
                      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <span className="pf-num" style={{ fontSize:11, fontWeight:900, color:weekRingColor, lineHeight:1 }}>{weekPct}%</span>
                      </div>
                    </div>
                    <span style={{ fontSize:9, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.08em', lineHeight:1.3, whiteSpace:'pre-line', textAlign:'center' }}>
                      {'ПРОГРЕСС\nНЕДЕЛИ'}
                    </span>
                  </div>
                )
              })()}
            </div>

          </div>
        </div>
      </div>

      {/* ── Row 1: Training widget (2/3) + [QuickAdd + QuickNote] (1/3) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <TrainingWidget
            pastWorkouts={pastWorkouts}
            upcomingEvents={upcomingEvents}
            loading={loading}
            onOpenWorkout={w => setEditWorkout(w)}
            onOpenEvent={ev => setEditEvent(ev)}
            onPlan={() => setShowAddWorkout(true)}
            onOpenComments={w => setCommentsFor(w)}
          />
        </div>
        <div className="flex flex-col gap-4">
          <QuickAddWorkoutCard onClick={() => setShowAddWorkout(true)} />
          <QuickNoteWidget userId={userId} />
        </div>
      </div>

      {/* ── Row 2: AI insights — AI coach + Weekly insights + Recovery trend ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <AiCoachCard />
        <WeeklyInsightsCard />
        <RecoveryTrendWidget userId={userId} />
      </div>

      {/* ── Row 3: AI weekly planner ── */}
      <WeeklyPlannerCard />

      {/* ── Row 4: Anomaly alerts + Training load ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <AnomalyAlertCard />
        <TrainingLoadWidget userId={userId} />
      </div>

      {/* Social edit modal */}
      {showSocialEdit && profile && (
        <SocialEditModal
          userId={userId}
          data={profile}
          onClose={() => setShowSocialEdit(false)}
          onSaved={d => setProfile(p => p ? { ...p, ...d } : p)}
        />
      )}

      {/* Workout drawers */}
      <WorkoutAddDrawer
        open={showAddWorkout}
        userId={userId}
        onClose={() => setShowAddWorkout(false)}
      />
      <WorkoutEditDrawer
        workout={editWorkout}
        onClose={() => setEditWorkout(null)}
      />
      <CalendarEventEditDrawer
        event={editEvent}
        ownerId={userId}
        onClose={() => setEditEvent(null)}
      />
      <WorkoutCommentsDrawer
        workoutId={commentsFor?.id ?? null}
        workoutTitle={commentsFor?.name ?? commentsFor?.activity_type ?? null}
        currentUserId={userId}
        onClose={() => setCommentsFor(null)}
      />

    </div>
  )
}

// ── COACH DASHBOARD ──────────────────────────────────────────────────────────
type AthleteRow = {
  id: string; name: string; role: string; sport_type: string | null
  recovery_score: number | null; hrv: number | null; workouts_count: number
}

function CoachDash({ userId, name }: { userId: string; name: string }) {
  const [athletes, setAthletes] = useState<AthleteRow[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await sb()
        .from('users')
        .select('id, name, role, sport_type')
        .eq('role', 'athlete')
        .limit(20)
      if (!data) { setLoading(false); return }

      const rows: AthleteRow[] = await Promise.all(
        data.map(async a => {
          const { data: wData } = await sb()
            .from('workouts')
            .select('recovery_score, hrv, id')
            .eq('athlete_id', a.id)
            .order('event_date', { ascending: false })
            .limit(10)
          const lastWithRecovery = (wData ?? []).find(w => w.recovery_score != null)
          const lastWithHRV      = (wData ?? []).find(w => w.hrv != null)
          return {
            id:             a.id,
            name:           a.name,
            role:           a.role,
            sport_type:     a.sport_type,
            recovery_score: lastWithRecovery?.recovery_score ?? null,
            hrv:            lastWithHRV?.hrv ?? null,
            workouts_count: wData?.length ?? 0,
          }
        })
      )
      setAthletes(rows)
      setLoading(false)
    }
    load()
  }, [userId])

  const avgRecovery = athletes.filter(a => a.recovery_score != null).length
    ? Math.round(athletes.reduce((s, a) => s + (a.recovery_score ?? 0), 0) / athletes.filter(a => a.recovery_score != null).length)
    : null
  const alerts = athletes.filter(a => (a.recovery_score ?? 100) < 40).length

  const barOpts = {
    chart: { type: 'bar' as const, toolbar: { show: false }, animations: { enabled: false } },
    plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 6 } },
    colors: ['#F35703'],
    xaxis: {
      categories: athletes.map(a => a.name.split(' ')[0]),
      labels: { style: { fontSize: '11px', colors: '#A1A1AA' } },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: { labels: { style: { fontSize: '11px', colors: '#A1A1AA' } }, max: 100 },
    grid: { borderColor: '#F4F4F5', strokeDashArray: 3 },
    tooltip: { theme: 'light' },
    dataLabels: { enabled: false },
  }

  return (
    <div className="flex flex-col gap-6 pf-enter">
      <div>
        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Тренер</p>
        <h2 className="pf-num text-[36px] text-navy-500 leading-none">
          Привет, {name.split(' ')[0]} 👋
        </h2>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 pf-stagger">
        {[
          { label: 'Атлеты',              value: loading ? '…' : athletes.length.toString(),                                                                icon: 'ki-people',        bg: 'bg-blue-50 text-blue-600' },
          { label: 'Ср. восстановление',  value: loading ? '…' : avgRecovery != null ? `${avgRecovery}%` : '—',                                            icon: 'ki-abstract-26',   bg: 'bg-green-50 text-green-600' },
          { label: 'Тренировок (посл.)',  value: loading ? '…' : athletes.reduce((s, a) => s + a.workouts_count, 0).toString(),                            icon: 'ki-calendar',      bg: 'bg-orange-50 text-orange-500' },
          { label: 'Предупреждения',      value: loading ? '…' : alerts.toString(),                                                                         icon: 'ki-notification',  bg: alerts > 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600' },
        ].map(c => (
          <Card key={c.label} className="p-5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-2sm text-muted-foreground font-medium">{c.label}</span>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.bg}`}>
                <i className={`ki-filled ${c.icon} text-base`} />
              </div>
            </div>
            <span className="pf-num text-4xl text-foreground">{c.value}</span>
          </Card>
        ))}
      </div>

      {/* AI coach morning briefing */}
      <CoachBriefingCard />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-navy-500">Статус атлетов</h3>
            <Link href="/athletes" className="text-2xs font-semibold text-orange-500 hover:text-orange-600">Управление →</Link>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
            </div>
          ) : athletes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <i className="ki-filled ki-people text-2xl text-muted-foreground/30" />
              <p className="text-2sm text-muted-foreground">Атлетов пока нет</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {athletes.map(a => {
                const rc          = recoveryColor(a.recovery_score ?? 0)
                const score       = a.recovery_score
                const status      = score == null ? 'unknown' : score < 40 ? 'warning' : score > 65 ? 'good' : 'ok'
                const statusIcon  = status === 'good' ? 'ki-check-circle' : status === 'warning' ? 'ki-warning-2' : status === 'ok' ? 'ki-information-2' : 'ki-minus-circle'
                const statusColor = status === 'good' ? 'text-green-500' : status === 'warning' ? 'text-orange-500' : 'text-blue-500'
                return (
                  <div key={a.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/50 transition-colors">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold pf-num"
                      style={{ background: rc + '20', color: rc }}
                    >
                      {a.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground">{a.name}</div>
                      <div className="text-2xs text-muted-foreground">{a.sport_type ?? 'Спорт не указан'}</div>
                    </div>
                    <div className="text-right">
                      <div className="pf-num text-lg leading-none" style={{ color: rc }}>
                        {score != null ? `${score}%` : '—'}
                      </div>
                      <div className="text-2xs text-muted-foreground">восстановление</div>
                    </div>
                    {a.hrv != null && (
                      <div className="w-28 hidden sm:block">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-2xs text-muted-foreground">HRV</span>
                          <span className="text-2xs font-bold text-foreground">{a.hrv.toFixed(1)} ms</span>
                        </div>
                        <div className="h-1.5 bg-border rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, a.hrv)}%`, background: rc }} />
                        </div>
                      </div>
                    )}
                    <i className={`ki-filled ${statusIcon} text-base ${statusColor} shrink-0`} />
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <ChartCard title="Восстановление команды">
          {!loading && athletes.length > 0 ? (
            <ApexChart
              type="bar"
              series={[{ name: 'Восстановление %', data: athletes.map(a => a.recovery_score ?? 0) }]}
              options={barOpts}
              height={200}
            />
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-2sm">
              {loading ? 'Загрузка…' : 'Нет данных'}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  )
}

// ── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
function AdminDash({ name }: { name: string }) {
  const [stats, setStats] = useState({ total: 0, athletes: 0, coaches: 0, orgs: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await sb().from('users').select('role')
      if (data) {
        setStats({
          total:    data.length,
          athletes: data.filter(u => u.role === 'athlete').length,
          coaches:  data.filter(u => u.role === 'coach').length,
          orgs:     data.filter(u => u.role === 'organization').length,
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="flex flex-col gap-6 pf-enter">
      <div>
        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Admin View</p>
        <h2 className="pf-num text-[36px] text-navy-500 leading-none">System Overview</h2>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 pf-stagger">
        {[
          { label: 'Всего пользователей', value: loading ? '…' : stats.total.toString(),    icon: 'ki-people',       bg: 'bg-blue-50 text-blue-600' },
          { label: 'Атлеты',             value: loading ? '…' : stats.athletes.toString(),  icon: 'ki-abstract-26',  bg: 'bg-orange-50 text-orange-500' },
          { label: 'Тренеры',            value: loading ? '…' : stats.coaches.toString(),   icon: 'ki-notepad-edit', bg: 'bg-green-50 text-green-600' },
          { label: 'Организации',        value: loading ? '…' : stats.orgs.toString(),      icon: 'ki-office-bag',   bg: 'bg-violet-50 text-violet-600' },
        ].map(c => (
          <Card key={c.label} className="p-5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-2sm text-muted-foreground font-medium">{c.label}</span>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.bg}`}>
                <i className={`ki-filled ${c.icon} text-base`} />
              </div>
            </div>
            <span className="pf-num text-4xl text-foreground">{c.value}</span>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-navy-500">System Health</h3>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Supabase DB',   status: 'Online'  },
            { label: 'Auth Service',  status: 'Healthy' },
            { label: 'Vercel Deploy', status: 'Active'  },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{s.label}</div>
              </div>
              <Badge variant="success" size="sm">{s.status}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-center">
        <Link href="/admin" className="kt-btn kt-btn-primary gap-2">
          <i className="ki-filled ki-setting-2 text-sm" />
          Перейти в Admin Panel
        </Link>
      </div>
    </div>
  )
}

// ── ROOT ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, loading } = useUser()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
          <span className="text-2sm text-muted-foreground">Загрузка…</span>
        </div>
      </div>
    )
  }

  if (!user) return null

  if (user.role === 'doctor') return <DoctorDash userId={user.id} name={user.name} />
  if (user.role === 'organization') return <OrgDash userId={user.id} name={user.name} />
  if (user.role === 'coach') return <CoachDash userId={user.id} name={user.name} />
  if (user.role === 'admin') return <AdminDash name={user.name} />
  return <AthleteDash userId={user.id} name={user.name} />
}
