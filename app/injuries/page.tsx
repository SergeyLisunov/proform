'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useUser } from '@/lib/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import {
  listInjuries, createInjury, updateInjury, markRecovered, deleteInjury,
  BODY_PART_PRESETS, BODY_PART_LABELS,
  SEVERITY_LABELS, MECHANISM_LABELS, STATUS_LABELS, SIDE_LABELS,
  type Injury, type InjurySide, type InjurySeverity, type InjuryMechanism, type InjuryStatus,
} from '@/services/injuries.service'
import { Card } from '@/components/ui/metronic'

type AthleteOption = { id: string; name: string }

const SEVERITY_COLOR: Record<InjurySeverity, { text: string; bg: string; border: string }> = {
  minor:    { text: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  moderate: { text: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' },
  severe:   { text: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
}

const STATUS_COLOR: Record<InjuryStatus, string> = {
  active:     '#DC2626',
  recovering: '#EA580C',
  recovered:  '#15803D',
}

function todayISO() { return new Date().toISOString().slice(0, 10) }

function useLinkedAthletes(role: string | null, userId: string | null) {
  const [athletes, setAthletes] = useState<AthleteOption[]>([])
  useEffect(() => {
    if (!role || !userId || role === 'athlete') { setAthletes([]); return }
    const sb = createClient()
    ;(async () => {
      const ids = new Set<string>()
      if (role === 'coach') {
        const { data } = await sb.from('trainer_athletes')
          .select('athlete_id').eq('trainer_id', userId).eq('status', 'accepted')
        for (const r of ((data ?? []) as Array<{ athlete_id: string }>)) ids.add(r.athlete_id)
      } else if (role === 'doctor') {
        const { data } = await sb.from('connections')
          .select('initiator_id, recipient_id')
          .eq('connection_type', 'doctor_athlete').eq('status', 'active')
          .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)
        for (const c of ((data ?? []) as Array<{ initiator_id: string; recipient_id: string }>)) {
          ids.add(c.initiator_id === userId ? c.recipient_id : c.initiator_id)
        }
      }
      if (ids.size === 0) { setAthletes([]); return }
      const { data: usersRaw } = await sb.from('users').select('id, name').in('id', [...ids])
      setAthletes(((usersRaw ?? []) as Array<{ id: string; name: string | null }>)
        .map(u => ({ id: u.id, name: u.name ?? '—' })))
    })()
  }, [role, userId])
  return athletes
}

export default function InjuriesPage() {
  const { user, loading: userLoading } = useUser()
  const [rows, setRows] = useState<Injury[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const linkedAthletes = useLinkedAthletes(user?.role ?? null, user?.id ?? null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await listInjuries()) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const athleteNameById = useMemo(() => {
    const m = new Map<string, string>()
    if (user?.id) m.set(user.id, (user as any).name ?? 'Вы')
    for (const a of linkedAthletes) m.set(a.id, a.name)
    return m
  }, [user?.id, linkedAthletes, user])

  const counts = useMemo(() => ({
    active:     rows.filter(r => r.status === 'active').length,
    recovering: rows.filter(r => r.status === 'recovering').length,
    recovered:  rows.filter(r => r.status === 'recovered').length,
  }), [rows])

  if (userLoading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pf-page-enter">
      <div className="relative overflow-hidden rounded-3xl border border-[#FECACA] bg-gradient-to-br from-[#FEF2F2] via-white to-[#FFF7ED] p-6 md:p-8">
        <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-red-200/40 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FECACA] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
              <i className="ki-filled ki-heart-circle text-[11px]" />
              Травмы
            </span>
            <h1 className="pf-num text-3xl md:text-4xl leading-tight text-foreground mt-2">Журнал травм</h1>
            <p className="max-w-2xl text-sm md:text-base text-muted-foreground mt-1">
              Запись, мониторинг и статус восстановления. Видно вашему тренеру и врачу.
            </p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="rounded-xl bg-red-500 text-white px-5 py-2.5 text-sm font-semibold hover:bg-red-600">
            <i className="ki-filled ki-plus text-xs mr-1"/>
            {showForm ? 'Скрыть форму' : 'Записать травму'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#B91C1C]">Активные</div>
          <div className="pf-num text-2xl mt-1 text-[#B91C1C]">{counts.active}</div>
        </div>
        <div className="rounded-xl border border-[#FED7AA] bg-[#FFF7ED] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#C2410C]">Восстановление</div>
          <div className="pf-num text-2xl mt-1 text-[#C2410C]">{counts.recovering}</div>
        </div>
        <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#15803D]">Восстановлены</div>
          <div className="pf-num text-2xl mt-1 text-[#15803D]">{counts.recovered}</div>
        </div>
      </div>

      {showForm && (
        <InjuryForm
          myId={user.id}
          myRole={user.role}
          linkedAthletes={linkedAthletes}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Записи · {rows.length}
          </p>
          <button onClick={load} className="text-[11px] font-semibold text-orange-600 hover:text-orange-700">
            <i className="ki-filled ki-refresh text-[10px] mr-1"/>Обновить
          </button>
        </div>
        {loading && rows.length === 0 ? (
          <div className="p-10 text-center text-xs text-muted-foreground">Загрузка…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-xs text-muted-foreground">Записей пока нет.</div>
        ) : (
          <div className="divide-y divide-border">
            {rows.map(r => (
              <InjuryRow key={r.id} injury={r} myId={user.id}
                athleteName={athleteNameById.get(r.athlete_id) ?? '—'}
                onChanged={load}/>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function InjuryForm({
  myId, myRole, linkedAthletes, onSaved,
}: {
  myId: string
  myRole: string
  linkedAthletes: AthleteOption[]
  onSaved: () => void
}) {
  const athleteOptions: AthleteOption[] = myRole === 'athlete'
    ? [{ id: myId, name: 'Я' }]
    : linkedAthletes
  const [athleteId, setAthleteId] = useState(athleteOptions[0]?.id ?? '')
  const [onsetDate, setOnsetDate] = useState(todayISO())
  const [bodyPart, setBodyPart] = useState<string>('knee')
  const [side, setSide] = useState<InjurySide>('n/a')
  const [severity, setSeverity] = useState<InjurySeverity>('moderate')
  const [mechanism, setMechanism] = useState<InjuryMechanism>('acute')
  const [description, setDescription] = useState('')
  const [recoveryDays, setRecoveryDays] = useState<number | ''>(14)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!athleteId || !bodyPart) return
    setSaving(true)
    const row = await createInjury({
      athlete_id: athleteId,
      reported_by: myId,
      onset_date: onsetDate,
      body_part: bodyPart,
      side, severity, mechanism,
      description: description.trim() || null,
      expected_recovery_days: typeof recoveryDays === 'number' ? recoveryDays : null,
    })
    setSaving(false)
    if (row) onSaved()
  }

  if (athleteOptions.length === 0) {
    return (
      <Card className="p-5 text-center text-xs text-muted-foreground">
        У вас нет связанных атлетов, чтобы зафиксировать травму.
      </Card>
    )
  }

  return (
    <div className="rounded-2xl border-2 border-red-200 bg-red-50/40 p-5 space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-700">Новая запись</p>
      {myRole !== 'athlete' && (
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Атлет</label>
          <select value={athleteId} onChange={e => setAthleteId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {athleteOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Дата</label>
          <input type="date" value={onsetDate} onChange={e => setOnsetDate(e.target.value)} max={todayISO()}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"/>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Восстановление, дн</label>
          <input type="number" min={0} value={recoveryDays}
            onChange={e => setRecoveryDays(e.target.value === '' ? '' : Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"/>
        </div>
      </div>
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Часть тела</label>
        <div className="mt-1 grid grid-cols-4 gap-1.5">
          {BODY_PART_PRESETS.map(bp => (
            <button key={bp} type="button" onClick={() => setBodyPart(bp)}
              className={`px-2 py-1.5 text-[10px] font-semibold rounded-lg border transition-all ${
                bodyPart === bp
                  ? 'border-red-400 bg-red-50 text-red-700'
                  : 'border-border bg-background text-muted-foreground hover:border-red-200'
              }`}>
              {BODY_PART_LABELS[bp]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Сторона</label>
          <select value={side} onChange={e => setSide(e.target.value as InjurySide)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm">
            {(['left','right','both','n/a'] as InjurySide[]).map(s =>
              <option key={s} value={s}>{SIDE_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Тяжесть</label>
          <select value={severity} onChange={e => setSeverity(e.target.value as InjurySeverity)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm">
            {(['minor','moderate','severe'] as InjurySeverity[]).map(s =>
              <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Механизм</label>
          <select value={mechanism} onChange={e => setMechanism(e.target.value as InjuryMechanism)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm">
            {(['acute','overuse','contact','unknown'] as InjuryMechanism[]).map(m =>
              <option key={m} value={m}>{MECHANISM_LABELS[m]}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Описание</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          placeholder="Симптомы, обстоятельства, боль…"
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"/>
      </div>
      <button onClick={handleSave} disabled={saving || !athleteId}
        className="w-full rounded-xl bg-red-500 text-white px-4 py-2.5 text-sm font-semibold hover:bg-red-600 disabled:opacity-50">
        {saving ? 'Сохраняем…' : 'Сохранить запись'}
      </button>
    </div>
  )
}

function InjuryRow({
  injury, athleteName, myId, onChanged,
}: {
  injury: Injury
  athleteName: string
  myId: string
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const sevColor = SEVERITY_COLOR[injury.severity]
  const statusColor = STATUS_COLOR[injury.status]

  const handleStatus = async (newStatus: InjuryStatus) => {
    setBusy(true)
    if (newStatus === 'recovered') await markRecovered(injury.id)
    else await updateInjury(injury.id, { status: newStatus, recovered_at: null })
    setBusy(false); onChanged()
  }
  const handleDelete = async () => {
    if (!confirm('Удалить запись о травме?')) return
    setBusy(true)
    await deleteInjury(injury.id)
    setBusy(false); onChanged()
  }

  return (
    <div className="px-5 py-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: sevColor.bg, color: sevColor.text, border: `1px solid ${sevColor.border}` }}>
        <i className="ki-filled ki-heart-circle text-lg"/>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm font-semibold text-foreground">
            {BODY_PART_LABELS[injury.body_part] ?? injury.body_part}
            {injury.side !== 'n/a' && <span className="text-muted-foreground font-normal"> · {SIDE_LABELS[injury.side]}</span>}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
            <span style={{ color: sevColor.text }}>{SEVERITY_LABELS[injury.severity]}</span>
            <span className="text-muted-foreground">·</span>
            <span style={{ color: statusColor }}>{STATUS_LABELS[injury.status]}</span>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {athleteName} · с {injury.onset_date}{injury.expected_recovery_days ? ` · план ${injury.expected_recovery_days} дн` : ''}
        </div>
        {injury.description && (
          <p className="text-[11px] text-muted-foreground mt-1.5 whitespace-pre-wrap line-clamp-3">{injury.description}</p>
        )}
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {injury.status !== 'recovering' && injury.status !== 'recovered' && (
            <button disabled={busy} onClick={() => handleStatus('recovering')}
              className="rounded-md border border-border bg-background hover:bg-muted px-2 py-1 text-[10px] font-semibold disabled:opacity-50">
              На восстановление
            </button>
          )}
          {injury.status !== 'recovered' && (
            <button disabled={busy} onClick={() => handleStatus('recovered')}
              className="rounded-md bg-green-500 hover:bg-green-600 text-white px-2 py-1 text-[10px] font-semibold disabled:opacity-50">
              Восстановлен
            </button>
          )}
          {injury.status === 'recovered' && (
            <button disabled={busy} onClick={() => handleStatus('active')}
              className="rounded-md border border-border bg-background hover:bg-muted px-2 py-1 text-[10px] font-semibold disabled:opacity-50">
              Снова активна
            </button>
          )}
          {(injury.reported_by === myId || injury.athlete_id === myId) && (
            <button disabled={busy} onClick={handleDelete}
              className="ml-auto rounded-md border border-border bg-background hover:bg-red-50 text-red-600 px-2 py-1 text-[10px] font-semibold disabled:opacity-50">
              Удалить
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
