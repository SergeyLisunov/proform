'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { listInjuries, BODY_PART_LABELS, SEVERITY_LABELS, type Injury } from '@/services/injuries.service'

interface InjuryRow extends Injury { athlete_name: string }

const STATUS_META: Record<Injury['status'], { label: string; color: string; bg: string; border: string }> = {
  active:     { label: 'Активная',        color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  recovering: { label: 'Восстановление',  color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' },
  recovered:  { label: 'Восстановлена',   color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
}

/**
 * Активные травмы у всех пациентов врача. RLS-policy
 * injuries_doctor_rw фильтрует автоматически. Сортировка:
 * сначала active, потом recovering. Топ-6.
 */
export default function DoctorActiveInjuries() {
  const [rows, setRows] = useState<InjuryRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const all = await listInjuries()
      const active = all.filter(i => i.status === 'active' || i.status === 'recovering')
      if (active.length === 0) { setRows([]); return }

      const ids = [...new Set(active.map(i => i.athlete_id))]
      const sb = createClient()
      const { data: usersRaw } = await sb.from('users').select('id, name').in('id', ids)
      const nameById = new Map(((usersRaw ?? []) as Array<{ id: string; name: string | null }>)
        .map(u => [u.id, u.name ?? '—']))

      const sorted = active.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1
        const sevOrder: Record<Injury['severity'], number> = { severe: 0, moderate: 1, minor: 2 }
        return sevOrder[a.severity] - sevOrder[b.severity]
      }).slice(0, 6)

      setRows(sorted.map(i => ({ ...i, athlete_name: nameById.get(i.athlete_id) ?? '—' })))
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  if (loading) return null
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50/40 p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="text-sm font-bold text-foreground">Активных травм нет</p>
            <p className="text-[11px] text-muted-foreground">Все ваши пациенты в норме.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-700">Травмы пациентов</p>
          <h3 className="text-base font-bold text-foreground">Требуют наблюдения — {rows.length}</h3>
        </div>
        <Link href="/injuries" className="text-[11px] font-semibold text-red-600 hover:underline">
          Журнал травм →
        </Link>
      </div>

      <div className="space-y-1.5">
        {rows.map(inj => {
          const status = STATUS_META[inj.status]
          const part = BODY_PART_LABELS[inj.body_part] ?? inj.body_part
          return (
            <Link key={inj.id} href="/injuries"
              className="flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2.5 hover:border-red-300 transition-colors">
              <div className="w-9 h-9 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-semibold text-xs shrink-0">
                {inj.athlete_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">{inj.athlete_name}</div>
                <div className="text-[11px] text-muted-foreground">
                  <strong className="text-foreground">{part}</strong>
                  {inj.side !== 'n/a' && <span> · {inj.side === 'left' ? 'левая' : inj.side === 'right' ? 'правая' : 'обе'}</span>}
                  <span> · </span>
                  <span style={{ color: status.color }}>{SEVERITY_LABELS[inj.severity].toLowerCase()}</span>
                </div>
              </div>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0"
                style={{ background: status.bg, color: status.color, border: `1px solid ${status.border}` }}>
                {status.label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
