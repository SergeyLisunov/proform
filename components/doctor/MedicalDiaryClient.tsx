'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useDialog } from '@/lib/hooks/useDialog'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/metronic'
import { useDictation } from '@/hooks/useDictation'
import {
  listMedicalEntries, createMedicalEntry, updateMedicalEntry, deleteMedicalEntry,
  toggleShareWithAthlete, toggleShareWithCoach,
  getMedicalHeatmap, listMyPatients, getPatientSnapshot,
  MED_TYPE_META, SEVERITY_LABELS, MOOD_EMOJI, BODY_PARTS_RU,
  type MedicalEntry, type MedicalEntryType, type MedicalSeverity,
  type DoctorPatient, type PatientSnapshot,
  type Vitals, type PrescriptionItem, type LabTest,
  type MedicalAttachment,
} from '@/services/medical-diary.service'
import { DiaryHeatmap } from '@/components/coach/DiaryHeatmap'

const ENTRY_TYPES: MedicalEntryType[] = [
  'consultation', 'rehab_progress', 'prescription', 'lab_results',
  'nutrition_plan', 'injury_note', 'observation', 'schedule',
]
const SEVERITIES: MedicalSeverity[] = ['low', 'moderate', 'high', 'critical']
const BODY_PART_KEYS = Object.keys(BODY_PARTS_RU)

const MAX_ATTACH_FILES = 5
const MAX_IMG = 10 * 1024 * 1024
const MAX_DOC = 20 * 1024 * 1024

