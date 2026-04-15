'use client'
import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'
import { RecoveryRing } from '@/components/ui/RecoveryRing'
import { ZoneBar } from '@/components/ui/ZoneBar'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { recoveryColor } from '@/lib/utils/data'
const ApexChart = dynamic(() => import('@/components/charts/ApexChart'), { ssr: false })
const QuickNoteWidget = dynamic(() => import('@/components/ui/QuickNoteWidget'), { ssr: false })

const sparkOpts = (color: string) => ({
  chart: { type: 'area' as const, toolbar: { show: false }, sparkline: { enabled: true }, animations: { enabled: false } },
  stroke: { curve: 'smooth' as const, width: 2, colors: [color] },
  fill: { type: 'gradient', gradient: { opacityFrom: 0.15, opacityTo: 0.0 } },
  colors: [color],
  tooltip: { enabled: false },
  dataLabels: { enabled: false },
})

const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type WeeklyGoalProgress = {
  targetHours: number | null
  completedHours: number
  completionPercent: number
  remainingHours: number | null
  workoutCount: number
}

type AthleteGoalRow = {
  weekly_training_hours: number | null
}

type WorkoutDurationRow = {
  activity_duration_min: number | null
  event_date: string
}

function toISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getCurrentWeekRange() {
  const now = new Date()
  const currentDay = now.getDay()
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + diffToMonday)
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  return {
    from: toISODate(weekStart),
    to: toISODate(weekEnd),
  }
}

function roundHours(value: number) {
  return Math.round(value * 10) / 10
}

function formatHours(value: number) {
  const rounded = roundHours(value)
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function Surface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-border bg-card shadow-sm ${className}`}>
      {children}
    </div>
  )
}

function SectionHeader({ eyebrow, title, subtitle, action }: {
  eyebrow: string; title: string; subtitle?: string; action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-2xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
        <h3 className="mt-1 text-base font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function StatCard({ label, value, unit, icon, iconBg, delta, sub, sparkData, sparkColor }: {
  label: string; value: string | number; unit?: string; icon: string; iconBg: string
  delta?: number; sub?: string; sparkData?: number[]; sparkColor?: string
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
          <i className={`ki-filled ${icon} text-base`} />
        </div>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="pf-num text-[clamp(2rem,3vw,2.75rem)] leading-none text-foreground">{value}</span>
        {unit && <span className="mb-0.5 text-sm font-medium text-muted-foreground">{unit}</span>}
        {delta !== undefined && (
          <span className={`ml-auto mb-1 inline-flex items-center rounded-full px-2 py-1 text-[11px] font-bold ${delta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {delta > 0 ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      {sparkData && sparkColor && (
        <div className="-mx-1">
          <ApexChart type="area" series={[{ data: sparkData }]} options={sparkOpts(sparkColor)} height={48} />
        </div>
      )}
      {sub && <p className="text-2xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function SmallSignal({ label, value, hint, icon, tone }: {
  label: string; value: string; hint: string; icon: string; tone: string
}) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
          <p className="mt-1 text-2xs text-muted-foreground">{hint}</p>
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <i className={`ki-filled ${icon} text-sm`} />
        </div>
      </div>
    </div>
  )
}

function ActivityRow({ title, meta, strain, zones, iconBg, icon, accent }: {
  title: string; meta: string; strain: string | number; zones: number[]; iconBg: string; icon: string; accent: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4 transition-colors hover:bg-accent/40">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <i className={`ki-filled ${icon} text-sm ${accent}`} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-foreground">{title}</h4>
            <span className="inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              Записано
            </span>
          </div>
          <p className="mt-1 text-2xs text-muted-foreground">{meta}</p>
          <div className="mt-3">
            <ZoneBar zones={zones} height={26} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="pf-num text-xl leading-none text-foreground">{strain}</div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">нагрузка</div>
        </div>
      </div>
    </div>
  )
}

// ── Connections block ──────────────────────────
type ConnUser = { id: string; nickname: string | null; first_name: string | null; last_name: string | null; role: string }
type Conn = { id: string; status: string; connection_type: string; initiated_at: string; initiator: ConnUser; recipient: ConnUser }

