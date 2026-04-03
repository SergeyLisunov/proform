'use client'
import { useEffect, useState, useMemo } from 'react'
import ReactDOM from 'react-dom'
import { useUser } from '@/lib/hooks/useUser'
import { DEMO_DIARY, RISK_COLORS } from '@/lib/utils/data'
import { getWorkouts, createWorkout } from '@/services/workouts.service'
import type { Workout } from '@/services/workouts.service'
import { createBrowserClient } from '@supabase/ssr'
import { WorkoutLimitBadge } from '@/components/ui/Paywall'
import dynamic from 'next/dynamic'

const WorkoutPDFExport = dynamic(() => import('@/components/ui/WorkoutPDFExport'), { ssr: false })

// ── константы ──────────────────────────────────────────────────────────────────
const FILTER_OPTIONS = ['Все', 'Бег', 'Велоспорт', 'Плавание', 'Силовые', 'Ходьба']
const RISK_FILTER = ['all', 'low', 'moderate', 'high']
const CATEGORY_FILTER = ['all', 'performance', 'health', 'motivation', 'technique']

const ACTIVITY_CONFIG: Record<string, { icon: string; bg: string; border: string; text: string }> = {
  'Бег':       { icon: 'ki-abstract-26',  bg: '#EFF6FF', border: '#BFDBFE', text: '#2563EB' },
  'Велоспорт': { icon: 'ki-technology-4', bg: '#FFF7ED', border: '#FED7AA', text: '#EA580C' },
  'Плавание':  { icon: 'ki-abstract-14',  bg: '#E0F2FE', border: '#7DD3FC', text: '#0284C7' },
  'Силовые':   { icon: 'ki-abstract-45',  bg: '#FAF5FF', border: '#E9D5FF', text: '#9333EA' },
  'Ходьба':    { icon: 'ki-map',          bg: '#F0FDF4', border: '#BBF7D0', text: '#16A34A' },
  'Другое':    { icon: 'ki-calendar',     bg: '#F8FAFC', border: '#E2E8F0', text: '#64748B' },
}
const DEFAULT_AC = ACTIVITY_CONFIG['Другое']

const FORM_ACTIVITY_TYPES = [
  { value: 'Бег',       icon: 'ki-abstract-26' },
  { value: 'Велоспорт', icon: 'ki-technology-4' },
  { value: 'Плавание',  icon: 'ki-abstract-14' },
  { value: 'Силовые',   icon: 'ki-abstract-45' },
  { value: 'Ходьба',    icon: 'ki-map' },
  { value: 'Другое',    icon: 'ki-calendar' },
]

const MOODS = ['😴', '😕', '😐', '🙂', '🔥']

type Period = '1w' | '2w' | '1m' | '3m'
const PERIODS: { id: Period; label: string; days: number }[] = [
  { id: '1w', label: '1 неделя',  days: 7   },
  { id: '2w', label: '2 недели',  days: 14  },
  { id: '1m', label: '1 месяц',   days: 30  },
  { id: '3m', label: 'Квартал',   days: 90  },
]

type DrawerForm = {
  activity_type: string
  name: string
  event_date: string
  start_time: string
  activity_duration_min: string
  activity_strain: number
  avg_heart_rate: string
  max_heart_rate: string
  activity_calories: string
  mood: string
  description: string
}

const EMPTY_FORM: DrawerForm = {
  activity_type: 'Бег',
  name: '',
  event_date: new Date().toISOString().slice(0, 10),
  start_time: '',
  activity_duration_min: '',
  activity_strain: 0,
  avg_heart_rate: '',
  max_heart_rate: '',
  activity_calories: '',
  mood: '',
  description: '',
}

// ── helpers ────────────────────────────────────────────────────────────────────
function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function strainColor(v: number): string {
  if (v < 3) return '#22c55e'
  if (v < 8) return '#84cc16'
  if (v < 14) return '#eab308'
  if (v < 18) return '#f97316'
  return '#ef4444'
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}

function parseDate(s: string): Date {
  return new Date(s + 'T00:00:00')
}