function todayISO() { return new Date().toISOString().slice(0, 10) }
function weekAgoISO() { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10) }
function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'short', weekday: 'short',
  })
}
function fmtSize(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} КБ`
  return `${(b / 1024 / 1024).toFixed(1)} МБ`
}

// ════════════════════════════════════════════════════════════════════════

export default function MedicalDiaryClient({ doctorId }: { doctorId: string }) {
  const { confirm } = useDialog()
  const [entries, setEntries] = useState<MedicalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [heatmap, setHeatmap] = useState<Record<string, number>>({})
  const [patients, setPatients] = useState<DoctorPatient[]>([])

  const [typeFilter,      setTypeFilter]     = useState<MedicalEntryType | 'all'>('all')
  const [severityFilter,  setSeverityFilter] = useState<MedicalSeverity | 'all'>('all')
  const [patientFilter,   setPatientFilter]  = useState<string | 'all'>('all')

  const [editing,  setEditing]  = useState<MedicalEntry | null>(null)
  const [creating, setCreating] = useState(false)

  const [snapshot, setSnapshot] = useState<PatientSnapshot | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)

  // Load patients once.
  useEffect(() => {
    listMyPatients(doctorId).then(setPatients)
  }, [doctorId])

  const patientById = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of patients) m.set(p.id, p.name)
    return m
  }, [patients])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, heat] = await Promise.all([
        listMedicalEntries({
          doctorId,
          entryType: typeFilter,
          severity:  severityFilter,
          athleteId: patientFilter === 'all' ? undefined : patientFilter,
        }),
        getMedicalHeatmap(doctorId, 12),
      ])
      setEntries(list)
      setHeatmap(heat)
    } finally { setLoading(false) }
  }, [doctorId, typeFilter, severityFilter, patientFilter])

  useEffect(() => { load() }, [load])

  // When a patient is selected — pull snapshot.
  useEffect(() => {
    if (patientFilter === 'all') { setSnapshot(null); return }
    setSnapshotLoading(true)
    getPatientSnapshot(patientFilter)
      .then(setSnapshot)
      .finally(() => setSnapshotLoading(false))
  }, [patientFilter])

  const counts = useMemo(() => {
    const byType: Record<MedicalEntryType, number> = {
      consultation: 0, rehab_progress: 0, prescription: 0, lab_results: 0,
      nutrition_plan: 0, injury_note: 0, observation: 0, schedule: 0,
    }
    let critical = 0, high = 0, upcoming = 0
    const today = todayISO()
    for (const e of entries) {
      byType[e.entry_type]++
      if (e.severity === 'critical') critical++
      else if (e.severity === 'high') high++
      if (e.entry_type === 'schedule' && e.date >= today) upcoming++
    }
    return { byType, critical, high, upcoming, total: entries.length }
  }, [entries])

  const pdfHref = `/diary/export?from=${weekAgoISO()}&to=${todayISO()}${patientFilter !== 'all' ? `&athlete=${patientFilter}` : ''}`

  return (
    <div className="flex flex-col gap-5 pf-enter">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-[#FECACA] bg-gradient-to-br from-[#FEF2F2] via-white to-[#EFF6FF] p-6 md:p-8">
        <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-red-200/40 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FECACA] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
              <i className="ki-filled ki-heart-circle text-[11px]" />
              Медицинский журнал
            </span>
            <h1 className="pf-num text-3xl md:text-4xl leading-tight text-navy-500 mt-2">Дневник врача</h1>
            <p className="max-w-2xl text-sm md:text-base text-muted-foreground mt-1">
              Консультации, реабилитация, анализы, рецепты и плановые приёмы.
              Под рукой — вся картина по пациенту: тренировки, метрики восстановления,
              травмы и осмотры.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={pdfHref} target="_blank"
              className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-muted">
              <i className="ki-filled ki-printer text-xs mr-1" />
              Экспорт PDF
            </Link>
            <button onClick={() => { setCreating(true); setEditing(null) }}
              className="rounded-xl bg-red-500 text-white px-5 py-2.5 text-sm font-semibold hover:bg-red-600">
              <i className="ki-filled ki-plus text-xs mr-1" />
              Новая запись
            </button>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <DiaryHeatmap data={heatmap} weeks={12} />

      {/* Type tiles */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-2">
        {ENTRY_TYPES.slice(0, 5).map(t => (
          <TypeTile key={t} type={t} count={counts.byType[t]}
            active={typeFilter === t}
            onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)} />
        ))}
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-2">
        {ENTRY_TYPES.slice(5).map(t => (
          <TypeTile key={t} type={t} count={counts.byType[t]}
            active={typeFilter === t}
            onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)} />
        ))}
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#B91C1C]">Критические</div>
          <div className="pf-num text-2xl mt-1 text-[#B91C1C]">{counts.critical + counts.high}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <i className="ki-filled ki-calendar-tick text-lg text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Приёмов впереди</span>
          </div>
          <div className="pf-num text-2xl mt-1 text-foreground">{counts.upcoming}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap rounded-xl bg-muted/20 border border-border p-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Тяжесть:</span>
        <FilterPill active={severityFilter === 'all'} onClick={() => setSeverityFilter('all')}>Все</FilterPill>
        {SEVERITIES.map(s => (
          <FilterPill key={s}
            active={severityFilter === s}
            color={SEVERITY_LABELS[s].color}
            bg={SEVERITY_LABELS[s].bg}
            border={SEVERITY_LABELS[s].border}
            onClick={() => setSeverityFilter(severityFilter === s ? 'all' : s)}>
            {SEVERITY_LABELS[s].ru}
          </FilterPill>
        ))}
        {patients.length > 0 && (
          <>
            <div className="mx-2 h-4 w-px bg-border" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Пациент:</span>
            <select value={patientFilter}
              onChange={e => setPatientFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs">
              <option value="all">Все</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </>
        )}
      </div>

      {/* Patient snapshot panel */}
      {patientFilter !== 'all' && (
        <PatientSnapshotPanel
          name={patientById.get(patientFilter) ?? '—'}
          snapshot={snapshot}
          loading={snapshotLoading}
        />
      )}

      {/* Entries list */}
      <div className="flex flex-col gap-3">
        {loading && entries.length === 0 ? (
          <Card className="p-10 text-center text-xs text-muted-foreground">
            Загрузка журнала…
          </Card>
        ) : entries.length === 0 ? (
          <EmptyState onCreate={() => { setCreating(true); setEditing(null) }} />
        ) : (
          entries.map(e => (
            <EntryCard key={e.id} entry={e}
              patientName={e.athlete_id ? patientById.get(e.athlete_id) ?? '—' : null}
              onEdit={() => { setEditing(e); setCreating(false) }}
              onToggleShare={async () => {
                await toggleShareWithAthlete(e.id, !e.is_shared_with_athlete)
                load()
              }}
              onToggleShareCoach={async () => {
                await toggleShareWithCoach(e.id, !e.is_shared_with_coach)
                load()
              }}
              onDelete={async () => {
                if (!(await confirm('Удалить запись? Связанное событие в календаре тоже удалится.'))) return
                await deleteMedicalEntry(e.id)
                load()
              }}
            />
          ))
        )}
      </div>

      {(creating || editing) && (
        <EntryDrawer
          doctorId={doctorId}
          patients={patients}
          initialPatientId={patientFilter !== 'all' ? patientFilter : undefined}
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={() => { setCreating(false); setEditing(null); load() }}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════

function TypeTile({
  type, count, active, onClick,
}: {
  type: MedicalEntryType
  count: number
  active: boolean
  onClick: () => void
}) {
  const meta = MED_TYPE_META[type]
  return (
    <button onClick={onClick}
      className={`rounded-xl border p-3 text-left transition-all ${active ? 'ring-2 ring-offset-1' : 'hover:-translate-y-0.5 hover:shadow-sm'}`}
      style={{ borderColor: meta.border, background: meta.bg, ...(active ? { boxShadow: `0 0 0 2px ${meta.color}` } : {}) }}>
      <div className="flex items-center gap-2">
        <i className={`ki-filled ${meta.icon} text-lg`} style={{ color: meta.color }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
          {meta.label}
        </span>
      </div>
      <div className="pf-num text-2xl mt-1" style={{ color: meta.color }}>{count}</div>
    </button>
  )
}

function FilterPill({
  active, onClick, color, bg, border, children,
}: {
  active: boolean; onClick: () => void
  color?: string; bg?: string; border?: string
  children: React.ReactNode
}) {
  const style = active && bg && border && color ? { background: bg, color, borderColor: border } : undefined
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
        active ? (style ? '' : 'bg-red-50 border-red-200 text-red-600')
               : 'bg-card border-border text-muted-foreground hover:border-red-200'
      }`}
      style={style}>
      {children}
    </button>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 p-12 text-center">
      <i className="ki-filled ki-heart-circle text-5xl text-muted-foreground/40 block mb-3" />
      <h3 className="text-base font-semibold text-navy-500">Пока нет записей</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Записывайте консультации, назначения, прогресс реабилитации — всё в одном месте.
      </p>
      <button onClick={onCreate}
        className="rounded-xl bg-red-500 text-white px-5 py-2.5 text-sm font-semibold hover:bg-red-600">
        Первая запись →
      </button>
    </div>
  )
}

// ── Patient snapshot (aggregated context) ──────────────────────────────────