function ConnectionsBlock({ myUserId: myUserIdProp }: { myUserId?: string }) {
  const { user } = useUser()
  const myUserId = myUserIdProp ?? user?.id ?? ''
  const [conns, setConns] = useState<Conn[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    if (!myUserId) return
    fetch('/api/connections?status=all')
      .then(r => r.json())
      .then(d => setConns(d.connections ?? []))
      .finally(() => setLoading(false))
  }, [myUserId])

  const active  = conns.filter(c => c.status === 'active')
  const incoming = conns.filter(c => c.status === 'pending' && c.recipient.id === myUserId)
  const outgoing = conns.filter(c => c.status === 'pending' && c.initiator.id === myUserId)

  async function respond(id: string, action: 'accept' | 'decline') {
    setActing(id)
    try {
      await fetch(`/api/connections/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      setConns(prev => prev.map(c => c.id === id ? { ...c, status: action === 'accept' ? 'active' : 'declined' } : c))
    } finally { setActing(null) }
  }

  function connName(c: Conn, side: 'other') {
    const u = c.initiator.id === myUserId ? c.recipient : c.initiator
    return [u.first_name, u.last_name].filter(Boolean).join(' ') || (u.nickname ? `@${u.nickname}` : 'Пользователь')
  }

  if (loading) return null
  if (!active.length && !incoming.length && !outgoing.length) return null

  return (
    <Surface className="p-5 md:p-6">
      <SectionHeader eyebrow="Связи" title="Мои связи" subtitle=""
        action={<a href="/search" className="text-2xs font-semibold text-orange-500 hover:text-orange-600">Найти людей →</a>}
      />
      <div className="mt-4 space-y-3">
        {incoming.map(c => (
          <div key={c.id} className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50/60 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <i className="ki-filled ki-user-plus text-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{connName(c, 'other')}</p>
              <p className="text-2xs text-muted-foreground">Входящее приглашение</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button disabled={acting === c.id} onClick={() => respond(c.id, 'accept')}
                className="px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-2xs font-semibold transition-all disabled:opacity-60">
                {acting === c.id ? '…' : 'Принять'}
              </button>
              <button disabled={acting === c.id} onClick={() => respond(c.id, 'decline')}
                className="px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted text-2xs font-semibold transition-all disabled:opacity-60">
                Отклонить
              </button>
            </div>
          </div>
        ))}
        {outgoing.map(c => (
          <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <i className="ki-filled ki-time text-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{connName(c, 'other')}</p>
              <p className="text-2xs text-muted-foreground">Ожидает ответа</p>
            </div>
            <span className="text-2xs font-semibold text-orange-500 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">Отправлено</span>
          </div>
        ))}
        {active.map(c => (
          <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <i className="ki-filled ki-check-circle text-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{connName(c, 'other')}</p>
              <p className="text-2xs text-muted-foreground capitalize">{c.connection_type.replace('_', ' → ')}</p>
            </div>
            <span className="text-2xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">Активна</span>
          </div>
        ))}
      </div>
    </Surface>
  )
}

// ── Hero types ─────────────────────────────────────────────────────────────────
type AthleteHeroProfile = {
  displayName: string
  nickname: string | null
  bio: string | null
  club: string | null
  city: string | null
  sport: string | null
  avatar_url: string | null
  instagram_url: string | null
  telegram_url: string | null
  youtube_url: string | null
  tiktok_url: string | null
  website_url: string | null
}

type RecentWorkout = {
  id: string
  event_date: string
  activity_type: string | null
  activity_duration_min: number | null
  name: string | null
}

// ── Social Links ────────────────────────────────────────────────────────────────
const SOCIALS: { key: keyof AthleteHeroProfile; label: string; icon: string }[] = [
  { key: 'instagram_url', label: 'Instagram', icon: 'ki-instagram' },
  { key: 'telegram_url',  label: 'Telegram',  icon: 'ki-send' },
  { key: 'youtube_url',   label: 'YouTube',   icon: 'ki-youtube' },
  { key: 'tiktok_url',    label: 'TikTok',    icon: 'ki-abstract-14' },
  { key: 'website_url',   label: 'Сайт',      icon: 'ki-global' },
]

function SocialLinks({ profile }: { profile: AthleteHeroProfile }) {
  const visible = SOCIALS.filter(s => !!profile[s.key])
  if (!visible.length) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {visible.map(s => (
        <a key={s.key} href={profile[s.key] as string} target="_blank" rel="noopener noreferrer"
           title={s.label}
           className="flex h-8 w-8 items-center justify-center rounded-lg border border-border
                      bg-background/70 text-muted-foreground transition-all
                      hover:border-orange-200 hover:bg-orange-50 hover:text-orange-500
                      hover:scale-105 active:scale-95">
          <i className={`ki-filled ${s.icon} text-sm`} />
        </a>
      ))}
    </div>
  )
}

// ── Avatar ──────────────────────────────────────────────────────────────────────
function HeroAvatar({ avatar_url, name, onClick }: { avatar_url: string | null; name: string; onClick: () => void }) {
  const initials = name.split(' ').map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase() || '?'
  const colors = ['#f97316','#2563eb','#16a34a','#9333ea','#0284c7','#dc2626']
  const color = colors[(name.charCodeAt(0) ?? 0) % colors.length]
  return (
    <div onClick={onClick}
         className="relative group cursor-pointer shrink-0"
         style={{ width: 72, height: 72 }}>
      {avatar_url ? (
        <Image src={avatar_url} alt={name} fill className="rounded-full object-cover"
               sizes="72px" unoptimized={avatar_url.includes('supabase')} />
      ) : (
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: `linear-gradient(135deg,${color}30,${color}60)`,
                      border: `1.5px solid ${color}30`, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 24, fontWeight: 800, color }}>
          {initials}
        </div>
      )}
      <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100
                      transition-opacity flex items-center justify-center">
        <i className="ki-filled ki-pencil text-white text-sm" />
      </div>
    </div>
  )
}

// ── Add Workout Modal ───────────────────────────────────────────────────────────
const ACTIVITY_TYPES = ['Бег','Велоспорт','Плавание','Силовые','Ходьба','Триатлон','Другое']

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function AddWorkoutModal({ athleteId, onClose, onSaved }: {
  athleteId: string
  onClose: () => void
  onSaved: (w: RecentWorkout, durationMin: number, date: string) => void
}) {
  const [date, setDate]         = useState(todayStr())
  const [type, setType]         = useState('Бег')
  const [duration, setDuration] = useState('')
  const [wname, setWname]       = useState('')
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')
  const firstRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setTimeout(() => firstRef.current?.focus(), 120) }, [])

  async function submit() {
    setErr('')
    const dur = parseInt(duration)
    if (!date) return setErr('Укажите дату')
    if (!type) return setErr('Выберите вид активности')
    if (!dur || dur < 1 || dur > 1440) return setErr('Длительность: от 1 до 1440 минут')
    setSaving(true)
    const sb = createClient()
    const { data, error } = await sb.from('workouts').insert({
      athlete_id: athleteId,
      event_date: date,
      event_type: 'workout',
      activity_type: type,
      activity_duration_min: dur,
      name: wname.trim() || null,
      description: notes.trim() || null,
    }).select('id, event_date, activity_type, activity_duration_min, name').single()
    setSaving(false)
    if (error || !data) return setErr('Ошибка сохранения. Попробуйте ещё раз.')
    onSaved(data as RecentWorkout, dur, date)
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(15,23,42,0.7)', backdropFilter:'blur(8px)' }} />
      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:440, background:'var(--card)',
                    borderRadius:24, overflow:'hidden', border:'1px solid var(--border)',
                    boxShadow:'0 40px 100px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div style={{ padding:'20px 24px 16px', background:'linear-gradient(135deg,rgba(249,115,22,0.06),transparent)', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <p style={{ fontSize:10, fontWeight:700, color:'#f97316', textTransform:'uppercase', letterSpacing:'0.12em', margin:0 }}>Тренировка</p>
              <h3 style={{ fontSize:18, fontWeight:800, color:'var(--foreground)', margin:'2px 0 0', letterSpacing:'-0.02em' }}>Добавить тренировку</h3>
            </div>
            <button onClick={onClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
              <i className="ki-filled ki-cross text-sm" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div style={{ padding:'18px 24px', display:'flex', flexDirection:'column', gap:14 }}>
          {/* Date + Type */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>Дата</label>
              <input ref={firstRef} type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid var(--border)',
                         background:'var(--background)', color:'var(--foreground)', fontSize:13, outline:'none', boxSizing:'border-box' }}
                onFocus={e => e.currentTarget.style.borderColor='#f97316'}
                onBlur={e => e.currentTarget.style.borderColor='var(--border)'}
              />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>Активность</label>
              <select value={type} onChange={e => setType(e.target.value)}
                style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid var(--border)',
                         background:'var(--background)', color:'var(--foreground)', fontSize:13, outline:'none', boxSizing:'border-box', cursor:'pointer' }}
                onFocus={e => e.currentTarget.style.borderColor='#f97316'}
                onBlur={e => e.currentTarget.style.borderColor='var(--border)'}
              >
                {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>
              Длительность (минуты)
            </label>
            <input type="number" min={1} max={1440} value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="60"
              style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid var(--border)',
                       background:'var(--background)', color:'var(--foreground)', fontSize:13, outline:'none', boxSizing:'border-box' }}
              onFocus={e => e.currentTarget.style.borderColor='#f97316'}
              onBlur={e => e.currentTarget.style.borderColor='var(--border)'}
              onKeyDown={e => e.key === 'Enter' && submit()}
            />
          </div>

          {/* Name */}
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>
              Название <span style={{ fontWeight:400, textTransform:'none' }}>(необязательно)</span>
            </label>
            <input type="text" value={wname} onChange={e => setWname(e.target.value)}
              placeholder="Утренняя пробежка"
              style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid var(--border)',
                       background:'var(--background)', color:'var(--foreground)', fontSize:13, outline:'none', boxSizing:'border-box' }}
              onFocus={e => e.currentTarget.style.borderColor='#f97316'}
              onBlur={e => e.currentTarget.style.borderColor='var(--border)'}
            />
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--muted-foreground)', textTransform:'uppercase', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>
              Заметка <span style={{ fontWeight:400, textTransform:'none' }}>(необязательно)</span>
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Самочувствие, условия, цели…"
              rows={2}
              style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid var(--border)',
                       background:'var(--background)', color:'var(--foreground)', fontSize:13, outline:'none',
                       boxSizing:'border-box', resize:'none', fontFamily:'inherit', lineHeight:1.5 }}
              onFocus={e => e.currentTarget.style.borderColor='#f97316'}
              onBlur={e => e.currentTarget.style.borderColor='var(--border)'}
            />
          </div>

          {err && (
            <div style={{ padding:'9px 12px', borderRadius:10, background:'#FEF2F2', border:'1px solid #FCA5A5', color:'#DC2626', fontSize:12, fontWeight:600 }}>
              {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'0 24px 20px', display:'flex', gap:10 }}>
          <button onClick={submit} disabled={saving}
            style={{ flex:1, padding:'12px', borderRadius:14, border:'none',
                     background: saving ? 'var(--accent)' : 'linear-gradient(135deg,#f97316,#ea580c)',
                     color: saving ? 'var(--muted-foreground)' : 'white',
                     fontWeight:700, fontSize:14, cursor: saving ? 'not-allowed' : 'pointer',
                     display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                     boxShadow: saving ? 'none' : '0 4px 16px rgba(249,115,22,0.35)',
                     transition:'all 0.15s' }}>
            {saving
              ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />Сохраняем…</>
              : <><i className="ki-filled ki-plus text-sm" />Добавить</>
            }
          </button>
          <button onClick={onClose}
            style={{ padding:'12px 18px', borderRadius:14, border:'1.5px solid var(--border)',
                     background:'transparent', color:'var(--muted-foreground)',
                     fontSize:14, fontWeight:600, cursor:'pointer' }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
function AthleteDash({ name, userId }: { name: string; userId: string }) {
  const router = useRouter()

  // ── Hero profile ──
  const [hero, setHero]             = useState<AthleteHeroProfile | null>(null)
  const [heroLoading, setHeroLoading] = useState(true)

  // ── Weekly goal ──
  const [weeklyGoal, setWeeklyGoal] = useState<WeeklyGoalProgress>({
    targetHours: null, completedHours: 0,
    completionPercent: 0, remainingHours: null, workoutCount: 0,
  })
  const [weeklyGoalLoading, setWeeklyGoalLoading] = useState(true)

  // ── Recent workouts ──
  const [recentWorkouts, setRecentWorkouts] = useState<RecentWorkout[]>([])
  const [workoutsLoading, setWorkoutsLoading] = useState(true)

  // ── Modal ──
  const [showAddWorkout, setShowAddWorkout] = useState(false)

  // ── Load hero profile ──
  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('users').select('nickname,first_name,last_name,bio,avatar_url,sport,city').eq('id', userId).single(),
      sb.from('athletes').select('bio,club,city,primary_sport,instagram_url,telegram_url,youtube_url,tiktok_url,website_url').eq('id', userId).maybeSingle(),
    ]).then(([{ data: u }, { data: a }]) => {
      const firstName = u?.first_name ?? null
      const lastName  = u?.last_name  ?? null
      const displayName = [firstName, lastName].filter(Boolean).join(' ') || name
      setHero({
        displayName,
        nickname:      u?.nickname ?? null,
        bio:           a?.bio || u?.bio || null,
        club:          a?.club ?? null,
        city:          a?.city || u?.city || null,
        sport:         a?.primary_sport || u?.sport || null,
        avatar_url:    u?.avatar_url ?? null,
        instagram_url: a?.instagram_url ?? null,
        telegram_url:  a?.telegram_url  ?? null,
        youtube_url:   a?.youtube_url   ?? null,
        tiktok_url:    a?.tiktok_url    ?? null,
        website_url:   a?.website_url   ?? null,
      })
      setHeroLoading(false)
    })
  }, [userId, name])

  // ── Load weekly goal + recent workouts ──
  useEffect(() => {
    let cancelled = false
    const sb = createClient()
    const { from, to } = getCurrentWeekRange()

    Promise.all([
      sb.from('athletes').select('weekly_training_hours').eq('id', userId).maybeSingle(),
      sb.from('workouts').select('activity_duration_min,event_date').eq('athlete_id', userId).gte('event_date', from).lte('event_date', to),
      sb.from('workouts').select('id,event_date,activity_type,activity_duration_min,name').eq('athlete_id', userId).order('event_date', { ascending: false }).limit(5),
    ]).then(([{ data: athleteData }, { data: weekWorkouts }, { data: recent }]) => {
      if (cancelled) return
      const targetHoursRaw = (athleteData as AthleteGoalRow | null)?.weekly_training_hours
      const targetHours = typeof targetHoursRaw === 'number' && targetHoursRaw > 0 ? roundHours(targetHoursRaw) : null
      const completedMinutes = (weekWorkouts ?? []).reduce((s, w) => s + (typeof (w as WorkoutDurationRow).activity_duration_min === 'number' ? (w as WorkoutDurationRow).activity_duration_min! : 0), 0)
      const completedHours = roundHours(completedMinutes / 60)
      const completionPercent = targetHours ? Math.max(0, Math.min(100, Math.round((completedHours / targetHours) * 100))) : 0
      setWeeklyGoal({ targetHours, completedHours, completionPercent, remainingHours: targetHours ? roundHours(Math.max(targetHours - completedHours, 0)) : null, workoutCount: (weekWorkouts ?? []).length })
      setWeeklyGoalLoading(false)
      setRecentWorkouts((recent ?? []) as RecentWorkout[])
      setWorkoutsLoading(false)
    })
    return () => { cancelled = true }
  }, [userId])

  // ── After adding workout ──
  const handleWorkoutAdded = useCallback((w: RecentWorkout, durationMin: number, date: string) => {
    setShowAddWorkout(false)
    setRecentWorkouts(prev => [w, ...prev.slice(0, 4)])
    const { from, to } = getCurrentWeekRange()
    if (date >= from && date <= to) {
      setWeeklyGoal(prev => {
        const newCompleted = roundHours(prev.completedHours + durationMin / 60)
        const newPercent   = prev.targetHours ? Math.min(100, Math.round((newCompleted / prev.targetHours) * 100)) : 0
        return {
          ...prev,
          completedHours:   newCompleted,
          completionPercent: newPercent,
          remainingHours:   prev.targetHours ? roundHours(Math.max(0, prev.targetHours - newCompleted)) : null,
          workoutCount:     prev.workoutCount + 1,
        }
      })
    }
  }, [])

  const weeklyRingLabel = !weeklyGoal.targetHours ? 'Цель не задана'
    : weeklyGoal.completionPercent >= 100 ? 'План закрыт'
    : weeklyGoal.completionPercent >= 65  ? 'В процессе'
    : weeklyGoal.completedHours > 0       ? 'Есть прогресс'
    : 'Старт недели'

  const weeklyGoalTitle = weeklyGoalLoading ? '…'
    : weeklyGoal.targetHours ? `${formatHours(weeklyGoal.completedHours)} / ${formatHours(weeklyGoal.targetHours)} ч`
    : 'Цель не задана'

  const weeklyGoalHint = weeklyGoalLoading ? 'Загружаем данные недели…'
    : weeklyGoal.targetHours
      ? weeklyGoal.remainingHours && weeklyGoal.remainingHours > 0
        ? `Осталось ${formatHours(weeklyGoal.remainingHours)} ч`
        : 'Недельный план выполнен!'
      : 'Задайте цель в настройках спорта'

  return (
    <div className="flex flex-col gap-4 pf-enter">

      {/* ── PROFILE HEADER ── */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm p-4 md:p-5">
        <div className="flex items-start gap-4">
          {heroLoading ? (
            <div className="shrink-0 w-[72px] h-[72px] rounded-full bg-accent animate-pulse" />
          ) : (
            <HeroAvatar
              avatar_url={hero?.avatar_url ?? null}
              name={hero?.displayName ?? name}
              onClick={() => router.push('/settings')}
            />
          )}
          <div className="min-w-0 flex-1">
            {heroLoading ? (
              <div className="space-y-2">
                <div className="h-6 w-40 rounded-lg bg-accent animate-pulse" />
                <div className="h-4 w-24 rounded-lg bg-accent animate-pulse" />
                <div className="h-4 w-56 rounded-lg bg-accent animate-pulse" />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground leading-tight">
                    {hero?.displayName ?? name}
                  </h2>
                  {hero?.nickname && (
                    <Link href={`/profile/${userId}`}
                      className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors">
                      @{hero.nickname}
                    </Link>
                  )}
                </div>
                {hero?.bio && (
                  <p className="mt-1.5 text-sm leading-5 text-muted-foreground line-clamp-1 max-w-lg">
                    {hero.bio}
                  </p>
                )}
                {(hero?.sport || hero?.club || hero?.city) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {hero?.sport && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        🏃 {hero.sport}
                      </span>
                    )}
                    {hero?.club && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        <i className="ki-filled ki-people text-[10px]" /> {hero.club}
                      </span>
                    )}
                    {hero?.city && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        <i className="ki-filled ki-geolocation text-[10px]" /> {hero.city}
                      </span>
                    )}
                  </div>
                )}
                {hero && <SocialLinks profile={hero} />}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── DASHBOARD GRID ── */}
      {/*
        Desktop (xl, 3-col):  [Weekly Plan 2/3] [Add Workout 1/3]
                               [Recent Workouts 2/3] [Quick Note 1/3]
                               [Connections full]
        Tablet  (sm, 2-col):  [Weekly Plan full]
                               [Add Workout 1/2] [Quick Note 1/2]
                               [Recent Workouts full]
                               [Connections full]
        Mobile  (1-col):      stacked
      */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">

        {/* ── CARD 1: WEEKLY PLAN — xl col1-2 row1 ── */}
        <div className="rounded-2xl border border-border bg-card shadow-sm p-4 md:p-5
                        sm:col-span-2 xl:col-span-2 xl:col-start-1 xl:row-start-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">План недели</p>
            <a href="/calendar" className="text-[11px] font-semibold text-orange-500 hover:text-orange-600 transition-colors">
              Открыть →
            </a>
          </div>
          <div className="flex items-center gap-4">
            <RecoveryRing score={weeklyGoal.completionPercent} size={80} label={weeklyRingLabel} />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold text-foreground leading-tight">{weeklyGoalTitle}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{weeklyGoalHint}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border bg-background/70 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Осталось</div>
                  <div className="mt-0.5 text-sm font-semibold text-foreground">
                    {weeklyGoal.targetHours ? `${formatHours(weeklyGoal.remainingHours ?? 0)} ч` : '—'}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-background/70 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Тренировок</div>
                  <div className="mt-0.5 text-sm font-semibold text-foreground">
                    {weeklyGoalLoading ? '…' : weeklyGoal.workoutCount}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {weeklyGoal.targetHours && (
            <div className="mt-4">
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${weeklyGoal.completionPercent}%`,
                    background: weeklyGoal.completionPercent >= 100
                      ? '#16a34a'
                      : weeklyGoal.completionPercent >= 65
                      ? '#f97316'
                      : '#3b82f6',
                  }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">0 ч</span>
                <span className="text-[10px] font-semibold text-foreground">{weeklyGoal.completionPercent}%</span>
                <span className="text-[10px] text-muted-foreground">{formatHours(weeklyGoal.targetHours)} ч</span>
              </div>
            </div>
          )}
        </div>

        {/* ── CARD 2: ADD WORKOUT CTA — xl col3 row1 ── */}
        <div
          className="relative rounded-2xl border border-orange-200 overflow-hidden cursor-pointer
                     group transition-all hover:shadow-md hover:border-orange-300
                     xl:col-start-3 xl:row-start-1 min-h-[200px] flex flex-col"
          style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 60%, #fed7aa 100%)' }}
          onClick={() => setShowAddWorkout(true)}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setShowAddWorkout(true)}
          aria-label="Добавить тренировку"
        >
          <div className="relative z-10 p-4 md:p-5 flex flex-col justify-between flex-1">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-600/70">Тренировка</p>
              <h3 className="mt-2 text-xl font-semibold text-orange-900 leading-tight">
                Добавить<br />тренировку
              </h3>
              <p className="mt-1.5 text-xs text-orange-700/70">Запишите активность прямо сейчас</p>
            </div>
            <div className="flex items-center justify-between mt-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl
                              bg-orange-500 shadow-lg shadow-orange-500/30
                              group-hover:scale-105 transition-transform">
                <i className="ki-filled ki-plus text-white text-lg" />
              </div>
              <span className="text-[11px] font-semibold text-orange-700">Добавить →</span>
            </div>
          </div>
          <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-orange-300/25 pointer-events-none" />
          <div className="absolute right-4 -top-4 w-16 h-16 rounded-full bg-orange-200/20 pointer-events-none" />
        </div>

        {/* ── CARD 3: RECENT WORKOUTS — xl col1-2 row2 ── */}
        <div className="rounded-2xl border border-border bg-card shadow-sm p-4 md:p-5
                        sm:col-span-2 xl:col-span-2 xl:col-start-1 xl:row-start-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Активность</p>
            <a href="/diary" className="text-[11px] font-semibold text-orange-500 hover:text-orange-600 transition-colors">
              Открыть все →
            </a>
          </div>
          {workoutsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-accent/50 animate-pulse" />
              ))}
            </div>
          ) : recentWorkouts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                <i className="ki-filled ki-abstract-26 text-base" />
              </div>
              <p className="text-sm font-semibold text-foreground">Тренировок пока нет</p>
              <p className="mt-1 text-xs text-muted-foreground">Добавьте первую тренировку</p>
              <button onClick={() => setShowAddWorkout(true)} className="kt-btn kt-btn-primary mt-3 gap-1.5">
                <i className="ki-filled ki-plus text-sm" />
                Добавить первую
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentWorkouts.slice(0, 4).map(w => (
                <div
                  key={w.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background/70
                             px-3 py-2.5 transition-colors hover:bg-accent/40 cursor-pointer"
                  onClick={() => router.push('/diary')}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50">
                    <i className="ki-filled ki-abstract-26 text-xs text-orange-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {w.name || w.activity_type || 'Тренировка'}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {w.activity_type}{w.activity_duration_min ? ` · ${w.activity_duration_min} мин` : ''} · {w.event_date}
                    </div>
                  </div>
                  {w.activity_duration_min && (
                    <div className="shrink-0 pf-num text-sm font-semibold text-foreground">
                      {w.activity_duration_min < 60
                        ? `${w.activity_duration_min}м`
                        : `${Math.floor(w.activity_duration_min / 60)}ч${w.activity_duration_min % 60 ? `${w.activity_duration_min % 60}м` : ''}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── CARD 4: QUICK NOTE — xl col3 row2 ── */}
        <div className="xl:col-start-3 xl:row-start-2">
          <QuickNoteWidget userId={userId} />
        </div>

        {/* ── CARD 5: CONNECTIONS — full width row3 (conditional) ── */}
        <div className="sm:col-span-2 xl:col-span-3 xl:row-start-3">
          <ConnectionsBlock myUserId={userId} />
        </div>

      </div>

      {showAddWorkout && (
        <AddWorkoutModal
          athleteId={userId}
          onClose={() => setShowAddWorkout(false)}
          onSaved={handleWorkoutAdded}
        />
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
function CoachDash({ name }: { name: string }) {
  const firstName = name.split(' ')[0]
  const athletes = [
    { name: 'Sara Kowalski', sport: 'Бег', recovery: 42, hrv: 47.2, status: 'warning' },
    { name: 'Marcus Weiden', sport: 'Велоспорт', recovery: 82, hrv: 62.2, status: 'good' },
    { name: 'James Thornton', sport: 'Плавание', recovery: 63, hrv: 32.0, status: 'ok' },
    { name: 'Linh Nguyen', sport: 'Силовая подготовка', recovery: 80, hrv: 106.5, status: 'good' },
  ]
  const watchlist = athletes.filter(a => a.recovery < 70)

  return (
    <div className="flex flex-col gap-6 pf-enter">
      <Surface className="p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-green-700">
            Представление тренера
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Пульс команды
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            4 атлета в ротации
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Пульт тренера</p>
            <h2 className="mt-2 text-[clamp(2rem,4vw,2.75rem)] font-semibold tracking-tight text-foreground">
              С возвращением, {firstName}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Команда в целом держится стабильно, но одному атлету все еще нужен более жесткий контроль нагрузки. Сегодня лучше управлять объемом, а не догонять его.
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-border bg-background/70 px-4 py-3">
            <RecoveryRing score={67} size={96} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Готовность команды</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">67%</p>
              <p className="mt-1 text-xs text-muted-foreground">Используйте это как базовый ориентир для сегодняшних сессий.</p>
            </div>
          </div>
        </div>

      </Surface>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Surface className="p-5 md:p-6">
          <SectionHeader
            eyebrow="Состав"
            title="Статус атлетов"
            subtitle="Так список команды читается с первого взгляда: сначала готовность, потом ВСР, затем статус."
            action={(
              <a href="/athletes" className="text-2xs font-semibold text-orange-500 transition-colors hover:text-orange-600">
                Управлять →
              </a>
            )}
          />
          <div className="mt-4 space-y-3">
            {athletes.map(a => {
              const rc = recoveryColor(a.recovery)
              const statusIcon = a.status === 'good' ? 'ki-check-circle' : a.status === 'warning' ? 'ki-warning-2' : 'ki-information-2'
              const statusColor = a.status === 'good' ? 'text-green-500' : a.status === 'warning' ? 'text-orange-500' : 'text-blue-500'
              return (
                <div key={a.name} className="rounded-2xl border border-border bg-background/70 p-4 transition-colors hover:bg-accent/40">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold pf-num" style={{ background: rc + '20', color: rc }}>
                      {a.name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-foreground">{a.name}</div>
                        <span className="inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          {a.sport}
                        </span>
                      </div>
                      <div className="mt-1 text-2xs text-muted-foreground">ВСР {a.hrv} ms · готовность ведет решение</div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, a.hrv)}%`, background: rc }} />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="pf-num text-xl leading-none" style={{ color: rc }}>{a.recovery}%</div>
                      <i className={`ki-filled ${statusIcon} text-base ${statusColor}`} />
                    </div>
                    <div className="text-right">
                      <div className="pf-num text-lg leading-none" style={{ color: rc }}>
                        {a.recovery != null ? `${a.recovery}%` : '—'}
                      </div>
                      <div className="text-2xs text-muted-foreground">восстановление</div>
                    </div>
                    {a.hrv != null && (
                      <div className="w-28 hidden sm:block">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-2xs text-muted-foreground">ВСР</span>
                          <span className="text-2xs font-bold text-foreground">{a.hrv.toFixed(1)} мс</span>
                        </div>
                        <div className="h-1.5 bg-border rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, a.hrv)}%`, background: rc }} />
                        </div>
                      </div>
                    )}
                    <i className={`ki-filled ${statusIcon} text-base ${statusColor} shrink-0`} />
                  </div>
                </div>
              )
            })}
          </div>
        </Surface>

        <div className="grid gap-4">
          <Surface className="p-5 md:p-6">
            <SectionHeader
              eyebrow="Лист контроля"
              title="Атлеты для корректировки"
              subtitle={`${watchlist.length} атл. находятся ниже предпочтительного коридора готовности.`}
            />
            <div className="mt-4 space-y-3">
              {watchlist.map(a => {
                const rc = recoveryColor(a.recovery)
                return (
                  <div key={a.name} className="rounded-xl border border-border bg-background/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground">{a.name}</div>
                        <div className="mt-1 text-2xs text-muted-foreground">{a.sport} · HRV {a.hrv} ms</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="pf-num text-lg leading-none" style={{ color: rc }}>{a.recovery}%</div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">готовность</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Surface>
        </div>
      </div>

      <ConnectionsBlock />
    </div>
  )
}

// ── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
function AdminDash({ name }: { name: string }) {
  const firstName = name.split(' ')[0]

  return (
    <div className="flex flex-col gap-6 pf-enter">
      <Surface className="p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700">
            Представление администратора
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Обзор системы
          </span>
        </div>
        <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Пульт контроля</p>
            <h2 className="mt-2 text-[clamp(2rem,4vw,2.75rem)] font-semibold tracking-tight text-foreground">
              С возвращением, {firstName}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Система здорова, число пользователей стабильно, а данные платформы выглядят актуальными. Держите в фокусе доступность сервисов и новые регистрации.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Текущее состояние</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">Работает штатно</p>
            <p className="mt-1 text-xs text-muted-foreground">Во всем demo-контуре не видно сбоев.</p>
          </div>
        </div>
      </Surface>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Surface className="p-5 md:p-6">
          <SectionHeader
            eyebrow="Статус"
            title="Здоровье системы"
            subtitle="Короткий и понятный статус-блок для самых важных сервисов платформы."
          />
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: 'Supabase DB', status: 'Онлайн', color: 'bg-green-500', badge: 'bg-green-50 text-green-700 border-green-200' },
              { label: 'Синхронизация WHOOP', status: 'Активно', color: 'bg-green-500', badge: 'bg-green-50 text-green-700 border-green-200' },
              { label: 'Сервис авторизации', status: 'Стабильно', color: 'bg-green-500', badge: 'bg-green-50 text-green-700 border-green-200' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
                <span className={`h-2 w-2 shrink-0 rounded-full ${s.color}`} />
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">{s.label}</div>
                </div>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-semibold ${s.badge}`}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </Surface>

        <Surface className="p-5 md:p-6">
          <SectionHeader
            eyebrow="Операции"
            title="Недавние действия администратора"
            subtitle="Операционный след должен оставаться компактным и легко читаемым."
          />
          <div className="mt-4 space-y-3">
            {[
              { label: 'Синхронизация новых пользователей', value: '3 аккаунта подтверждены', meta: 'Последнее окно onboarding прошло чисто.', tone: 'bg-blue-50 text-blue-600', icon: 'ki-people' },
              { label: 'Поток данных', value: 'Импорт WHOOP стабилен', meta: 'В текущем demo-наборе нет пропущенных сессий.', tone: 'bg-green-50 text-green-600', icon: 'ki-chart-line-up' },
              { label: 'Аудит', value: 'Связки ролей целы', meta: 'Роли атлета и тренера остаются неизменными.', tone: 'bg-violet-50 text-violet-600', icon: 'ki-lock' },
            ].map(item => (
              <div key={item.label} className="rounded-2xl border border-border bg-background/70 p-3">
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                    <i className={`ki-filled ${item.icon} text-sm`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{item.label}</div>
                    <div className="mt-1 text-xs font-medium text-foreground">{item.value}</div>
                    <div className="mt-1 text-2xs text-muted-foreground">{item.meta}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <a href="/admin" className="kt-btn kt-btn-primary w-full justify-center gap-2">
              <i className="ki-filled ki-setting-2 text-sm" />
              Открыть панель администратора
            </a>
          </div>
        </Surface>
      </div>
    </div>
  )
}

// ── ROOT ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, loading } = useUser()

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="pf-spin h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent" />
          <span className="text-2sm text-muted-foreground">Загружаем ваши данные…</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Surface className="w-full max-w-md p-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Сессия</p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Не удалось загрузить профиль</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Попробуйте войти снова. Если проблема повторится, мы уже сузили ее до auth-профиля и сможем добить отдельно.
          </p>
          <div className="mt-5">
            <a href="/auth/login" className="kt-btn kt-btn-primary gap-2">
              <i className="ki-filled ki-enter text-sm" />
              Перейти ко входу
            </a>
          </div>
        </Surface>
      </div>
    )
  }

  if (user.role === 'coach' || user.role === 'organization') return <CoachDash name={user.name} />
  if (user.role === 'admin') return <AdminDash name={user.name} />
  return <AthleteDash name={user.name} userId={user.id} />
}