function fmtDuration(min: number | null | undefined): string {
  if (!min) return '—'
  if (min < 60) return `${min} мин`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}ч ${m}м` : `${h}ч`
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  return parseDate(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function fmtFullDate(s: string | null | undefined): string {
  if (!s) return '—'
  return parseDate(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

type DiaryGroup = 'Сегодня' | 'Эта неделя' | 'Ранее'
const DIARY_GROUPS: DiaryGroup[] = ['Сегодня', 'Эта неделя', 'Ранее']

type ComparisonDirection = 'up' | 'down' | 'flat'
type ComparisonCue = {
  key: string
  text: string
  direction: ComparisonDirection
}
type WorkoutComparison = {
  previous: Workout | null
  cues: ComparisonCue[]
}

function getDiaryGroup(date: string | null | undefined): DiaryGroup {
  if (!date) return 'Ранее'
  const parsed = parseDate(date)
  const today = daysAgo(0)

  if (parsed.getTime() === today.getTime()) return 'Сегодня'
  if (parsed >= daysAgo(7)) return 'Эта неделя'
  return 'Ранее'
}

function getWorkoutSortTime(workout: Workout): number {
  const eventTime = workout.event_date ? parseDate(workout.event_date).getTime() : 0
  const createdTime = workout.created_at ? new Date(workout.created_at).getTime() : 0
  return eventTime || createdTime
}

function buildComparisonCue(
  key: 'strain' | 'duration' | 'heart_rate',
  current: number | null | undefined,
  previous: number | null | undefined
): ComparisonCue | null {
  if (current == null || previous == null) return null

  const delta = current - previous
  const absDelta = Math.abs(delta)

  if (key === 'strain') {
    if (absDelta < 0.3) return { key, text: 'нагрузка ровно', direction: 'flat' }
    return {
      key,
      text: `нагрузка ${delta > 0 ? '+' : ''}${delta.toFixed(1)}`,
      direction: delta > 0 ? 'up' : 'down',
    }
  }

  if (key === 'duration') {
    if (absDelta < 5) return { key, text: 'время ровно', direction: 'flat' }
    return {
      key,
      text: `время ${delta > 0 ? '+' : ''}${Math.round(delta)} мин`,
      direction: delta > 0 ? 'up' : 'down',
    }
  }

  if (absDelta < 3) return { key, text: 'ЧСС ровно', direction: 'flat' }
  return {
    key,
    text: `ЧСС ${delta > 0 ? '+' : ''}${Math.round(delta)}`,
    direction: delta > 0 ? 'up' : 'down',
  }
}

function getComparisonCueClasses(direction: ComparisonDirection): string {
  if (direction === 'up') return 'border-orange-200 bg-orange-50 text-orange-700'
  if (direction === 'down') return 'border-sky-200 bg-sky-50 text-sky-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

// ── ANALYTICS BLOCK ────────────────────────────────────────────────────────────
function AnalyticsBlock({ workouts }: { workouts: Workout[] }) {
  const [period, setPeriod] = useState<Period>('1w')

  const stats = useMemo(() => {
    const periodDef = PERIODS.find(p => p.id === period)!
    const from = daysAgo(periodDef.days)
    const filtered = workouts.filter(w => {
      if (!w.event_date) return false
      const d = parseDate(w.event_date)
      return d >= from
    })
    const totalMin  = filtered.reduce((s, w) => s + (w.activity_duration_min ?? 0), 0)
    const totalH    = totalMin / 60
    const count     = filtered.length
    const avgMin    = count ? Math.round(totalMin / count) : 0
    const avgStrain = count ? filtered.reduce((s, w) => s + (w.activity_strain ?? 0), 0) / count : 0

    const byType: Record<string, number> = {}
    filtered.forEach(w => {
      const t = w.activity_type ?? 'Другое'
      byType[t] = (byType[t] ?? 0) + 1
    })
    const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    return { totalH, totalMin, count, avgMin, avgStrain, topType, filtered }
  }, [workouts, period])

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-0.5 p-1.5 border-b border-border">
        <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mr-1">Период:</span>
        {PERIODS.map(p => (
          <button key={p.id} onClick={() => setPeriod(p.id)}
            className={[
              'px-3 py-1.5 rounded-lg text-2sm font-semibold transition-all',
              period === p.id
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            ].join(' ')}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-border">
        {[
          {
            label: 'Часов тренировок',
            value: stats.totalH >= 1
              ? stats.totalH.toFixed(1) + ' ч'
              : stats.totalMin + ' мин',
            icon: 'ki-time',
            color: '#F97316',
            bg: '#FFF7ED',
          },
          {
            label: 'Тренировок',
            value: stats.count,
            icon: 'ki-abstract-26',
            color: '#2563EB',
            bg: '#EFF6FF',
          },
          {
            label: 'Ср. длительность',
            value: fmtDuration(stats.avgMin),
            icon: 'ki-chart-line-up',
            color: '#16A34A',
            bg: '#F0FDF4',
          },
          {
            label: 'Осн. активность',
            value: stats.topType ?? '—',
            icon: (stats.topType && ACTIVITY_CONFIG[stats.topType]?.icon) ?? 'ki-calendar',
            color: (stats.topType && ACTIVITY_CONFIG[stats.topType]?.text) ?? '#64748B',
            bg: (stats.topType && ACTIVITY_CONFIG[stats.topType]?.bg) ?? '#F8FAFC',
          },
        ].map(s => (
          <div key={s.label} className="p-4 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.bg }}>
              <i className={`ki-filled ${s.icon} text-sm`} style={{ color: s.color }} />
            </div>
            <div>
              <div className="pf-num text-2xl text-foreground leading-none">{s.value}</div>
              <div className="text-2xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {stats.count > 0 && stats.totalMin > 0 && (() => {
        const byType: Record<string, number> = {}
        stats.filtered.forEach(w => {
          const t = w.activity_type ?? 'Другое'
          byType[t] = (byType[t] ?? 0) + (w.activity_duration_min ?? 0)
        })
        const entries = Object.entries(byType).sort((a,b) => b[1]-a[1])
        return (
          <div className="px-4 pb-4">
            <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
              {entries.map(([type, min]) => {
                const pct = (min / stats.totalMin) * 100
                const ac = ACTIVITY_CONFIG[type] ?? DEFAULT_AC
                return <div key={type} style={{ width: `${pct}%`, background: ac.text, borderRadius: 999 }} title={`${type}: ${fmtDuration(min)}`} />
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-2">
              {entries.map(([type, min]) => {
                const ac = ACTIVITY_CONFIG[type] ?? DEFAULT_AC
                return (
                  <div key={type} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: ac.text }} />
                    <span className="text-2xs text-muted-foreground">{type} · {fmtDuration(min)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {stats.count === 0 && (
        <div className="px-4 pb-4 text-center py-4">
          <p className="text-2xs text-muted-foreground">Нет тренировок за выбранный период</p>
        </div>
      )}
    </div>
  )
}

// ── InfoRow helper ─────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--foreground)' }}>{value}</div>
    </div>
  )
}

// ── VIEW/EDIT DRAWER ───────────────────────────────────────────────────────────
function ViewEditDrawer({
  workout, onClose, onUpdated, onDeleted,
}: {
  workout: Workout
  onClose: () => void
  onUpdated: (w: Workout) => void
  onDeleted: (id: string) => void
}) {
  const [mounted,    setMounted]    = useState(false)
  const [visible,    setVisible]    = useState(false)
  const [mode,       setMode]       = useState<'view'|'edit'>('view')
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const [form, setForm] = useState<DrawerForm>({
    activity_type:        workout.activity_type ?? 'Другое',
    name:                 workout.name ?? '',
    event_date:           workout.event_date ?? '',
    start_time:           workout.start_time ?? '',
    activity_duration_min: workout.activity_duration_min != null ? String(workout.activity_duration_min) : '',
    activity_strain:      workout.activity_strain != null ? Number(workout.activity_strain) : 0,
    avg_heart_rate:       workout.avg_heart_rate != null ? String(workout.avg_heart_rate) : '',
    max_heart_rate:       workout.max_heart_rate != null ? String(workout.max_heart_rate) : '',
    activity_calories:    workout.activity_calories != null ? String(workout.activity_calories) : '',
    mood: workout.mood != null ? (MOODS[Number(workout.mood)] ?? '') : '',
    description:          workout.description ?? '',
  })

  useEffect(() => {
    setMounted(true)
    requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, []) // eslint-disable-line

  function handleClose() { setVisible(false); setTimeout(onClose, 260) }
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const sb = getSupabase()
      const payload = {
        name: form.name.trim() || null,
        event_date: form.event_date,
        activity_type: form.activity_type || null,
        start_time: form.start_time || null,
        activity_duration_min: form.activity_duration_min ? Number(form.activity_duration_min) : null,
        activity_strain: form.activity_strain > 0 ? form.activity_strain : null,
        avg_heart_rate: form.avg_heart_rate ? Number(form.avg_heart_rate) : null,
        max_heart_rate: form.max_heart_rate ? Number(form.max_heart_rate) : null,
        activity_calories: form.activity_calories ? Number(form.activity_calories) : null,
        mood: form.mood ? MOODS.indexOf(form.mood) : null,
        description: form.description.trim() || null,
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await sb.from('workouts').update(payload).eq('id', workout.id).select().single()
      if (error) throw error
      onUpdated(data as Workout)
      setMode('view')
    } catch (err) {
      console.error('updateWorkout error:', err)
      alert('Не удалось сохранить тренировку')
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const { error } = await getSupabase().from('workouts').delete().eq('id', workout.id)
      if (error) throw error
      onDeleted(workout.id)
      handleClose()
    } catch (err) {
      console.error('deleteWorkout error:', err)
      alert('Не удалось удалить тренировку')
    } finally { setDeleting(false) }
  }

  if (!mounted) return null

  const ac = ACTIVITY_CONFIG[workout.activity_type ?? ''] ?? DEFAULT_AC
  const displayName = workout.name || workout.activity_type || 'Тренировка'
  const inputClass = 'w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10'
  const quickFacts = [
    workout.activity_duration_min != null
      ? { label: 'Длительность', value: fmtDuration(workout.activity_duration_min), tone: '#F97316' }
      : null,
    workout.activity_strain != null
      ? { label: 'Нагрузка', value: Number(workout.activity_strain).toFixed(1), tone: strainColor(Number(workout.activity_strain)) }
      : null,
    workout.avg_heart_rate != null
      ? { label: 'Ср. ЧСС', value: `${Math.round(Number(workout.avg_heart_rate))}`, tone: '#EF4444' }
      : null,
    workout.activity_calories != null
      ? { label: 'Калории', value: `${workout.activity_calories} ккал`, tone: '#2563EB' }
      : null,
  ].filter(Boolean) as { label: string; value: string; tone: string }[]

  return ReactDOM.createPortal(
    <>
      <div onClick={handleClose} style={{ position:'fixed',inset:0,zIndex:9998,background:'rgba(15,23,42,0.65)',backdropFilter:'blur(3px)',transition:'opacity 0.26s',opacity:visible?1:0 }} />
      <div style={{ position:'fixed',top:0,right:0,bottom:0,width:520,maxWidth:'100vw',zIndex:9999,background:'var(--card)',borderLeft:'1px solid var(--border)',display:'flex',flexDirection:'column',transition:'transform 0.26s cubic-bezier(.32,.72,0,1)',transform:visible?'translateX(0)':'translateX(100%)' }}>

        <div className="sticky top-0 z-[1] border-b border-border bg-card/95 px-6 py-5 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
                style={{ background: ac.bg, borderColor: ac.border }}
              >
                <i className={`ki-filled ${ac.icon} text-sm`} style={{ color: ac.text }} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {mode === 'view' ? 'Детали тренировки' : 'Редактирование'}
                </div>
                <div className="mt-1 truncate text-base font-semibold text-foreground">
                  {mode === 'view' ? displayName : 'Изменить тренировку'}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {workout.activity_type ?? 'Тренировка'} · {fmtFullDate(workout.event_date)}
                </div>
              </div>
            </div>
            <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost shrink-0"><i className="ki-filled ki-cross text-sm" /></button>
          </div>
        </div>

        <div style={{ flex:1,overflowY:'auto',padding:'20px 24px' }}>
          {mode === 'view' ? (
            <div className="flex flex-col gap-5">
              <section
                className="rounded-[28px] border p-5 shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${ac.bg} 0%, rgba(255,255,255,0.98) 100%)`,
                  borderColor: ac.border,
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="inline-flex items-center rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground shadow-sm">
                      Сессия атлета
                    </div>
                    <h3 className="mt-3 text-[28px] font-semibold leading-none text-foreground">{displayName}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full border border-white/80 bg-white/80 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
                        {fmtFullDate(workout.event_date)}
                      </span>
                      {workout.start_time && (
                        <span className="inline-flex items-center rounded-full border border-white/80 bg-white/80 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
                          {workout.start_time}
                        </span>
                      )}
                      {workout.mood != null && workout.mood >= 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/80 bg-white/80 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
                          Самочувствие {MOODS[workout.mood]}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border bg-white/80 shadow-sm"
                    style={{ borderColor: ac.border }}
                  >
                    <i className={`ki-filled ${ac.icon} text-lg`} style={{ color: ac.text }} />
                  </div>
                </div>

                {quickFacts.length > 0 && (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {quickFacts.map(fact => (
                      <div key={fact.label} className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{fact.label}</div>
                        <div className="mt-2 pf-num text-[26px] leading-none" style={{ color: fact.tone }}>{fact.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-[24px] border border-border bg-background/70 p-5 shadow-sm">
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Структура сессии</div>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Дата" value={fmtFullDate(workout.event_date)} />
                  <InfoRow label="Тип" value={workout.activity_type} />
                  <InfoRow label="Начало" value={workout.start_time} />
                  <InfoRow label="Длительность" value={workout.activity_duration_min ? fmtDuration(workout.activity_duration_min) : null} />
                </div>
              </section>

              <section className="rounded-[24px] border border-border bg-background/70 p-5 shadow-sm">
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Нагрузка и физиология</div>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Нагрузка" value={workout.activity_strain != null ? Number(workout.activity_strain).toFixed(1) : null} />
                  <InfoRow label="Калории" value={workout.activity_calories ? `${workout.activity_calories} ккал` : null} />
                  <InfoRow label="ЧСС средний" value={workout.avg_heart_rate ? `${Math.round(Number(workout.avg_heart_rate))} уд/мин` : null} />
                  <InfoRow label="ЧСС макс" value={workout.max_heart_rate ? `${Math.round(Number(workout.max_heart_rate))} уд/мин` : null} />
                </div>
              </section>

              {(workout.description || workout.created_at) && (
                <section className="rounded-[24px] border border-border bg-background/70 p-5 shadow-sm">
                  <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Контекст</div>
                  {workout.description ? (
                    <p className="m-0 whitespace-pre-wrap text-sm leading-6 text-foreground">{workout.description}</p>
                  ) : (
                    <p className="m-0 text-sm text-muted-foreground">Заметки не добавлены.</p>
                  )}
                  {workout.created_at && (
                    <div className="mt-4 text-xs text-muted-foreground/80">
                      Создано {new Date(workout.created_at).toLocaleString('ru-RU')}
                    </div>
                  )}
                </section>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <section className="rounded-[24px] border border-border bg-background/70 p-5 shadow-sm">
                <div className="mb-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Основное</div>
                  <h4 className="mt-1 text-base font-semibold text-foreground">Редактирование тренировки</h4>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {FORM_ACTIVITY_TYPES.map(at => {
                    const cfg = ACTIVITY_CONFIG[at.value] ?? DEFAULT_AC; const sel = form.activity_type === at.value
                    return (
                      <button key={at.value} type="button" onClick={() => setForm(f=>({...f,activity_type:at.value}))}
                        style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:6,padding:'10px 8px',borderRadius:16,border:`1.5px solid ${sel?cfg.border:'var(--border)'}`,background:sel?cfg.bg:'transparent',cursor:'pointer',transition:'all 0.15s' }}>
                        <i className={`ki-filled ${at.icon} text-base`} style={{ color:sel?cfg.text:'var(--muted-foreground)' }} />
                        <span style={{ fontSize:10,fontWeight:600,color:sel?cfg.text:'var(--muted-foreground)' }}>{at.value}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Название</label>
                    <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="Утренняя пробежка..." className={inputClass} />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Дата *</label>
                      <input type="date" name="event_date" value={form.event_date} onChange={handleChange} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Начало</label>
                      <input type="time" name="start_time" value={form.start_time} onChange={handleChange} className={inputClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Длительность (мин)</label>
                      <input type="number" name="activity_duration_min" value={form.activity_duration_min} onChange={handleChange} placeholder="60" className={inputClass} />
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Нагрузка (0-21)</label>
                        <span className="pf-num text-base text-foreground">{form.activity_strain.toFixed(1)}</span>
                      </div>
                      <div className="rounded-2xl border border-input bg-background px-4 py-4">
                        <input type="range" min="0" max="21" step="0.1" value={form.activity_strain} onChange={e=>setForm(f=>({...f,activity_strain:Number(e.target.value)}))} className="w-full accent-orange-500" />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] border border-border bg-background/70 p-5 shadow-sm">
                <div className="mb-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Метрики и контекст</div>
                  <h4 className="mt-1 text-base font-semibold text-foreground">Физиология и ощущения</h4>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Ср. ЧСС</label>
                    <input type="number" name="avg_heart_rate" value={form.avg_heart_rate} onChange={handleChange} placeholder="150" className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Макс. ЧСС</label>
                    <input type="number" name="max_heart_rate" value={form.max_heart_rate} onChange={handleChange} placeholder="185" className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Калории</label>
                    <input type="number" name="activity_calories" value={form.activity_calories} onChange={handleChange} placeholder="500" className={inputClass} />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="mb-2 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Самочувствие</label>
                  <div className="flex gap-2">
                    {MOODS.map(m => (
                      <button key={m} type="button" onClick={() => setForm(f=>({...f,mood:f.mood===m?'':m}))}
                        style={{ width:44,height:44,borderRadius:14,fontSize:20,border:`1.5px solid ${form.mood===m?'#fb923c':'var(--border)'}`,background:form.mood===m?'rgba(251,146,60,0.08)':'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s' }}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4">
                  <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Заметки</label>
                  <textarea name="description" value={form.description} onChange={handleChange} rows={4} placeholder="Ощущения, условия, наблюдения..." className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 resize-none" />
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 24px',borderTop:'1px solid var(--border)',display:'flex',gap:10,flexShrink:0 }}>
          {mode === 'view' ? (
            <>
              <button onClick={() => setMode('edit')} className="kt-btn kt-btn-primary" style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
                <i className="ki-filled ki-pencil text-xs" />Редактировать
              </button>
              {!confirmDel ? (
                <button onClick={() => setConfirmDel(true)} style={{ padding:'8px 14px',borderRadius:10,border:'1px solid #fecaca',background:'transparent',color:'#ef4444',cursor:'pointer',fontSize:13,fontWeight:600 }}>
                  <i className="ki-filled ki-trash text-sm" />
                </button>
              ) : (
                <>
                  <button onClick={handleDelete} disabled={deleting} style={{ padding:'8px 14px',borderRadius:10,background:'#ef4444',color:'white',border:'none',cursor:'pointer',fontSize:13,fontWeight:600,opacity:deleting?0.6:1 }}>
                    {deleting ? '...' : 'Удалить'}
                  </button>
                  <button onClick={() => setConfirmDel(false)} className="kt-btn kt-btn-outline">Отмена</button>
                </>
              )}
            </>
          ) : (
            <>
              <button onClick={handleSave} disabled={saving} className="kt-btn kt-btn-primary" style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
                {saving ? <><i className="ki-filled ki-loading animate-spin text-xs" /> Сохранение…</> : <><i className="ki-filled ki-check text-xs" /> Сохранить</>}
              </button>
              <button onClick={() => setMode('view')} className="kt-btn kt-btn-outline">Отмена</button>
            </>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}

// ── ADD WORKOUT DRAWER ─────────────────────────────────────────────────────────
function AddWorkoutDrawer({ open, onClose, userId, onCreated }: {
  open: boolean; onClose: () => void; userId: string; onCreated: (w: Workout) => void
}) {
  const [mounted, setMounted] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [errors,  setErrors]  = useState<Partial<Record<keyof DrawerForm, string>>>({})
  const [form,    setForm]    = useState<DrawerForm>(EMPTY_FORM)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (open) { setForm({ ...EMPTY_FORM, event_date: new Date().toISOString().slice(0, 10) }); setErrors({}) }
  }, [open])

  function validate(): boolean {
    const e: Partial<Record<keyof DrawerForm, string>> = {}
    if (!form.name.trim()) e.name = 'Название обязательно'
    if (!form.event_date)  e.event_date = 'Дата обязательна'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)

    // 1. Создаём запись в workouts (основной источник для дневника)
    const workout = await createWorkout({
      athlete_id: userId,
      event_date: form.event_date,
      event_type: 'workout',
      activity_type: form.activity_type,
      name: form.name.trim(),
      description: form.description.trim() || null,
      start_time: form.start_time || null,
      activity_duration_min: form.activity_duration_min ? Number(form.activity_duration_min) : null,
      activity_strain: form.activity_strain > 0 ? form.activity_strain : null,
      avg_heart_rate: form.avg_heart_rate ? Number(form.avg_heart_rate) : null,
      max_heart_rate: form.max_heart_rate ? Number(form.max_heart_rate) : null,
      activity_calories: form.activity_calories ? Number(form.activity_calories) : null,
      mood: form.mood ? MOODS.indexOf(form.mood) : null,
    })

    // 2. Синхронизируем в calendar_events (чтобы тренировка отображалась в календаре)
    if (workout) {
      try {
        const sb = getSupabase()
        await sb.from('calendar_events').insert({
          owner_id:   userId,
          event_date: form.event_date,
          start_date: form.event_date,
          event_type: 'workout',
          title:      form.name.trim(),
          notes:      form.description.trim() || null,
          start_time: form.start_time || null,
        })
      } catch (err) {
        // Некритичная ошибка — дневник уже сохранён, просто логируем
        console.warn('calendar_events sync error:', err)
      }
    }

    setSaving(false)
    if (workout) onCreated(workout)
  }

  if (!mounted || !open) return null

  const selectedCfg = ACTIVITY_CONFIG[form.activity_type] ?? DEFAULT_AC
  const quickSummary = [
    form.activity_type,
    form.activity_duration_min ? `${form.activity_duration_min} мин` : 'Длительность не задана',
    form.activity_strain > 0 ? `${form.activity_strain.toFixed(1)} нагрузка` : 'Нагрузка не задана',
  ]
  const inputClass = (hasError = false) => [
    'w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-all bg-background',
    hasError
      ? 'border-red-300 text-foreground focus:border-red-400 focus:ring-4 focus:ring-red-500/10'
      : 'border-input text-foreground focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10',
  ].join(' ')

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex">
      <button
        type="button"
        aria-label="Закрыть форму добавления тренировки"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-[540px] flex-col border-l border-border bg-card shadow-[0_20px_80px_rgba(15,23,42,0.18)]">
        <div className="border-b border-border bg-card px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-700">
                Быстрое добавление
              </div>
              <h3 className="mt-3 pf-num text-[30px] leading-none text-foreground">Добавить тренировку</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Сначала сохраните главное: тип, дату и нагрузку. Остальные метрики можно быстро добавить сразу в этом же потоке.
              </p>
            </div>
            <button onClick={onClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost shrink-0"><i className="ki-filled ki-cross text-sm" /></button>
          </div>
          <div
            className="mt-4 rounded-[24px] border p-4"
            style={{
              background: `linear-gradient(135deg, ${selectedCfg.bg} 0%, rgba(255,255,255,0.96) 100%)`,
              borderColor: selectedCfg.border,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
                style={{ background: selectedCfg.bg, borderColor: selectedCfg.border }}
              >
                <i className={`ki-filled ${selectedCfg.icon} text-base`} style={{ color: selectedCfg.text }} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Текущий шаблон</div>
                <div className="mt-1 text-base font-semibold text-foreground">{form.name.trim() || form.activity_type}</div>
                <div className="mt-1 text-xs text-muted-foreground">Форма собирается вокруг самого важного, чтобы добавить запись за несколько секунд.</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {quickSummary.map(item => (
                <span key={item} className="inline-flex items-center rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[11px] font-semibold text-foreground shadow-sm">
                  {item}
                </span>
              ))}
            </div>
          </div>

        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <section className="rounded-[26px] border border-border bg-background/70 p-5 shadow-sm">
              <div className="mb-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Основное</div>
                <h4 className="mt-1 text-base font-semibold text-foreground">Быстрый захват тренировки</h4>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Сначала выберите активность и заполните обязательные поля. Это даст рабочую запись даже без дополнительных метрик.</p>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {FORM_ACTIVITY_TYPES.map(at => {
                  const ac = ACTIVITY_CONFIG[at.value] ?? DEFAULT_AC
                  const sel = form.activity_type === at.value
                  return (
                    <button
                      key={at.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, activity_type: at.value }))}
                      className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 transition-all ${
                        sel ? 'shadow-sm' : 'hover:border-border hover:bg-card'
                      }`}
                      style={{
                        borderColor: sel ? ac.border : 'var(--border)',
                        background: sel ? ac.bg : 'transparent',
                      }}
                    >
                      <i className={`ki-filled ${at.icon} text-base`} style={{ color: sel ? ac.text : 'var(--muted-foreground)' }} />
                      <span className="text-[11px] font-semibold" style={{ color: sel ? ac.text : 'var(--muted-foreground)' }}>
                        {at.value}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 grid gap-4">
                <div>
                  <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Название *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Например: Утренняя пробежка"
                    className={inputClass(Boolean(errors.name))}
                  />
                  {errors.name && <p className="mt-1.5 text-2xs font-medium text-red-500">{errors.name}</p>}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Дата *</label>
                    <input
                      type="date"
                      value={form.event_date}
                      onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                      className={inputClass(Boolean(errors.event_date))}
                    />
                    {errors.event_date && <p className="mt-1.5 text-2xs font-medium text-red-500">{errors.event_date}</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Начало</label>
                    <input
                      type="time"
                      value={form.start_time}
                      onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                      className={inputClass()}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Длительность (мин)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.activity_duration_min}
                    onChange={e => setForm(f => ({ ...f, activity_duration_min: e.target.value }))}
                    placeholder="60"
                    className={inputClass()}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-[26px] border border-border bg-background/70 p-5 shadow-sm">
              <div className="mb-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Интенсивность</div>
                <h4 className="mt-1 text-base font-semibold text-foreground">Нагрузка и метрики</h4>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Заполните то, что уже знаете, чтобы дневник и аналитика были полезнее сразу после сохранения.</p>
              </div>

              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-card px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Нагрузка</div>
                  <div className="mt-2 pf-num text-2xl" style={{ color: strainColor(form.activity_strain) }}>{form.activity_strain.toFixed(1)}</div>
                </div>
                <div className="rounded-2xl border border-border bg-card px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Длительность</div>
                  <div className="mt-2 text-lg font-semibold text-foreground">{form.activity_duration_min ? `${form.activity_duration_min} мин` : '—'}</div>
                </div>
                <div className="rounded-2xl border border-border bg-card px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Пульс</div>
                  <div className="mt-2 text-lg font-semibold text-foreground">{form.avg_heart_rate ? `${form.avg_heart_rate} уд/мин` : '—'}</div>
                </div>
              </div>

              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Нагрузка (0–21)</label>
                  <span className="pf-num text-xl text-foreground">{form.activity_strain.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="21"
                  step="0.1"
                  value={form.activity_strain}
                  onChange={e => setForm(f => ({ ...f, activity_strain: Number(e.target.value) }))}
                  className="w-full accent-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Ср. ЧСС</label>
                  <input
                    type="number"
                    min="1"
                    value={form.avg_heart_rate}
                    onChange={e => setForm(f => ({ ...f, avg_heart_rate: e.target.value }))}
                    placeholder="150"
                    className={inputClass()}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Макс. ЧСС</label>
                  <input
                    type="number"
                    min="1"
                    value={form.max_heart_rate}
                    onChange={e => setForm(f => ({ ...f, max_heart_rate: e.target.value }))}
                    placeholder="185"
                    className={inputClass()}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Калории</label>
                  <input
                    type="number"
                    min="1"
                    value={form.activity_calories}
                    onChange={e => setForm(f => ({ ...f, activity_calories: e.target.value }))}
                    placeholder="500"
                    className={inputClass()}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-[26px] border border-border bg-background/70 p-5 shadow-sm">
              <div className="mb-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Контекст</div>
                <h4 className="mt-1 text-base font-semibold text-foreground">Самочувствие и заметки</h4>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Небольшой контекст помогает потом читать историю тренировок как связный дневник, а не только как список чисел.</p>
              </div>

              <div>
                <label className="mb-2 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Самочувствие</label>
                <div className="flex gap-2">
                  {MOODS.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, mood: f.mood === m ? '' : m }))}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border text-[20px] transition-all"
                      style={{
                        borderColor: form.mood === m ? '#fb923c' : 'var(--border)',
                        background: form.mood === m ? 'rgba(251,146,60,0.08)' : 'transparent',
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Заметки</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={4}
                  placeholder="Ощущения, условия, наблюдения…"
                  className={`${inputClass()} resize-none`}
                />
              </div>
            </section>
          </div>

          <div className="border-t border-border bg-card px-6 py-4">
            <div className="flex items-center justify-between gap-4 rounded-[22px] border border-border bg-background/70 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">Готово к сохранению</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  Запись попадет в дневник и синхронизируется с календарем после сохранения.
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={onClose} className="kt-btn kt-btn-outline">Отмена</button>
                <button type="submit" disabled={saving} className="kt-btn kt-btn-primary min-w-[176px] justify-center">
                  {saving ? 'Сохранение…' : 'Сохранить тренировку'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

// ── COACH DIARY ────────────────────────────────────────────────────────────────
function CoachDiary() {
  const [riskFilter, setRiskFilter] = useState('all')
  const [catFilter,  setCatFilter]  = useState('all')
  const [showForm,   setShowForm]   = useState(false)

  const filtered = DEMO_DIARY.filter(d =>
    (riskFilter === 'all' || d.risk === riskFilter) &&
    (catFilter === 'all' || d.category === catFilter)
  )

  return (
    <div className="flex flex-col gap-5 pf-enter">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Журнал наблюдений</p>
          <h2 className="pf-num text-[36px] text-foreground leading-none">Дневник тренера</h2>
        </div>
        <button onClick={() => setShowForm(true)} className="kt-btn kt-btn-primary gap-2">
          <i className="ki-filled ki-plus text-sm" />Новая запись
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label:'Всего записей', value:DEMO_DIARY.length, bg:'bg-blue-50 text-blue-600', icon:'ki-book-open' },
          { label:'Высокий риск',  value:DEMO_DIARY.filter(d=>d.risk==='high'||d.risk==='critical').length, bg:'bg-red-50 text-red-500', icon:'ki-warning-2' },
          { label:'Умеренный',     value:DEMO_DIARY.filter(d=>d.risk==='moderate').length, bg:'bg-orange-50 text-orange-500', icon:'ki-information-2' },
          { label:'В норме',       value:DEMO_DIARY.filter(d=>d.risk==='low').length, bg:'bg-green-50 text-green-600', icon:'ki-check-circle' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}><i className={`ki-filled ${s.icon} text-base`} /></div>
            <div><div className="pf-num text-2xl text-foreground">{s.value}</div><div className="text-2xs text-muted-foreground">{s.label}</div></div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {RISK_FILTER.map(f => (
            <button key={f} onClick={() => setRiskFilter(f)} className={['px-2.5 py-1.5 rounded-lg text-2sm font-medium border transition-all capitalize', riskFilter===f?'bg-orange-50 border-orange-200 text-orange-600':'bg-card border-border text-muted-foreground hover:border-orange-200'].join(' ')}>
              {f === 'all' ? 'Все риски' : f}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap ml-auto">
          {CATEGORY_FILTER.map(f => (
            <button key={f} onClick={() => setCatFilter(f)} className={['px-2.5 py-1.5 rounded-lg text-2sm font-medium border transition-all capitalize', catFilter===f?'bg-blue-50 border-blue-200 text-blue-600':'bg-card border-border text-muted-foreground hover:border-blue-200'].join(' ')}>
              {f === 'all' ? 'Все категории' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map((entry, i) => {
          const rc = RISK_COLORS[entry.risk as keyof typeof RISK_COLORS]
          return (
            <div key={i} className="bg-card border border-border rounded-xl p-5 hover:border-orange-200 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-foreground">{entry.title}</span>
                    <span className="text-2xs font-bold px-2 py-0.5 rounded-full border" style={{ background:rc.bg,color:rc.text,borderColor:rc.border }}>
                      <i className={`ki-filled ${rc.icon} mr-1 text-[10px]`} />{entry.risk.charAt(0).toUpperCase()+entry.risk.slice(1)} риск
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-border/60 text-muted-foreground capitalize">{entry.category}</span>
                  </div>
                  <div className="text-2xs text-muted-foreground">{entry.date} · Sara Kowalski</div>
                </div>
                <button className="kt-btn kt-btn-xs kt-btn-icon kt-btn-ghost"><i className="ki-filled ki-pencil text-xs text-muted-foreground" /></button>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed mb-3">{entry.note}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {entry.tags.map(tag => <span key={tag} className="px-2 py-0.5 rounded-full text-2xs font-medium bg-accent border border-border text-muted-foreground">#{tag}</span>)}
              </div>
            </div>
          )
        })}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="pf-num text-xl text-foreground">Новая запись в дневник</h3>
              <button onClick={() => setShowForm(false)} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost"><i className="ki-filled ki-cross text-sm" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div><label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Заголовок</label><input className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400" placeholder="Заголовок наблюдения..." /></div>
              <div><label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Заметка</label><textarea rows={4} className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400 resize-none" placeholder="Подробное наблюдение..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Уровень риска</label><select className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400">{['low','moderate','high','critical'].map(r=><option key={r} value={r}>{r}</option>)}</select></div>
                <div><label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Категория</label><select className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400">{['performance','health','motivation','technique','tactical'].map(c=><option key={c} value={c}>{c}</option>)}</select></div>
              </div>
              <div className="flex gap-2 pt-1">
                <button className="flex-1 kt-btn kt-btn-primary">Сохранить запись</button>
                <button onClick={() => setShowForm(false)} className="kt-btn kt-btn-outline">Отмена</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ATHLETE DIARY ──────────────────────────────────────────────────────────────
function AthleteDiary() {
  const { user } = useUser()
  const [filter,          setFilter]         = useState('Все')
  const [view,            setView]           = useState<'list'|'grid'>('list')
  const [workouts,        setWorkouts]       = useState<Workout[]>([])
  const [loading,         setLoading]        = useState(true)
  const [showDrawer,      setShowDrawer]     = useState(false)
  const [showPDF,         setShowPDF]        = useState(false)
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null)
  const [toast,           setToast]          = useState(false)

  useEffect(() => {
    if (!user) return
    getWorkouts(user.id).then(data => { setWorkouts(data); setLoading(false) })
  }, [user])

  const filtered = filter === 'Все' ? workouts : workouts.filter(w => (w.activity_type ?? 'Другое') === filter)
  const lastSevenDays = daysAgo(7)
  const recentCount = workouts.filter(w => w.event_date && parseDate(w.event_date) >= lastSevenDays).length
  const totalMinutes = workouts.reduce((sum, workout) => sum + (workout.activity_duration_min ?? 0), 0)
  const latestWorkout = [...workouts]
    .filter(w => w.event_date)
    .sort((a, b) => parseDate(b.event_date!).getTime() - parseDate(a.event_date!).getTime())[0]
  const strongestActivity = workouts.reduce<Record<string, number>>((acc, workout) => {
    const type = workout.activity_type ?? 'Другое'
    acc[type] = (acc[type] ?? 0) + 1
    return acc
  }, {})
  const topActivity = Object.entries(strongestActivity).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
  const filteredSummary = useMemo(() => {
    const minutes = filtered.reduce((sum, workout) => sum + (workout.activity_duration_min ?? 0), 0)
    const avgStrainSource = filtered.filter(workout => workout.activity_strain != null)
    const avgStrain = avgStrainSource.length
      ? avgStrainSource.reduce((sum, workout) => sum + Number(workout.activity_strain ?? 0), 0) / avgStrainSource.length
      : null
    const withNotesItems = filtered.filter(workout => workout.description?.trim())
    const withNotes = withNotesItems.length
    const latestNote = withNotesItems.find(workout => workout.event_date) ?? null

    return { minutes, avgStrain, withNotes, latestNote }
  }, [filtered])
  const groupedWorkouts = useMemo(() => {
    const grouped = DIARY_GROUPS.reduce<Record<DiaryGroup, Workout[]>>((acc, group) => {
      acc[group] = []
      return acc
    }, { 'Сегодня': [], 'Эта неделя': [], 'Ранее': [] })

    filtered.forEach(workout => {
      grouped[getDiaryGroup(workout.event_date)].push(workout)
    })

    return DIARY_GROUPS
      .map(group => ({ label: group, items: grouped[group] }))
      .filter(group => group.items.length > 0)
  }, [filtered])
  const workoutComparisons = useMemo(() => {
    const sortedAsc = [...workouts].sort((a, b) => getWorkoutSortTime(a) - getWorkoutSortTime(b))
    const lastSeenByType: Record<string, Workout | undefined> = {}
    const comparisonMap: Record<string, WorkoutComparison> = {}

    sortedAsc.forEach(workout => {
      const type = workout.activity_type ?? 'Другое'
      const previous = lastSeenByType[type] ?? null
      comparisonMap[workout.id] = {
        previous,
        cues: previous
          ? [
              buildComparisonCue('strain', workout.activity_strain, previous.activity_strain),
              buildComparisonCue('duration', workout.activity_duration_min, previous.activity_duration_min),
              buildComparisonCue('heart_rate', workout.avg_heart_rate, previous.avg_heart_rate),
            ].filter(Boolean) as ComparisonCue[]
          : [],
      }
      lastSeenByType[type] = workout
    })

    return comparisonMap
  }, [workouts])

  function handleCreated(w: Workout) {
    setWorkouts(prev => [w, ...prev])
    setShowDrawer(false)
    setToast(true); setTimeout(() => setToast(false), 3000)
  }
  function handleUpdated(updated: Workout) {
    setWorkouts(prev => prev.map(w => w.id === updated.id ? updated : w))
    setSelectedWorkout(updated)
    setToast(true); setTimeout(() => setToast(false), 3000)
  }
  function handleDeleted(id: string) {
    setWorkouts(prev => prev.filter(w => w.id !== id))
    setSelectedWorkout(null)
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-[28px] border border-orange-100 bg-[linear-gradient(135deg,#FFF8F1_0%,#FFFFFF_60%,#FFF4EC_100%)] px-8 py-12 text-center shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-orange-100">
            <div className="h-7 w-7 rounded-full border-2 border-orange-500 border-t-transparent pf-spin" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Загружаем историю тренировок</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">Собираем последние записи, чтобы показать нагрузку и контекст за сессии.</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 pf-enter">
      <section className="relative overflow-hidden rounded-[30px] border border-orange-100 bg-[radial-gradient(circle_at_top_right,_rgba(249,115,22,0.14),_transparent_36%),linear-gradient(135deg,#FFF8F1_0%,#FFFFFF_56%,#FFF4EC_100%)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-700">
                Дневник атлета
              </span>
              <span className="inline-flex items-center rounded-full border border-border bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Быстрое добавление
              </span>
            </div>
            <p className="mt-4 text-2xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">История тренировок</p>
            <h2 className="mt-2 pf-num text-[clamp(2.2rem,4vw,3.9rem)] leading-[0.94] text-foreground">Мой дневник</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Добавляйте тренировку сразу после сессии, фиксируйте самочувствие и держите историю нагрузки под рукой в одном рабочем пространстве.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-white/85 p-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">За 7 дней</div>
                <div className="mt-2 pf-num text-[28px] leading-none text-foreground">{recentCount}</div>
                <div className="mt-2 text-2xs text-muted-foreground">тренировок за последнюю неделю</div>
              </div>
              <div className="rounded-2xl border border-border bg-white/85 p-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Общий объем</div>
                <div className="mt-2 text-xl font-semibold text-foreground">{totalMinutes ? fmtDuration(totalMinutes) : '—'}</div>
                <div className="mt-2 text-2xs text-muted-foreground">суммарное время по сохраненным записям</div>
              </div>
              <div className="rounded-2xl border border-border bg-white/85 p-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Основной тип</div>
                <div className="mt-2 text-xl font-semibold text-foreground">{topActivity}</div>
                <div className="mt-2 text-2xs text-muted-foreground">
                  {latestWorkout ? `последняя запись ${fmtDate(latestWorkout.event_date)}` : 'добавьте первую тренировку'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex w-full max-w-[340px] flex-col gap-3 rounded-[26px] border border-border bg-white/85 p-4 shadow-sm">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Быстрый старт</div>
              <div className="mt-2 text-base font-semibold text-foreground">Сохраните тренировку, пока ощущения свежие</div>
              <div className="mt-2 text-xs leading-5 text-muted-foreground">
                Новый flow помогает быстро занести главное: активность, дату, длительность, нагрузку и короткий контекст.
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <button onClick={() => setShowDrawer(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#F97316,#EA580C)] px-4 py-3 text-sm font-bold text-white shadow-[0_10px_22px_rgba(249,115,22,0.28)] transition-transform hover:translate-y-[-1px]">
                <i className="ki-filled ki-plus text-sm" />
                Новая тренировка
              </button>
              <button
                onClick={() => setShowPDF(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition-all hover:border-slate-300 hover:text-slate-800"
              >
                <i className="ki-filled ki-file-down text-sm" />
                Экспорт PDF
              </button>
            </div>
          </div>
        </div>
      </section>

      <WorkoutLimitBadge />
      <AnalyticsBlock workouts={workouts} />

      <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-700">
                Рабочая история
              </span>
              <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {filtered.length} записей
              </span>
            </div>
            <h3 className="mt-3 text-[26px] font-semibold leading-none text-foreground">История и разбор тренировок</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Фильтруйте записи по активности, быстро считывайте нагрузку и открывайте отдельную тренировку для редактирования и заметок.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex items-center gap-1 rounded-2xl border border-border bg-background p-1">
              <button onClick={() => setView('list')} className={`rounded-xl px-3 py-2 text-sm font-semibold transition-all ${view==='list'?'bg-orange-50 text-orange-600 shadow-sm':'text-muted-foreground'}`}>
                <i className="ki-filled ki-row-horizontal mr-1.5 text-sm" />
                Список
              </button>
              <button onClick={() => setView('grid')} className={`rounded-xl px-3 py-2 text-sm font-semibold transition-all ${view==='grid'?'bg-orange-50 text-orange-600 shadow-sm':'text-muted-foreground'}`}>
                <i className="ki-filled ki-element-grid mr-1.5 text-sm" />
                Сетка
              </button>
            </div>
            <button onClick={() => setShowDrawer(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 transition-all hover:border-orange-300 hover:bg-orange-100">
              <i className="ki-filled ki-plus text-sm" />
              Новая тренировка
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {FILTER_OPTIONS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={['rounded-full border px-3 py-2 text-sm font-semibold transition-all', filter===f?'border-orange-200 bg-orange-50 text-orange-700 shadow-sm':'border-border bg-background text-muted-foreground hover:border-orange-200 hover:text-foreground'].join(' ')}>
              {f}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-background/80 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">В текущей выборке</div>
            <div className="mt-2 pf-num text-[28px] leading-none text-foreground">{filtered.length}</div>
            <div className="mt-2 text-2xs text-muted-foreground">тренировок попадает в активный фильтр</div>
          </div>
          <div className="rounded-2xl border border-border bg-background/80 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Объем</div>
            <div className="mt-2 text-xl font-semibold text-foreground">{filteredSummary.minutes ? fmtDuration(filteredSummary.minutes) : '—'}</div>
            <div className="mt-2 text-2xs text-muted-foreground">
              {filteredSummary.avgStrain != null
                ? `средняя нагрузка ${filteredSummary.avgStrain.toFixed(1)}`
                : 'добавьте нагрузку, чтобы видеть среднее значение'}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-background/80 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Контекст</div>
            <div className="mt-2 text-xl font-semibold text-foreground">{filteredSummary.withNotes}</div>
            <div className="mt-2 text-2xs text-muted-foreground">
              {filteredSummary.latestNote
                ? `записей с заметками, последняя ${fmtDate(filteredSummary.latestNote.event_date)}`
                : 'пока нет заметок в выбранной подборке'}
            </div>
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="rounded-[28px] border border-border bg-card px-6 py-16 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-orange-50 text-orange-500">
            <i className="ki-filled ki-calendar text-2xl" />
          </div>
          <div className="mt-4 text-lg font-semibold text-foreground">
            {workouts.length === 0 ? 'История тренировок пока пуста' : 'По этому фильтру тренировок пока нет'}
          </div>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {workouts.length === 0
              ? 'Добавьте первую тренировку, чтобы дневник начал собирать нагрузку, метрики и заметки по сессиям.'
              : 'Смените фильтр активности или создайте новую запись, чтобы история оставалась полной.'}
          </p>
          <div className="mt-5 flex justify-center">
            <button onClick={() => setShowDrawer(true)} className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#F97316,#EA580C)] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_22px_rgba(249,115,22,0.28)]">
              <i className="ki-filled ki-plus text-sm" />
              Добавить тренировку
            </button>
          </div>
        </div>
      ) : view === 'list' ? (
        <div className="flex flex-col gap-5">
          {groupedWorkouts.map(group => (
            <section key={group.label} className="rounded-[26px] border border-border bg-card p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Группа истории</div>
                  <div className="mt-1 text-lg font-semibold text-foreground">{group.label}</div>
                </div>
                <div className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {group.items.length} записей
                </div>
              </div>
              <div className="space-y-3">
                {group.items.map(w => {
                  const ac = ACTIVITY_CONFIG[w.activity_type ?? ''] ?? DEFAULT_AC
                  const comparison = workoutComparisons[w.id]
                  const chips = [
                    w.activity_duration_min ? fmtDuration(w.activity_duration_min) : null,
                    w.avg_heart_rate ? `${w.avg_heart_rate} уд/мин` : null,
                    w.activity_calories ? `${w.activity_calories} ккал` : null,
                  ].filter(Boolean)
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setSelectedWorkout(w)}
                      className="group flex w-full items-start gap-4 rounded-[24px] border border-border bg-background/80 p-4 text-left transition-all hover:border-orange-200 hover:bg-white hover:shadow-sm sm:p-5"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border" style={{ background:ac.bg,borderColor:ac.border }}>
                        <i className={`ki-filled ${ac.icon} text-base`} style={{ color:ac.text }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-foreground">{w.name || w.activity_type || 'Тренировка'}</span>
                          <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{fmtDate(w.event_date)}</span>
                          {w.mood != null && w.mood >= 0 && <span className="text-base leading-none">{MOODS[w.mood]}</span>}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(chips.length > 0 ? chips : ['Метрики не добавлены']).map(chip => (
                            <span key={chip} className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                              {chip}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {comparison?.previous
                              ? `Сравнение с записью ${fmtDate(comparison.previous.event_date)}`
                              : 'Сравнение по типу'}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {comparison?.previous ? (
                              comparison.cues.length > 0 ? (
                                comparison.cues.map(cue => (
                                  <span
                                    key={`${w.id}-${cue.key}`}
                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getComparisonCueClasses(cue.direction)}`}
                                  >
                                    {cue.text}
                                  </span>
                                ))
                              ) : (
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                  нет общих метрик для сравнения
                                </span>
                              )
                            ) : (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                первая запись этого типа
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 text-sm leading-6 text-muted-foreground">
                          {w.description?.trim() ? w.description : 'Откройте карточку, чтобы добавить заметки и скорректировать детали сессии.'}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {w.activity_strain != null ? (
                          <div className="rounded-2xl border border-border bg-card px-3 py-2 text-right">
                            <div className="pf-num text-[24px] leading-none" style={{ color: strainColor(Number(w.activity_strain)) }}>{Number(w.activity_strain).toFixed(1)}</div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">нагрузка</div>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            нет strain
                          </div>
                        )}
                        <i className="ki-filled ki-right text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(w => {
            const ac = ACTIVITY_CONFIG[w.activity_type ?? ''] ?? DEFAULT_AC
            const comparison = workoutComparisons[w.id]
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => setSelectedWorkout(w)}
                className="flex flex-col gap-4 rounded-[26px] border border-border bg-card p-5 text-left transition-all hover:border-orange-200 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border" style={{ background:ac.bg,borderColor:ac.border }}>
                    <i className={`ki-filled ${ac.icon} text-base`} style={{ color:ac.text }} />
                  </div>
                  <div className="flex items-center gap-2">
                    {w.mood != null && w.mood >= 0 && <span className="text-base leading-none">{MOODS[w.mood]}</span>}
                    <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{fmtDate(w.event_date)}</span>
                  </div>
                </div>
                <div>
                  <div className="text-base font-semibold text-foreground">{w.name || w.activity_type || 'Тренировка'}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[w.activity_duration_min ? fmtDuration(w.activity_duration_min) : null, w.activity_calories ? `${w.activity_calories} ккал` : null, w.avg_heart_rate ? `${w.avg_heart_rate} уд/мин` : null]
                      .filter(Boolean)
                      .map(item => (
                        <span key={item} className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                          {item}
                        </span>
                      ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-background/80 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {comparison?.previous
                      ? `Сравнение с ${fmtDate(comparison.previous.event_date)}`
                      : 'Сравнение по типу'}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {comparison?.previous ? (
                      comparison.cues.length > 0 ? (
                        comparison.cues.map(cue => (
                          <span
                            key={`${w.id}-${cue.key}`}
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getComparisonCueClasses(cue.direction)}`}
                          >
                            {cue.text}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          нет общих метрик
                        </span>
                      )
                    ) : (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        первая запись этого типа
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-background/80 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Короткий контекст</div>
                  <div className="mt-2 text-sm leading-6 text-muted-foreground">
                    {w.description?.trim() ? w.description : 'Откройте тренировку, чтобы добавить заметки и отредактировать детали.'}
                  </div>
                </div>
                <div className="flex items-end justify-between border-t border-border pt-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Нагрузка</div>
                    <div className="mt-2 pf-num text-[26px] leading-none" style={{ color: w.activity_strain != null ? strainColor(Number(w.activity_strain)) : '#94A3B8' }}>
                      {w.activity_strain != null ? Number(w.activity_strain).toFixed(1) : '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">ЧСС</div>
                    <div className="mt-2 pf-num text-[26px] leading-none text-foreground">{w.avg_heart_rate ?? '—'}</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Drawers */}
      <AddWorkoutDrawer open={showDrawer} onClose={() => setShowDrawer(false)} userId={user?.id ?? ''} onCreated={handleCreated} />

      {selectedWorkout && (
        <ViewEditDrawer workout={selectedWorkout} onClose={() => setSelectedWorkout(null)} onUpdated={handleUpdated} onDeleted={handleDeleted} />
      )}

      {showPDF && <WorkoutPDFExport onClose={() => setShowPDF(false)} />}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-foreground text-background text-sm font-medium px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 pf-enter">
          <i className="ki-filled ki-check-circle text-green-400" />Тренировка сохранена ✓
        </div>
      )}
    </div>
  )
}

export default function DiaryPage() {
  const { user } = useUser()
  return user?.role === 'coach' ? <CoachDiary /> : <AthleteDiary />
}
