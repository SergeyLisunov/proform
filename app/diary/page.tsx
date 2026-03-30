'use client'
import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { useUser } from '@/lib/hooks/useUser'
import { DEMO_DIARY, RISK_COLORS } from '@/lib/utils/data'
import { getWorkouts, createWorkout } from '@/services/workouts.service'
import type { Workout } from '@/services/workouts.service'

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

// ── Coach Observation Diary ────────────────────────────────────────────────────
function CoachDiary() {
  const [riskFilter, setRiskFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)

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
          <i className="ki-filled ki-plus text-sm" />
          Новая запись
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Всего записей', value: DEMO_DIARY.length, bg: 'bg-blue-50 text-blue-600', icon: 'ki-book-open' },
          { label: 'Высокий риск',  value: DEMO_DIARY.filter(d => d.risk === 'high' || d.risk === 'critical').length, bg: 'bg-red-50 text-red-500', icon: 'ki-warning-2' },
          { label: 'Умеренный',     value: DEMO_DIARY.filter(d => d.risk === 'moderate').length, bg: 'bg-orange-50 text-orange-500', icon: 'ki-information-2' },
          { label: 'В норме',       value: DEMO_DIARY.filter(d => d.risk === 'low').length, bg: 'bg-green-50 text-green-600', icon: 'ki-check-circle' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
              <i className={`ki-filled ${s.icon} text-base`} />
            </div>
            <div>
              <div className="pf-num text-2xl text-foreground">{s.value}</div>
              <div className="text-2xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {RISK_FILTER.map(f => (
            <button key={f} onClick={() => setRiskFilter(f)}
              className={[
                'px-2.5 py-1.5 rounded-lg text-2sm font-medium border transition-all capitalize',
                riskFilter === f ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-card border-border text-muted-foreground hover:border-orange-200',
              ].join(' ')}
            >
              {f === 'all' ? 'Все риски' : f}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap ml-auto">
          {CATEGORY_FILTER.map(f => (
            <button key={f} onClick={() => setCatFilter(f)}
              className={[
                'px-2.5 py-1.5 rounded-lg text-2sm font-medium border transition-all capitalize',
                catFilter === f ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-card border-border text-muted-foreground hover:border-blue-200',
              ].join(' ')}
            >
              {f === 'all' ? 'Все категории' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Entries */}
      <div className="flex flex-col gap-3">
        {filtered.map((entry, i) => {
          const rc = RISK_COLORS[entry.risk as keyof typeof RISK_COLORS]
          return (
            <div key={i} className="bg-card border border-border rounded-xl p-5 hover:border-orange-200 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-foreground">{entry.title}</span>
                    <span className="text-2xs font-bold px-2 py-0.5 rounded-full border" style={{ background: rc.bg, color: rc.text, borderColor: rc.border }}>
                      <i className={`ki-filled ${rc.icon} mr-1 text-[10px]`} />
                      {entry.risk.charAt(0).toUpperCase() + entry.risk.slice(1)} риск
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-border/60 text-muted-foreground capitalize">
                      {entry.category}
                    </span>
                  </div>
                  <div className="text-2xs text-muted-foreground">{entry.date} · Sara Kowalski</div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button className="kt-btn kt-btn-xs kt-btn-icon kt-btn-ghost"><i className="ki-filled ki-pencil text-xs text-muted-foreground" /></button>
                </div>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed mb-3">{entry.note}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {entry.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded-full text-2xs font-medium bg-accent border border-border text-muted-foreground">#{tag}</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* New Entry Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="pf-num text-xl text-foreground">Новая запись в дневник</h3>
              <button onClick={() => setShowForm(false)} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
                <i className="ki-filled ki-cross text-sm" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Заголовок</label>
                <input className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400" placeholder="Заголовок наблюдения..." />
              </div>
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Заметка</label>
                <textarea rows={4} className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400 resize-none" placeholder="Подробное наблюдение..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Уровень риска</label>
                  <select className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400">
                    {['low','moderate','high','critical'].map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Категория</label>
                  <select className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-orange-400">
                    {['performance','health','motivation','technique','tactical'].map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
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

// ── Athlete Training Diary ────────────────────────────────────────────────────
function AthleteDiary() {
  const { user } = useUser()
  const [filter, setFilter] = useState('Все')
  const [view, setView] = useState<'list'|'grid'>('list')
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [showDrawer, setShowDrawer] = useState(false)
  const [toast, setToast] = useState(false)

  useEffect(() => {
    if (!user) return
    getWorkouts(user.id).then(data => {
      setWorkouts(data)
      setLoading(false)
    })
  }, [user])

  const filtered = filter === 'Все'
    ? workouts
    : workouts.filter(w => (w.activity_type ?? 'Другое') === filter)

  function handleCreated(w: Workout) {
    setWorkouts(prev => [w, ...prev])
    setShowDrawer(false)
    setToast(true)
    setTimeout(() => setToast(false), 3000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 pf-enter">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">История тренировок</p>
          <h2 className="pf-num text-[36px] text-foreground leading-none">Мой дневник</h2>
        </div>
        <button onClick={() => setShowDrawer(true)} className="kt-btn kt-btn-primary gap-2">
          <i className="ki-filled ki-plus text-sm" />
          Новая тренировка
        </button>
      </div>

      {/* Filters + view toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTER_OPTIONS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={[
              'px-3 py-1.5 rounded-lg text-2sm font-medium border transition-all',
              filter === f ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-card border-border text-muted-foreground hover:border-orange-200',
            ].join(' ')}
          >
            {f}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 p-1 bg-card border border-border rounded-lg">
          <button onClick={() => setView('list')} className={`px-2.5 py-1.5 rounded-md transition-all ${view==='list'?'bg-orange-50 text-orange-600':'text-muted-foreground'}`}>
            <i className="ki-filled ki-row-horizontal text-sm" />
          </button>
          <button onClick={() => setView('grid')} className={`px-2.5 py-1.5 rounded-md transition-all ${view==='grid'?'bg-orange-50 text-orange-600':'text-muted-foreground'}`}>
            <i className="ki-filled ki-element-grid text-sm" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl px-5 py-16 text-center">
          <i className="ki-filled ki-calendar text-3xl text-slate-300 mb-3 block" />
          <p className="text-muted-foreground text-2sm">Тренировок пока нет. Создайте первую!</p>
        </div>
      ) : view === 'list' ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map(w => {
              const ac = ACTIVITY_CONFIG[w.activity_type ?? ''] ?? DEFAULT_AC
              const meta = [
                w.activity_duration_min && `${w.activity_duration_min} мин`,
                w.avg_heart_rate && `${w.avg_heart_rate} уд/мин`,
                w.activity_calories && `${w.activity_calories} ккал`,
              ].filter(Boolean).join(' · ')
              return (
                <div key={w.id} className="flex items-center gap-4 px-5 py-4 hover:bg-accent/40 transition-colors cursor-pointer group">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border" style={{ background: ac.bg, borderColor: ac.border }}>
                    <i className={`ki-filled ${ac.icon} text-sm`} style={{ color: ac.text }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{w.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-2xs font-medium bg-border/60 text-muted-foreground">{w.event_date}</span>
                      {w.mood && <span className="text-base leading-none">{w.mood}</span>}
                    </div>
                    {meta && <div className="text-2xs text-muted-foreground mt-0.5">{meta}</div>}
                  </div>
                  {w.activity_strain != null && (
                    <div className="text-right shrink-0">
                      <div className="pf-num text-xl leading-none text-foreground">{w.activity_strain}</div>
                      <div className="text-2xs text-muted-foreground">нагрузка</div>
                    </div>
                  )}
                  <i className="ki-filled ki-right text-muted-foreground text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(w => {
            const ac = ACTIVITY_CONFIG[w.activity_type ?? ''] ?? DEFAULT_AC
            return (
              <div key={w.id} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-orange-200 hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center border" style={{ background: ac.bg, borderColor: ac.border }}>
                    <i className={`ki-filled ${ac.icon} text-sm`} style={{ color: ac.text }} />
                  </div>
                  <div className="flex items-center gap-2">
                    {w.mood && <span className="text-base leading-none">{w.mood}</span>}
                    <span className="text-2xs font-medium text-muted-foreground">{w.event_date}</span>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{w.name}</div>
                  <div className="text-2xs text-muted-foreground mt-0.5">
                    {[w.activity_duration_min && `${w.activity_duration_min} мин`, w.activity_calories && `${w.activity_calories} ккал`].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {(w.activity_strain != null || w.avg_heart_rate != null) && (
                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    {w.activity_strain != null && (
                      <div>
                        <div className="pf-num text-xl text-foreground leading-none">{w.activity_strain}</div>
                        <div className="text-2xs text-muted-foreground">нагрузка</div>
                      </div>
                    )}
                    {w.avg_heart_rate != null && (
                      <div className="text-right">
                        <div className="pf-num text-xl text-foreground leading-none">{w.avg_heart_rate}</div>
                        <div className="text-2xs text-muted-foreground">уд/мин</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <AddWorkoutDrawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        userId={user?.id ?? ''}
        onCreated={handleCreated}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-foreground text-background text-sm font-medium px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 pf-enter">
          <i className="ki-filled ki-check-circle text-green-400" />
          Тренировка сохранена ✓
        </div>
      )}
    </div>
  )
}

// ── Add Workout Drawer ─────────────────────────────────────────────────────────
function AddWorkoutDrawer({
  open, onClose, userId, onCreated,
}: {
  open: boolean
  onClose: () => void
  userId: string
  onCreated: (w: Workout) => void
}) {
  const [mounted, setMounted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof DrawerForm, string>>>({})
  const [form, setForm] = useState<DrawerForm>(EMPTY_FORM)

  useEffect(() => { setMounted(true) }, [])

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_FORM, event_date: new Date().toISOString().slice(0, 10) })
      setErrors({})
    }
  }, [open])

  function validate(): boolean {
    const e: Partial<Record<keyof DrawerForm, string>> = {}
    if (!form.name.trim()) e.name = 'Название обязательно'
    if (!form.event_date) e.event_date = 'Дата обязательна'
    if (form.activity_strain < 0 || form.activity_strain > 21) e.activity_strain = 'Нагрузка: 0–21'
    if (form.avg_heart_rate && Number(form.avg_heart_rate) <= 0) e.avg_heart_rate = 'ЧСС должен быть > 0'
    if (form.max_heart_rate && Number(form.max_heart_rate) <= 0) e.max_heart_rate = 'ЧСС должен быть > 0'
    if (form.activity_calories && Number(form.activity_calories) <= 0) e.activity_calories = 'Калории должны быть > 0'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
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
      mood: form.mood || null,
    })
    setSaving(false)
    if (workout) onCreated(workout)
  }

  if (!mounted || !open) return null

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex' }}>
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.65)' }}
        onClick={onClose}
      />
      {/* Panel */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        height: '100%',
        width: 480,
        maxWidth: '100vw',
        background: 'var(--card)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          background: 'var(--card)',
          zIndex: 1,
        }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              Новая тренировка
            </p>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
              Добавить запись
            </h3>
          </div>
          <button onClick={onClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
            <i className="ki-filled ki-cross text-sm" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── Секция 1: Основное ── */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              Основное
            </p>

            {/* Activity type grid 2×3 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
              {FORM_ACTIVITY_TYPES.map(at => {
                const ac = ACTIVITY_CONFIG[at.value] ?? DEFAULT_AC
                const selected = form.activity_type === at.value
                return (
                  <button
                    key={at.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, activity_type: at.value }))}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      padding: '10px 8px',
                      borderRadius: 12,
                      border: `1.5px solid ${selected ? ac.border : 'var(--border)'}`,
                      background: selected ? ac.bg : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <i className={`ki-filled ${at.icon} text-base`} style={{ color: selected ? ac.text : 'var(--muted-foreground)' }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: selected ? ac.text : 'var(--muted-foreground)' }}>{at.value}</span>
                  </button>
                )
              })}
            </div>

            {/* Name */}
            <div style={{ marginBottom: 12 }}>
              <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Название *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Например: Утренняя пробежка"
                className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400"
              />
              {errors.name && <p className="text-2xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            {/* Date + Start time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Дата *</label>
                <input
                  type="date"
                  value={form.event_date}
                  onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                  className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                />
                {errors.event_date && <p className="text-2xs text-red-500 mt-1">{errors.event_date}</p>}
              </div>
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Начало</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                  className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Длительность (мин)
              </label>
              <input
                type="number"
                min="1"
                value={form.activity_duration_min}
                onChange={e => setForm(f => ({ ...f, activity_duration_min: e.target.value }))}
                placeholder="60"
                className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400"
              />
            </div>
          </div>

          {/* ── Секция 2: Метрики ── */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              Метрики
            </p>

            {/* Strain slider */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">Нагрузка (0–21)</label>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span className="text-2xs text-muted-foreground">Отдых</span>
                <span className="text-2xs text-muted-foreground">Максимум</span>
              </div>
              {errors.activity_strain && <p className="text-2xs text-red-500 mt-1">{errors.activity_strain}</p>}
            </div>

            {/* HR + Calories */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Ср. ЧСС</label>
                <input
                  type="number"
                  min="1"
                  value={form.avg_heart_rate}
                  onChange={e => setForm(f => ({ ...f, avg_heart_rate: e.target.value }))}
                  placeholder="150"
                  className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                />
                {errors.avg_heart_rate && <p className="text-2xs text-red-500 mt-1">{errors.avg_heart_rate}</p>}
              </div>
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Макс. ЧСС</label>
                <input
                  type="number"
                  min="1"
                  value={form.max_heart_rate}
                  onChange={e => setForm(f => ({ ...f, max_heart_rate: e.target.value }))}
                  placeholder="185"
                  className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                />
                {errors.max_heart_rate && <p className="text-2xs text-red-500 mt-1">{errors.max_heart_rate}</p>}
              </div>
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Калории</label>
                <input
                  type="number"
                  min="1"
                  value={form.activity_calories}
                  onChange={e => setForm(f => ({ ...f, activity_calories: e.target.value }))}
                  placeholder="500"
                  className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                />
                {errors.activity_calories && <p className="text-2xs text-red-500 mt-1">{errors.activity_calories}</p>}
              </div>
            </div>

            {/* Mood */}
            <div style={{ marginTop: 16 }}>
              <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Самочувствие</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {MOODS.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, mood: f.mood === m ? '' : m }))}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      border: `1.5px solid ${form.mood === m ? '#fb923c' : 'var(--border)'}`,
                      background: form.mood === m ? 'rgba(251,146,60,0.08)' : 'transparent',
                      fontSize: 20,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Секция 3: Заметки ── */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              Заметки
            </p>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={4}
              placeholder="Ощущения, условия, наблюдения…"
              className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400 resize-none"
            />
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: 8, paddingBottom: 8 }}>
            <button type="submit" disabled={saving} className="flex-1 kt-btn kt-btn-primary">
              {saving ? 'Сохранение…' : 'Сохранить тренировку'}
            </button>
            <button type="button" onClick={onClose} className="kt-btn kt-btn-outline">
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export default function DiaryPage() {
  const { user } = useUser()
  return user?.role === 'coach' ? <CoachDiary /> : <AthleteDiary />
}