function PatientSnapshotPanel({
  name, snapshot, loading,
}: {
  name: string
  snapshot: PatientSnapshot | null
  loading: boolean
}) {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-700">Карточка пациента</p>
          <h3 className="text-lg font-semibold text-navy-500">{name}</h3>
        </div>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-muted-foreground">Загрузка данных пациента…</div>
      ) : !snapshot ? null : (
        <>
          {/* Recovery / strain summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <Metric label="Ср. восстановление (7д)"
              value={snapshot.avg_recovery_7d != null ? `${snapshot.avg_recovery_7d}%` : '—'} />
            <Metric label="Ср. нагрузка (strain, 7д)"
              value={snapshot.avg_strain_7d != null ? String(snapshot.avg_strain_7d) : '—'} />
            <Metric label="Активные травмы" value={String(snapshot.active_injuries.length)}
              highlight={snapshot.active_injuries.length > 0 ? '#DC2626' : undefined} />
            <Metric label="Осмотры (90д)" value={String(snapshot.recent_checkups.length)} />
          </div>

          {/* Active injuries */}
          {snapshot.active_injuries.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-red-700 mb-1.5">Активные травмы</p>
              <div className="flex flex-wrap gap-1.5">
                {snapshot.active_injuries.map(inj => (
                  <span key={inj.id} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px]">
                    <strong>{BODY_PARTS_RU[inj.body_part] ?? inj.body_part}</strong>
                    {inj.side !== 'n/a' ? ` · ${inj.side === 'left' ? 'левая' : inj.side === 'right' ? 'правая' : 'обе'}` : ''}
                    {' · '}
                    <span className="text-red-700 font-semibold">{inj.severity === 'severe' ? 'тяжёлая' : inj.severity === 'moderate' ? 'средняя' : 'лёгкая'}</span>
                    {' · с '}
                    {inj.onset_date}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent workouts */}
          {snapshot.recent_workouts.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Последние тренировки
              </p>
              <div className="flex flex-wrap gap-1.5">
                {snapshot.recent_workouts.slice(0, 6).map(w => (
                  <span key={w.id} className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px]">
                    {fmtDate(w.event_date)} ·{' '}
                    <strong>{w.name ?? w.activity_type ?? 'тренировка'}</strong>
                    {w.activity_duration_min ? ` · ${w.activity_duration_min} мин` : ''}
                    {w.activity_strain ? ` · strain ${w.activity_strain}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent checkups */}
          {snapshot.recent_checkups.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                История осмотров
              </p>
              <div className="flex flex-wrap gap-1.5">
                {snapshot.recent_checkups.slice(0, 5).map(c => (
                  <span key={c.id}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${
                      c.status === 'completed' ? 'border-green-200 bg-green-50' : 'border-border bg-background'
                    }`}>
                    {c.checkup_date} · {c.checkup_type}
                    {c.status === 'completed' ? <i className="ki-filled ki-check text-[11px] text-green-600 ml-1" /> : null}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-2.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="pf-num text-xl font-bold" style={{ color: highlight ?? 'inherit' }}>{value}</div>
    </div>
  )
}

// ── Entry card ─────────────────────────────────────────────────────────────

function EntryCard({
  entry, patientName, onEdit, onDelete, onToggleShare, onToggleShareCoach,
}: {
  entry: MedicalEntry
  patientName: string | null
  onEdit: () => void
  onDelete: () => void
  onToggleShare: () => void
  onToggleShareCoach: () => void
}) {
  const meta = MED_TYPE_META[entry.entry_type]
  const sev = entry.severity ? SEVERITY_LABELS[entry.severity] : null

  return (
    <Card className="p-5 hover:border-red-200 transition-all">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
          <i className={`ki-filled ${meta.icon} text-lg`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">
              {entry.title || meta.label}
            </span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
              {meta.label}
            </span>
            {sev && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}>
                {sev.ru}
              </span>
            )}
            {entry.body_part && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-border/60 text-muted-foreground">
                {BODY_PARTS_RU[entry.body_part] ?? entry.body_part}
              </span>
            )}
            {entry.pain_level != null && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${entry.pain_level >= 7 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
                Боль {entry.pain_level}/10
              </span>
            )}
            {entry.calendar_event_id && (
              <Link href="/calendar"
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 inline-flex items-center gap-1 hover:bg-green-100">
                <i className="ki-filled ki-calendar-tick text-[10px]" />
                В календаре
              </Link>
            )}
            {entry.is_shared_with_athlete && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
                <i className="ki-filled ki-eye text-[10px]" />
                Видит пациент
              </span>
            )}
            {entry.is_shared_with_coach && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 inline-flex items-center gap-1">
                <i className="ki-filled ki-people text-[10px]" />
                Видит тренер
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {fmtDate(entry.date)}
            {patientName ? ` · ${patientName}` : ''}
            {entry.mood ? ` · ${MOOD_EMOJI[entry.mood - 1]}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {entry.athlete_id && (
            <>
              <button onClick={onToggleShare}
                className="kt-btn kt-btn-xs kt-btn-icon kt-btn-ghost"
                title={entry.is_shared_with_athlete ? 'Скрыть от пациента' : 'Поделиться с пациентом'}>
                <i className={`ki-filled ${entry.is_shared_with_athlete ? 'ki-eye' : 'ki-eye-slash'} text-xs ${entry.is_shared_with_athlete ? 'text-blue-500' : 'text-muted-foreground'}`} />
              </button>
              <button onClick={onToggleShareCoach}
                className="kt-btn kt-btn-xs kt-btn-icon kt-btn-ghost"
                title={entry.is_shared_with_coach ? 'Скрыть от тренера' : 'Передать тренеру (ограничение)'}>
                <i className={`ki-filled ki-people text-xs ${entry.is_shared_with_coach ? 'text-orange-500' : 'text-muted-foreground'}`} />
              </button>
            </>
          )}
          <button onClick={onEdit} className="kt-btn kt-btn-xs kt-btn-icon kt-btn-ghost" title="Редактировать">
            <i className="ki-filled ki-pencil text-xs text-muted-foreground" />
          </button>
          <button onClick={onDelete} className="kt-btn kt-btn-xs kt-btn-icon kt-btn-ghost hover:!bg-red-50" title="Удалить">
            <i className="ki-filled ki-trash text-xs text-red-500" />
          </button>
        </div>
      </div>

      <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{entry.note}</p>

      {/* Vitals */}
      {entry.vitals && (
        <VitalsRow v={entry.vitals} />
      )}

      {/* Prescription list */}
      {entry.entry_type === 'prescription' && entry.prescription_data?.medications && entry.prescription_data.medications.length > 0 && (
        <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50/50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-700 mb-1.5">Назначения</p>
          <ul className="text-[12px] space-y-0.5">
            {entry.prescription_data.medications.map((m, i) => (
              <li key={i}>
                <strong>{m.name}</strong>
                {m.dose ? `, ${m.dose}` : ''}
                {m.frequency ? ` — ${m.frequency}` : ''}
                {m.duration ? `, ${m.duration}` : ''}
                {m.notes ? ` (${m.notes})` : ''}
              </li>
            ))}
          </ul>
          {entry.prescription_data.warnings && (
            <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-red-700"><i className="ki-filled ki-information-2 text-[11px]" />{entry.prescription_data.warnings}</p>
          )}
        </div>
      )}

      {/* Lab results */}
      {entry.entry_type === 'lab_results' && entry.lab_data?.tests && entry.lab_data.tests.length > 0 && (
        <div className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50/40 p-3 overflow-x-auto">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-700 mb-1.5">
            Результаты{entry.lab_data.lab_name ? ` · ${entry.lab_data.lab_name}` : ''}
          </p>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] text-muted-foreground uppercase">
                <th className="py-1 pr-3">Показатель</th><th className="py-1 pr-3">Значение</th>
                <th className="py-1 pr-3">Норма</th><th className="py-1">Флаг</th>
              </tr>
            </thead>
            <tbody>
              {entry.lab_data.tests.map((t, i) => (
                <tr key={i} className="border-t border-cyan-100">
                  <td className="py-1 pr-3">{t.name}</td>
                  <td className="py-1 pr-3 font-semibold">{t.value ?? '—'} {t.unit}</td>
                  <td className="py-1 pr-3 text-muted-foreground">{t.reference ?? '—'}</td>
                  <td className="py-1">
                    {t.flag === 'normal' && <span className="text-green-600">норма</span>}
                    {t.flag === 'low' && <span className="text-orange-600">низко</span>}
                    {t.flag === 'high' && <span className="text-orange-600">высоко</span>}
                    {t.flag === 'critical' && <span className="text-red-700 font-bold">крит.</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rehab progress */}
      {entry.entry_type === 'rehab_progress' && entry.rehab_data && (
        <RehabRow r={entry.rehab_data} />
      )}

      {/* Schedule details */}
      {entry.entry_type === 'schedule' && entry.schedule_data && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {entry.schedule_data.start_time && <Metric label="Начало"       value={entry.schedule_data.start_time} />}
          {entry.schedule_data.end_time   && <Metric label="Конец"        value={entry.schedule_data.end_time} />}
          {entry.schedule_data.duration_min && <Metric label="Длительность" value={`${entry.schedule_data.duration_min} мин`} />}
          {entry.schedule_data.location   && <Metric label="Место"        value={entry.schedule_data.location} />}
        </div>
      )}

      {/* Attachments */}
      {entry.attachments && entry.attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {entry.attachments.map((att, i) => (
            <a key={i} href={att.url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 hover:border-red-300 hover:bg-red-50 transition-colors"
              title={att.name}>
              <i className={`ki-filled ${att.type === 'image' ? 'ki-picture' : 'ki-document'} text-muted-foreground text-sm shrink-0`} />
              <div className="min-w-0">
                <div className="text-[11px] text-foreground truncate max-w-[160px]">{att.name}</div>
                <div className="text-[10px] text-muted-foreground">{fmtSize(att.size)}</div>
              </div>
            </a>
          ))}
        </div>
      )}

      {entry.tags && entry.tags.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          {entry.tags.map(t => (
            <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent border border-border text-muted-foreground">
              #{t}
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}

function VitalsRow({ v }: { v: Vitals }) {
  const items: Array<{ label: string; value: string } | null> = [
    (v.bp_systolic && v.bp_diastolic) ? { label: 'АД', value: `${v.bp_systolic}/${v.bp_diastolic}` } : null,
    v.hr != null        ? { label: 'ЧСС',   value: `${v.hr} уд` } : null,
    v.temperature != null ? { label: 'Темп.', value: `${v.temperature}°C` } : null,
    v.spo2 != null      ? { label: 'SpO2',  value: `${v.spo2}%` } : null,
    v.weight_kg != null ? { label: 'Вес',   value: `${v.weight_kg} кг` } : null,
    v.respiration_rate != null ? { label: 'ЧДД', value: `${v.respiration_rate}/мин` } : null,
  ]
  const real = items.filter(Boolean) as Array<{ label: string; value: string }>
  if (real.length === 0) return null
  return (
    <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
      {real.map(it => <Metric key={it.label} label={it.label} value={it.value} />)}
    </div>
  )
}

function RehabRow({ r }: { r: any }) {
  const items: Array<{ label: string; value: string } | null> = [
    r.pain_level != null       ? { label: 'Боль',          value: `${r.pain_level}/10` } : null,
    r.mobility_score != null   ? { label: 'Мобильность',   value: `${r.mobility_score}%` } : null,
    r.recovery_pct != null     ? { label: 'Восстановление', value: `${r.recovery_pct}%` } : null,
    r.return_to_sport_date     ? { label: 'Возврат в спорт', value: r.return_to_sport_date } : null,
  ]
  const real = items.filter(Boolean) as Array<{ label: string; value: string }>
  if (real.length === 0 && !r.exercises && !r.next_milestone) return null
  return (
    <div className="mt-3 space-y-2">
      {real.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {real.map(it => <Metric key={it.label} label={it.label} value={it.value} />)}
        </div>
      )}
      {r.exercises && (
        <div className="rounded-lg bg-muted/30 border border-border px-3 py-2 text-[11px] whitespace-pre-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Упражнения / протокол</span>
          {r.exercises}
        </div>
      )}
      {r.next_milestone && (
        <div className="rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-[11px]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-700 block mb-0.5">Следующая веха</span>
          {r.next_milestone}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
//  Drawer form
// ════════════════════════════════════════════════════════════════════════

function EntryDrawer({
  doctorId, patients, initialPatientId, initial, onClose, onSaved,
}: {
  doctorId: string
  patients: DoctorPatient[]
  initialPatientId?: string
  initial: MedicalEntry | null
  onClose: () => void
  onSaved: () => void
}) {
  const [type, setType] = useState<MedicalEntryType>(initial?.entry_type ?? 'consultation')
  const [athleteId, setAthleteId] = useState<string>(initial?.athlete_id ?? initialPatientId ?? '')
  const [date, setDate] = useState<string>(initial?.date ?? todayISO())
  const [title, setTitle] = useState<string>(initial?.title ?? '')
  const [note, setNote]   = useState<string>(initial?.note ?? '')
  const [tagsInput, setTagsInput] = useState<string>((initial?.tags ?? []).join(', '))
  const [severity, setSeverity] = useState<MedicalSeverity | ''>(initial?.severity ?? '')
  const [bodyPart, setBodyPart] = useState<string>(initial?.body_part ?? '')
  const [mood,     setMood]     = useState<number | ''>(initial?.mood ?? '')
  const [pain,     setPain]     = useState<number | ''>(initial?.pain_level ?? '')
  const [shared,      setShared]      = useState<boolean>(initial?.is_shared_with_athlete ?? false)
  const [sharedCoach, setSharedCoach] = useState<boolean>(initial?.is_shared_with_coach   ?? false)

  // Vitals
  const v0: Vitals = initial?.vitals ?? {}
  const [bpSys, setBpSys] = useState<number | ''>(v0.bp_systolic ?? '')
  const [bpDia, setBpDia] = useState<number | ''>(v0.bp_diastolic ?? '')
  const [hr,    setHr]    = useState<number | ''>(v0.hr ?? '')
  const [temp,  setTemp]  = useState<number | ''>(v0.temperature ?? '')
  const [spo2,  setSpo2]  = useState<number | ''>(v0.spo2 ?? '')
  const [weight, setWeight] = useState<number | ''>(v0.weight_kg ?? '')
  const [respRate, setRespRate] = useState<number | ''>(v0.respiration_rate ?? '')

  // Prescription
  const [meds, setMeds] = useState<PrescriptionItem[]>(initial?.prescription_data?.medications ?? [])
  const [warnings, setWarnings] = useState<string>(initial?.prescription_data?.warnings ?? '')

  // Lab
  const [labName, setLabName] = useState<string>(initial?.lab_data?.lab_name ?? '')
  const [tests, setTests] = useState<LabTest[]>(initial?.lab_data?.tests ?? [])

  // Rehab
  const [rehabExercises, setRehabExercises] = useState<string>(initial?.rehab_data?.exercises ?? '')
  const [mobScore, setMobScore] = useState<number | ''>(initial?.rehab_data?.mobility_score ?? '')
  const [recPct,   setRecPct]   = useState<number | ''>(initial?.rehab_data?.recovery_pct ?? '')
  const [milestone, setMilestone] = useState<string>(initial?.rehab_data?.next_milestone ?? '')
  const [returnDate, setReturnDate] = useState<string>(initial?.rehab_data?.return_to_sport_date ?? '')

  // Schedule
  const [schStart, setSchStart] = useState<string>(initial?.schedule_data?.start_time ?? '')
  const [schEnd,   setSchEnd]   = useState<string>(initial?.schedule_data?.end_time ?? '')
  const [schDuration, setSchDuration] = useState<number | ''>(initial?.schedule_data?.duration_min ?? 30)
  const [schLoc,   setSchLoc]   = useState<string>(initial?.schedule_data?.location ?? '')
  const [apptType, setApptType] = useState<string>(initial?.schedule_data?.appointment_type ?? '')

  // Attachments
  const [attachments, setAttachments] = useState<MedicalAttachment[]>(initial?.attachments ?? [])
  const [uploadErr, setUploadErr] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [saving, setSaving] = useState(false)
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t) }, [])
  const handleClose = () => { setVisible(false); setTimeout(onClose, 200) }

  // Voice dictation
  const dict = useDictation({ lang: 'ru-RU' })
  const toggleDictation = () => {
    if (dict.state === 'listening') dict.stop()
    else dict.start(text => setNote(prev => (prev ? prev + ' ' : '') + text))
  }

  // Attachments upload
  const handleFilePick = async (files: FileList) => {
    setUploadErr(null)
    const remaining = MAX_ATTACH_FILES - attachments.length
    if (remaining <= 0) { setUploadErr(`Максимум ${MAX_ATTACH_FILES} файлов`); return }
    const toUpload = Array.from(files).slice(0, remaining)
    setUploading(true)
    try {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { setUploadErr('Не авторизован'); setUploading(false); return }
      const results: MedicalAttachment[] = []
      for (const f of toUpload) {
        const isImage = /^image\//.test(f.type)
        const maxSize = isImage ? MAX_IMG : MAX_DOC
        if (f.size > maxSize) { setUploadErr(`${f.name}: слишком большой (${fmtSize(f.size)})`); continue }
        const ext = f.name.split('.').pop() ?? 'bin'
        const path = `${user.id}/med/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await sb.storage.from('note-attachments').upload(path, f, { upsert: false })
        if (upErr) { setUploadErr(upErr.message); continue }
        const { data: { publicUrl } } = sb.storage.from('note-attachments').getPublicUrl(path)
        results.push({
          name: f.name,
          url: publicUrl,
          type: isImage ? 'image' : 'document',
          size: f.size,
          mimeType: f.type,
        })
      }
      setAttachments(prev => [...prev, ...results])
    } finally { setUploading(false) }
  }

  const handleSave = async () => {
    if (!note.trim()) return
    setSaving(true)
    const tags = tagsInput.split(/[,\n]/).map(t => t.trim().replace(/^#/, '')).filter(Boolean)

    const vitals: Vitals = {
      bp_systolic:  typeof bpSys === 'number' ? bpSys : undefined,
      bp_diastolic: typeof bpDia === 'number' ? bpDia : undefined,
      hr:           typeof hr === 'number' ? hr : undefined,
      temperature:  typeof temp === 'number' ? temp : undefined,
      spo2:         typeof spo2 === 'number' ? spo2 : undefined,
      weight_kg:    typeof weight === 'number' ? weight : undefined,
      respiration_rate: typeof respRate === 'number' ? respRate : undefined,
    }
    const hasAnyVital = Object.values(vitals).some(x => x !== undefined)

    const payload = {
      doctor_id:  doctorId,
      athlete_id: athleteId || null,
      date,
      entry_type: type,
      title:      title || null,
      note,
      tags:       tags.length > 0 ? tags : null,
      severity:   severity || null,
      body_part:  bodyPart || null,
      mood:       typeof mood === 'number' ? mood : null,
      pain_level: typeof pain === 'number' ? pain : null,
      vitals:     hasAnyVital ? vitals : null,
      prescription_data: type === 'prescription' ? {
        medications: meds.length > 0 ? meds : undefined,
        warnings: warnings.trim() || undefined,
      } : null,
      lab_data: type === 'lab_results' ? {
        lab_name: labName.trim() || undefined,
        tests: tests.length > 0 ? tests : undefined,
      } : null,
      rehab_data: type === 'rehab_progress' ? {
        exercises: rehabExercises.trim() || undefined,
        pain_level: typeof pain === 'number' ? pain : undefined,
        mobility_score: typeof mobScore === 'number' ? mobScore : undefined,
        recovery_pct: typeof recPct === 'number' ? recPct : undefined,
        next_milestone: milestone.trim() || undefined,
        return_to_sport_date: returnDate || undefined,
      } : null,
      schedule_data: type === 'schedule' ? {
        start_time: schStart || undefined,
        end_time:   schEnd || undefined,
        duration_min: typeof schDuration === 'number' ? schDuration : undefined,
        location:   schLoc.trim() || undefined,
        appointment_type: apptType.trim() || undefined,
      } : null,
      attachments: attachments.length > 0 ? attachments : null,
      is_shared_with_athlete: shared,
      is_shared_with_coach:   sharedCoach,
    }

    if (initial) {
      await updateMedicalEntry(initial.id, payload as any)
    } else {
      await createMedicalEntry(payload as any)
    }
    setSaving(false)
    onSaved()
  }

  const meta = MED_TYPE_META[type]

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={handleClose}>
      <div className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity ${visible ? 'opacity-100' : 'opacity-0'}`} />
      <div onClick={e => e.stopPropagation()}
        className={`relative z-10 h-full w-full max-w-[580px] bg-background shadow-2xl flex flex-col transition-transform duration-200 ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: meta.color }}>{meta.label}</p>
            <h3 className="text-lg font-semibold text-navy-500">
              {initial ? 'Редактировать запись' : 'Новая запись'}
            </h3>
          </div>
          <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
            <i className="ki-filled ki-cross text-xs" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Type selector */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Тип записи</label>
            <div className="mt-1 grid grid-cols-4 gap-1.5">
              {ENTRY_TYPES.map(t => {
                const m = MED_TYPE_META[t]
                const on = type === t
                return (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className={`rounded-lg border p-2 text-center transition-all ${on ? 'ring-2 ring-offset-1' : 'hover:-translate-y-0.5'}`}
                    style={{ background: on ? m.bg : 'transparent', borderColor: m.border, color: m.color, ...(on ? { boxShadow: `0 0 0 2px ${m.color}` } : {}) }}>
                    <i className={`ki-filled ${m.icon} text-base`} />
                    <div className="text-[10px] font-semibold mt-1 leading-tight">{m.label}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Пациент</label>
              <select value={athleteId} onChange={e => setAthleteId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="">— без пациента —</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Дата</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Заголовок</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Короткая тема"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>

          {/* Note + dictation */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Запись</label>
              {dict.supported && (
                <button type="button" onClick={toggleDictation}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold border transition-all ${
                    dict.state === 'listening'
                      ? 'border-red-400 bg-red-50 text-red-600 animate-pulse'
                      : 'border-border bg-background text-muted-foreground hover:border-red-300 hover:text-red-600'
                  }`}>
                  <i className={`ki-filled ${dict.state === 'listening' ? 'ki-microphone-2' : 'ki-microphone'} text-xs`} />
                  {dict.state === 'listening' ? 'Слушаю…' : 'Диктовать'}
                </button>
              )}
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={5}
              placeholder={
                type === 'consultation' ? 'Жалобы, анамнез, осмотр, заключение, рекомендации…' :
                type === 'rehab_progress' ? 'Динамика, выполненные упражнения, болевой синдром, ограничения…' :
                type === 'prescription' ? 'Обоснование назначений и комментарии…' :
                type === 'lab_results' ? 'Интерпретация результатов, выводы…' :
                type === 'nutrition_plan' ? 'Цели плана, ограничения, рекомендации по приёмам пищи…' :
                type === 'injury_note' ? 'Механизм травмы, первичный осмотр, план лечения…' :
                type === 'schedule' ? 'Повод приёма, что взять с собой, подготовка…' :
                'Свободное наблюдение'
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none" />
            {dict.interim && <div className="mt-1 text-[11px] text-muted-foreground italic">… {dict.interim}</div>}
          </div>

          {/* Severity + body part — for most medical types */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Тяжесть</label>
              <div className="mt-1 grid grid-cols-4 gap-1">
                {SEVERITIES.map(s => (
                  <button key={s} type="button" onClick={() => setSeverity(severity === s ? '' : s)}
                    className={`px-2 py-1.5 rounded-lg border text-[10px] font-semibold transition-all ${severity === s ? '' : 'bg-background text-muted-foreground border-border hover:border-red-200'}`}
                    style={severity === s ? { background: SEVERITY_LABELS[s].bg, color: SEVERITY_LABELS[s].color, borderColor: SEVERITY_LABELS[s].border } : undefined}>
                    {SEVERITY_LABELS[s].ru}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Часть тела</label>
              <select value={bodyPart} onChange={e => setBodyPart(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="">—</option>
                {BODY_PART_KEYS.map(k => <option key={k} value={k}>{BODY_PARTS_RU[k]}</option>)}
              </select>
            </div>
          </div>

          {/* Pain + mood */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Боль{typeof pain === 'number' ? ` — ${pain}/10` : ''}
              </label>
              <input type="range" min={0} max={10} step={1}
                value={typeof pain === 'number' ? pain : 0}
                onChange={e => setPain(e.target.value === '0' ? '' : Number(e.target.value))}
                className="mt-3 w-full accent-red-500" />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Настроение пациента</label>
              <div className="mt-1 flex gap-1">
                {MOOD_EMOJI.map((emoji, i) => (
                  <button key={i} type="button"
                    onClick={() => setMood(mood === i + 1 ? '' : i + 1)}
                    className={`w-8 h-8 rounded-lg border text-base transition-all ${mood === i + 1 ? 'border-red-400 bg-red-50 scale-110' : 'border-border bg-background hover:border-red-200'}`}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Vitals — always available */}
          <details className="rounded-xl border border-blue-200 bg-blue-50/40 p-3" open={!!initial?.vitals}>
            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700">
              Витальные показатели (опц.)
            </summary>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">АД сист.</label>
                <input type="number" placeholder="мм рт.ст." value={bpSys}
                  onChange={e => setBpSys(e.target.value === '' ? '' : Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">АД диаст.</label>
                <input type="number" value={bpDia}
                  onChange={e => setBpDia(e.target.value === '' ? '' : Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">ЧСС</label>
                <input type="number" placeholder="уд/мин" value={hr}
                  onChange={e => setHr(e.target.value === '' ? '' : Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Температура °C</label>
                <input type="number" step={0.1} value={temp}
                  onChange={e => setTemp(e.target.value === '' ? '' : Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">SpO₂ %</label>
                <input type="number" min={0} max={100} value={spo2}
                  onChange={e => setSpo2(e.target.value === '' ? '' : Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">ЧДД</label>
                <input type="number" value={respRate}
                  onChange={e => setRespRate(e.target.value === '' ? '' : Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
              </div>
              <div className="col-span-3">
                <label className="text-[10px] text-muted-foreground">Вес, кг</label>
                <input type="number" step={0.1} value={weight}
                  onChange={e => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
              </div>
            </div>
          </details>

          {/* Prescription */}
          {type === 'prescription' && (
            <div className="rounded-xl border border-[#E9D5FF] bg-[#FAF5FF]/60 p-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7C3AED]">Медикаменты</p>
              {meds.map((m, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5">
                  <input placeholder="Название" value={m.name}
                    onChange={e => setMeds(prev => prev.map((x, ix) => ix === i ? { ...x, name: e.target.value } : x))}
                    className="col-span-4 rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                  <input placeholder="Доза" value={m.dose ?? ''}
                    onChange={e => setMeds(prev => prev.map((x, ix) => ix === i ? { ...x, dose: e.target.value } : x))}
                    className="col-span-2 rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                  <input placeholder="Частота" value={m.frequency ?? ''}
                    onChange={e => setMeds(prev => prev.map((x, ix) => ix === i ? { ...x, frequency: e.target.value } : x))}
                    className="col-span-3 rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                  <input placeholder="Курс" value={m.duration ?? ''}
                    onChange={e => setMeds(prev => prev.map((x, ix) => ix === i ? { ...x, duration: e.target.value } : x))}
                    className="col-span-2 rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                  <button onClick={() => setMeds(prev => prev.filter((_, ix) => ix !== i))}
                    className="col-span-1 rounded-lg border border-border bg-background text-red-500 hover:bg-red-50">
                    <i className="ki-filled ki-trash text-xs" />
                  </button>
                </div>
              ))}
              <button type="button"
                onClick={() => setMeds(prev => [...prev, { name: '' }])}
                className="text-[11px] font-semibold text-purple-700 hover:text-purple-800">
                + Добавить препарат
              </button>
              <input value={warnings} onChange={e => setWarnings(e.target.value)}
                placeholder="Предупреждения (напр. аллергии, взаимодействия)"
                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
            </div>
          )}

          {/* Lab results */}
          {type === 'lab_results' && (
            <div className="rounded-xl border border-[#A5F3FC] bg-[#ECFEFF]/40 p-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0891B2]">Анализы</p>
              <input placeholder="Лаборатория / кабинет" value={labName}
                onChange={e => setLabName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
              {tests.map((t, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5">
                  <input placeholder="Показатель" value={t.name}
                    onChange={e => setTests(prev => prev.map((x, ix) => ix === i ? { ...x, name: e.target.value } : x))}
                    className="col-span-4 rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                  <input placeholder="Значение" value={t.value ?? ''}
                    onChange={e => setTests(prev => prev.map((x, ix) => ix === i ? { ...x, value: e.target.value } : x))}
                    className="col-span-2 rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                  <input placeholder="Ед." value={t.unit ?? ''}
                    onChange={e => setTests(prev => prev.map((x, ix) => ix === i ? { ...x, unit: e.target.value } : x))}
                    className="col-span-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                  <input placeholder="Норма" value={t.reference ?? ''}
                    onChange={e => setTests(prev => prev.map((x, ix) => ix === i ? { ...x, reference: e.target.value } : x))}
                    className="col-span-2 rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                  <select value={t.flag ?? ''}
                    onChange={e => setTests(prev => prev.map((x, ix) => ix === i ? { ...x, flag: (e.target.value || undefined) as any } : x))}
                    className="col-span-2 rounded-lg border border-border bg-background px-2 py-1.5 text-sm">
                    <option value="">—</option>
                    <option value="normal">норма</option>
                    <option value="low">↓</option>
                    <option value="high">↑</option>
                    <option value="critical">крит.</option>
                  </select>
                  <button onClick={() => setTests(prev => prev.filter((_, ix) => ix !== i))}
                    className="col-span-1 rounded-lg border border-border bg-background text-red-500 hover:bg-red-50">
                    <i className="ki-filled ki-trash text-xs" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setTests(prev => [...prev, { name: '' }])}
                className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-800">
                + Добавить показатель
              </button>
            </div>
          )}

          {/* Rehab */}
          {type === 'rehab_progress' && (
            <div className="rounded-xl border border-[#FBC1A0] bg-[#FEF0E7]/60 p-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B03D04]">Реабилитация</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Мобильность %</label>
                  <input type="number" min={0} max={100} value={mobScore}
                    onChange={e => setMobScore(e.target.value === '' ? '' : Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Восстановление %</label>
                  <input type="number" min={0} max={100} value={recPct}
                    onChange={e => setRecPct(e.target.value === '' ? '' : Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Упражнения / протокол</label>
                <textarea value={rehabExercises} rows={3}
                  onChange={e => setRehabExercises(e.target.value)}
                  placeholder="Список упражнений / подходов / весов"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Следующая веха</label>
                  <input value={milestone} onChange={e => setMilestone(e.target.value)}
                    placeholder="Напр. полная нагрузка на колено через 2 нед"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Возврат в спорт</label>
                  <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
              </div>
            </div>
          )}

          {/* Schedule */}
          {type === 'schedule' && (
            <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4]/60 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <i className="ki-filled ki-calendar-tick text-[#16A34A]" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#15803D]">
                  Автоматически попадает в календарь
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Начало</label>
                  <input type="time" value={schStart} onChange={e => setSchStart(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Конец</label>
                  <input type="time" value={schEnd} onChange={e => setSchEnd(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Мин</label>
                  <input type="number" min={0} value={schDuration}
                    onChange={e => setSchDuration(e.target.value === '' ? '' : Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Тип приёма</label>
                  <input value={apptType} onChange={e => setApptType(e.target.value)}
                    placeholder="первичный / контрольный"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Место</label>
                  <input value={schLoc} onChange={e => setSchLoc(e.target.value)}
                    placeholder="Клиника / кабинет"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
              </div>
            </div>
          )}

          {/* Attachments */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Вложения · {attachments.length}/{MAX_ATTACH_FILES}
            </label>
            <div className="mt-1 flex flex-wrap gap-2 items-center">
              {attachments.map((att, i) => (
                <div key={i} className="relative group">
                  {att.type === 'image' ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={att.url} alt={att.name}
                      className="w-16 h-16 rounded-lg object-cover border border-border" />
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 max-w-[180px]">
                      <i className="ki-filled ki-document text-muted-foreground text-sm" />
                      <div className="min-w-0">
                        <div className="text-[11px] truncate">{att.name}</div>
                        <div className="text-[10px] text-muted-foreground">{fmtSize(att.size)}</div>
                      </div>
                    </div>
                  )}
                  <button type="button"
                    onClick={() => setAttachments(prev => prev.filter((_, x) => x !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-foreground/85 text-background rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <i className="ki-filled ki-cross text-[9px]" />
                  </button>
                </div>
              ))}
              <button type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || attachments.length >= MAX_ATTACH_FILES}
                className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-red-300 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed">
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <i className="ki-filled ki-paper-clip text-base" />
                )}
              </button>
              <input ref={fileInputRef} type="file" multiple className="hidden"
                accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.txt"
                onChange={e => { if (e.target.files?.length) handleFilePick(e.target.files); e.target.value = '' }} />
            </div>
            {uploadErr && <p className="mt-1 text-[11px] text-red-500">{uploadErr}</p>}
          </div>

          {/* Share toggles — две раздельные ручки */}
          {athleteId && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                <input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-blue-500" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">Показать пациенту</div>
                  <div className="text-[11px] text-muted-foreground">
                    Пациент получит уведомление и сможет прочитать запись в своём кабинете.
                  </div>
                </div>
                <i className="ki-filled ki-eye text-blue-500" />
              </label>
              <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                <input type="checkbox" checked={sharedCoach} onChange={e => setSharedCoach(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-orange-500" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">Передать тренеру</div>
                  <div className="text-[11px] text-muted-foreground">
                    Тренеры пациента увидят это ограничение/заметку на дашборде. Используйте для restrictions
                    («не прыгать 2 недели», «массаж — восстановление 3 дня»).
                  </div>
                </div>
                <i className="ki-filled ki-people text-orange-500" />
              </label>
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Теги</label>
            <input value={tagsInput} onChange={e => setTagsInput(e.target.value)}
              placeholder="Через запятую: контроль, повторный приём, терапия"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="border-t border-border px-5 py-3 flex items-center gap-2">
          <button onClick={handleSave} disabled={saving || !note.trim() || uploading}
            className="flex-1 rounded-xl text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            style={{ background: meta.color }}>
            {saving ? 'Сохраняем…' : initial ? 'Сохранить' : 'Добавить запись'}
          </button>
          <button onClick={handleClose}
            className="px-4 py-2.5 rounded-xl border border-border bg-background text-sm hover:bg-muted">
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
