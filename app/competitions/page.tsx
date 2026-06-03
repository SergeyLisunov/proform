'use client'
import { Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import {
  getCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
  EVENT_TYPES, type CalendarEvent, type EventType,
} from '@/services/calendar.service'
import { Badge } from '@/components/ui/metronic'

function parseLocalDate(s: string | null | undefined): Date {
  // Calendar events from the DB allow nullable event_date; treat null as
  // a sentinel "very old" date so sorting/filters keep producing
  // sensible UI without bespoke null branches at every call site.
  if (!s) return new Date('1970-01-01T00:00:00')
  return new Date(s + 'T00:00:00')
}
function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const WEEKDAYS_RU = ['вс','пн','вт','ср','чт','пт','сб']
const MONTHS_RU_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = parseLocalDate(s)
  return `${d.getDate()} ${MONTHS_RU_GEN[d.getMonth()]} ${d.getFullYear()}, ${WEEKDAYS_RU[d.getDay()]}`
}

function SurfaceFrame({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[28px] border border-border bg-card shadow-sm ${className}`}>
      {children}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', borderRadius: 12, border: '1.5px solid var(--border)',
  padding: '10px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  background: 'var(--background)', color: 'var(--foreground)',
}

function InfoBlock({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={labelStyle}>{label}</span>
      {multiline
        ? <p style={{ fontSize: 14, color: 'var(--foreground)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{value}</p>
        : <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>{value}</span>}
    </div>
  )
}

// ── COMPETITION DRAWER ────────────────────────────────────────────────────────
function CompetitionDrawer({
  competition, ownerId, initialDate, onClose, onCreated, onUpdated, onDeleted,
}: {
  competition?: CalendarEvent
  ownerId: string
  initialDate?: string
  onClose: () => void
  onCreated?: (e: CalendarEvent) => void
  onUpdated?: (e: CalendarEvent) => void
  onDeleted?: (id: string) => void
}) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>(competition ? 'view' : 'create')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  const today = todayISO()
  const [form, setForm] = useState({
    event_date: competition?.event_date ?? initialDate ?? today,
    title: competition?.title ?? '',
    notes: competition?.notes ?? '',
    start_time: competition?.start_time ?? '',
    end_time: competition?.end_time ?? '',
  })

  useEffect(() => {
    setMounted(true)
    const t = setTimeout(() => setVisible(true), 10)
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, []) // eslint-disable-line

  useEffect(() => {
    if (visible && mode !== 'view') setTimeout(() => titleRef.current?.focus(), 150)
  }, [visible, mode])

  function handleClose() { setVisible(false); setTimeout(onClose, 260) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Введите название'); return }
    setSaving(true); setError('')
    try {
      if (mode === 'create') {
        const r = await createCalendarEvent({
          owner_id: ownerId, event_date: form.event_date, event_type: 'competition',
          title: form.title.trim(), notes: form.notes.trim() || null,
          start_time: form.start_time || null, end_time: form.end_time || null,
        })
        if (!r) { setError('Не удалось сохранить'); return }
        onCreated?.(r)
      } else if (competition) {
        const r = await updateCalendarEvent(competition.id, {
          event_date: form.event_date, title: form.title.trim(),
          notes: form.notes.trim() || null,
          start_time: form.start_time || null, end_time: form.end_time || null,
        })
        if (!r) { setError('Не удалось обновить'); return }
        onUpdated?.(r)
      }
      handleClose()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!competition) return
    await deleteCalendarEvent(competition.id)
    onDeleted?.(competition.id)
    handleClose()
  }

  if (!mounted) return null

  return createPortal(
    <div aria-modal="true" role="dialog" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={handleClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)', transition: 'opacity 0.25s', opacity: visible ? 1 : 0 }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, height: '100%', background: 'var(--card)', boxShadow: '-8px 0 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.26s cubic-bezier(0.4,0,0.2,1)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF7ED', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ki-filled ki-medal-star" style={{ color: '#F35703', fontSize: 16 }} />
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 1 }}>Соревнование</p>
              <h2 className="pf-num" style={{ fontSize: 20, color: 'var(--foreground)', lineHeight: 1 }}>
                {mode === 'create' ? 'Добавить' : mode === 'edit' ? 'Редактировать' : (competition?.title ?? 'Соревнование')}
              </h2>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {mode === 'view' && competition && (
              <button onClick={() => setMode('edit')} className="kt-btn kt-btn-sm kt-btn-outline" style={{ gap: 6 }}>
                <i className="ki-filled ki-pencil" style={{ fontSize: 12 }} />Изменить
              </button>
            )}
            <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
              <i className="ki-filled ki-cross" style={{ fontSize: 14 }} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 24px' }}>
          {/* VIEW mode */}
          {mode === 'view' && competition && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 16, borderRadius: 14, background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                <div className="pf-num" style={{ fontSize: 28, color: '#F35703', lineHeight: 1 }}>🏆</div>
                <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}>{competition.title}</div>
                <div style={{ marginTop: 4, fontSize: 13, color: 'var(--muted-foreground)' }}>{fmtDate(competition.event_date)}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <InfoBlock label="Дата" value={fmtDate(competition.event_date)} />
                {(competition.start_time || competition.end_time) && (
                  <InfoBlock label="Время" value={[competition.start_time, competition.end_time].filter(Boolean).join(' – ')} />
                )}
              </div>
              {competition.notes && <InfoBlock label="Заметки" value={competition.notes} multiline />}

              {confirmDelete ? (
                <div style={{ padding: '14px 16px', borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#DC2626', marginBottom: 10 }}>Удалить это соревнование?</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleDelete} style={{ flex: 1, padding: '9px 0', borderRadius: 10, background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Да, удалить</button>
                    <button onClick={() => setConfirmDelete(false)} style={{ padding: '9px 14px', borderRadius: 10, background: '#F1F5F9', color: '#64748B', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Отмена</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                  <i className="ki-filled ki-trash" style={{ fontSize: 14 }} />Удалить
                </button>
              )}
            </div>
          )}

          {/* CREATE / EDIT mode */}
          {(mode === 'create' || mode === 'edit') && (
            <>
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, marginBottom: 16, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 13, color: '#DC2626' }}>
                  <i className="ki-filled ki-information-5" style={{ color: '#EF4444', flexShrink: 0 }} />{error}
                </div>
              )}
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={labelStyle}>Название *</label>
                  <input ref={titleRef} type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Весенний марафон…" style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = '#F35703')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                </div>
                <div>
                  <label style={labelStyle}>Дата</label>
                  <input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} required style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = '#F35703')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Старт</label>
                    <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = '#F35703')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                  </div>
                  <div>
                    <label style={labelStyle}>Финиш</label>
                    <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = '#F35703')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Заметки</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={4} placeholder="Дистанция, место, результат…"
                    style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit' }}
                    onFocus={e => (e.target.style.borderColor = '#F35703')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={saving} style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: saving ? '#FDA96A' : '#F35703', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'Сохранение…' : mode === 'edit' ? 'Сохранить' : 'Добавить соревнование'}
                  </button>
                  <button type="button" onClick={() => mode === 'edit' && competition ? setMode('view') : handleClose()} style={{ padding: '11px 14px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    Отмена
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── MAIN CONTENT ───────────────────────────────────────────────────────────────
function CompetitionsContent() {
  const { user } = useUser()
  const searchParams = useSearchParams()
  const today = todayISO()
  const now = new Date()

  const urlFrom = searchParams.get('from')
  const urlTo   = searchParams.get('to')

  const [competitions, setCompetitions] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [drawer, setDrawer] = useState<CalendarEvent | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // Load a 3-year window of data
  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    const y = now.getFullYear()
    getCalendarEvents(user.id, `${y - 1}-01-01`, `${y + 2}-12-31`)
      .then(evs => setCompetitions(evs.filter(e => e.event_type === 'competition')))
      .finally(() => setLoading(false))
  }, [user?.id]) // eslint-disable-line

  // Apply period filter from URL params (or show all)
  const filtered = useMemo(() => {
    // Drop competitions without an event_date upfront — every downstream
    // comparison expects a real ISO date string.
    let list = competitions.filter(c => c.event_date != null)
    if (urlFrom) list = list.filter(e => (e.event_date ?? '') >= urlFrom)
    if (urlTo)   list = list.filter(e => (e.event_date ?? '') <= urlTo)
    return list.sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''))
  }, [competitions, urlFrom, urlTo])

  const upcoming = filtered.filter(e => (e.event_date ?? '') >= today)
  const past     = filtered.filter(e => (e.event_date ?? '') < today)

  const handleCreated = useCallback((e: CalendarEvent) => {
    setCompetitions(prev => [...prev, e])
  }, [])
  const handleUpdated = useCallback((u: CalendarEvent) => {
    setCompetitions(prev => prev.map(e => e.id === u.id ? u : e))
    setDrawer(u)
  }, [])
  const handleDeleted = useCallback((id: string) => {
    setCompetitions(prev => prev.filter(e => e.id !== id))
    setDrawer(null)
  }, [])

  const periodLabel = urlFrom && urlTo
    ? `${fmtDate(urlFrom)} — ${fmtDate(urlTo)}`
    : 'Все соревнования'

  return (
    <div className="flex flex-col gap-5 pf-enter">
      {/* Header KPI */}
      <SurfaceFrame>
        <div className="bg-gradient-to-br from-orange-50 via-background to-background px-5 py-5 md:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex-1 min-w-0">
              <Badge variant="primary" className="rounded-full uppercase tracking-[0.18em]">
                Соревнования
              </Badge>
              <h2 className="mt-3 text-[clamp(1.75rem,3.5vw,2.75rem)] font-semibold tracking-tight text-foreground leading-tight">
                График стартов
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{periodLabel}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/75 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                    <i className="ki-filled ki-medal-star text-base" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Всего</p>
                    <div className="mt-1">
                      <span className="pf-num text-[clamp(1.8rem,3vw,2.45rem)] leading-none text-foreground">{filtered.length}</span>
                    </div>
                    <p className="mt-1.5 text-2xs text-muted-foreground">{urlFrom ? 'За период' : 'За 3 года'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/75 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-600">
                    <i className="ki-filled ki-arrow-up text-base" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Предстоящих</p>
                    <div className="mt-1">
                      <span className="pf-num text-[clamp(1.8rem,3vw,2.45rem)] leading-none text-foreground">{upcoming.length}</span>
                    </div>
                    <p className="mt-1.5 text-2xs text-muted-foreground">Запланировано</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/75 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
                    <i className="ki-filled ki-arrow-down text-base" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Прошедших</p>
                    <div className="mt-1">
                      <span className="pf-num text-[clamp(1.8rem,3vw,2.45rem)] leading-none text-foreground">{past.length}</span>
                    </div>
                    <p className="mt-1.5 text-2xs text-muted-foreground">Завершено</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 xl:w-[200px] xl:shrink-0">
              <button
                onClick={() => setShowCreate(true)}
                className="kt-btn kt-btn-primary gap-2"
              >
                <i className="ki-filled ki-plus text-xs" />
                Добавить старт
              </button>
              <Link href="/calendar" className="kt-btn kt-btn-outline gap-2 no-underline justify-center">
                <i className="ki-filled ki-calendar text-xs" />
                Календарь
              </Link>
            </div>
          </div>
        </div>
      </SurfaceFrame>

      {loading && (
        <div className="flex items-center gap-2 text-2xs text-muted-foreground">
          <div className="h-3 w-3 animate-spin rounded-full border border-orange-400 border-t-transparent" />
          Загрузка…
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <SurfaceFrame className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Badge variant="success" dot className="rounded-full uppercase tracking-[0.18em]">
              Предстоящие
            </Badge>
            <span className="text-2xs text-muted-foreground">{upcoming.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {upcoming.map(c => (
              <button
                key={c.id}
                onClick={() => setDrawer(c)}
                className="group flex items-center gap-4 rounded-2xl border border-orange-100 bg-orange-50/50 p-4 text-left transition-all hover:border-orange-300 hover:shadow-sm"
              >
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-orange-500 text-white">
                  <span className="pf-num text-lg leading-none">{parseLocalDate(c.event_date).getDate()}</span>
                  <span className="text-[9px] font-bold uppercase">{MONTHS_RU_GEN[parseLocalDate(c.event_date).getMonth()].slice(0,3)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{c.title}</div>
                  <div className="mt-0.5 text-2xs text-muted-foreground">{fmtDate(c.event_date)}</div>
                  {c.notes && <div className="mt-1 truncate text-[11px] text-muted-foreground">{c.notes}</div>}
                </div>
                <i className="ki-filled ki-right text-xs text-orange-400 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </SurfaceFrame>
      )}

      {/* Past */}
      {past.length > 0 && (
        <SurfaceFrame className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full uppercase tracking-[0.18em]">
              Прошедшие
            </Badge>
            <span className="text-2xs text-muted-foreground">{past.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {[...past].reverse().map(c => (
              <button
                key={c.id}
                onClick={() => setDrawer(c)}
                className="group flex items-center gap-4 rounded-2xl border border-border bg-background/60 p-4 text-left transition-all hover:border-orange-200 hover:shadow-sm"
              >
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <span className="pf-num text-lg leading-none">{parseLocalDate(c.event_date).getDate()}</span>
                  <span className="text-[9px] font-bold uppercase">{MONTHS_RU_GEN[parseLocalDate(c.event_date).getMonth()].slice(0,3)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground/80">{c.title}</div>
                  <div className="mt-0.5 text-2xs text-muted-foreground">{fmtDate(c.event_date)}</div>
                  {c.notes && <div className="mt-1 truncate text-[11px] text-muted-foreground">{c.notes}</div>}
                </div>
                <i className="ki-filled ki-right text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </SurfaceFrame>
      )}

      {!loading && filtered.length === 0 && (
        <SurfaceFrame className="p-12">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
              <i className="ki-filled ki-medal-star text-3xl" />
            </div>
            <p className="mt-4 text-base font-semibold text-foreground">Нет соревнований</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Добавьте первый старт, чтобы отслеживать результаты и готовиться к соревнованиям.
            </p>
            <button onClick={() => setShowCreate(true)} className="mt-5 kt-btn kt-btn-primary gap-2">
              <i className="ki-filled ki-plus text-xs" />Добавить старт
            </button>
          </div>
        </SurfaceFrame>
      )}

      {drawer && (
        <CompetitionDrawer
          competition={drawer}
          ownerId={user!.id}
          onClose={() => setDrawer(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
      {showCreate && (
        <CompetitionDrawer
          ownerId={user!.id}
          initialDate={today}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}

export default function CompetitionsPage() {
  return (
    <Suspense fallback={<div className="flex items-center gap-2 p-8 text-muted-foreground"><div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />Загрузка…</div>}>
      <CompetitionsContent />
    </Suspense>
  )
}
