'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { computeCoachAthletesAcwr, ACWR_ZONE_META, type AthleteAcwr } from '@/services/acwr.service'
import { Alert } from '@/components/ui/metronic'

interface RiskRow {
  athleteId: string
  name: string
  recovery: number | null
  acwr: number | null
  zone: AthleteAcwr['zone']
  hasActiveInjury: boolean
  reasons: Array<{ kind: 'recovery' | 'acwr' | 'injury'; label: string; color: string }>
}

/**
 * Атлеты, требующие внимания тренера. Сводит recovery <40%,
 * ACWR в danger/monitor зоне и наличие активной травмы. Показывает
 * до 5 строк отсортированных по тяжести (danger→monitor→травма→
 * низкое recovery).
 */
export default function CoachAtRiskAthletes({ coachId }: { coachId: string }) {
  const [rows, setRows] = useState<RiskRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sb = createClient()
      // Список атлетов
      const { data: linksRaw } = await sb
        .from('trainer_athletes').select('athlete_id')
        .eq('trainer_id', coachId).eq('status', 'accepted')
      const ids = ((linksRaw ?? []) as Array<{ athlete_id: string }>).map(l => l.athlete_id)
      if (ids.length === 0) { setRows([]); return }

      const [usersRes, acwrAll, metricsRes, injuriesRes] = await Promise.all([
        sb.from('users').select('id, name').in('id', ids),
        computeCoachAthletesAcwr(coachId),
        sb.from('daily_metrics')
          .select('athlete_id, date, recovery_score')
          .in('athlete_id', ids)
          .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
          .order('date', { ascending: false }),
        sb.from('injuries')
          .select('athlete_id, status')
          .in('athlete_id', ids)
          .neq('status', 'recovered'),
      ])

      const nameById = new Map(((usersRes.data ?? []) as Array<{ id: string; name: string | null }>)
        .map(u => [u.id, u.name ?? '—']))

      // Latest recovery per athlete
      const latestRec = new Map<string, number | null>()
      for (const m of ((metricsRes.data ?? []) as Array<{ athlete_id: string; date: string; recovery_score: number | null }>)) {
        if (!latestRec.has(m.athlete_id)) latestRec.set(m.athlete_id, m.recovery_score)
      }

      const injuredSet = new Set<string>()
      for (const inj of ((injuriesRes.data ?? []) as Array<{ athlete_id: string }>)) {
        injuredSet.add(inj.athlete_id)
      }

      const acwrById = new Map(acwrAll.map(a => [a.athlete_id, a]))

      const list: RiskRow[] = ids.map(id => {
        const reasons: RiskRow['reasons'] = []
        const recovery = latestRec.get(id) ?? null
        const acwr = acwrById.get(id) ?? null
        const hasInjury = injuredSet.has(id)

        if (recovery != null && recovery < 40) {
          reasons.push({ kind: 'recovery', label: `Recovery ${Math.round(recovery)}%`, color: '#B91C1C' })
        }
        if (acwr && (acwr.zone === 'danger' || acwr.zone === 'monitor')) {
          const meta = ACWR_ZONE_META[acwr.zone]
          reasons.push({
            kind: 'acwr',
            label: `ACWR ${acwr.acwr?.toFixed(2) ?? '—'}`,
            color: meta.color,
          })
        }
        if (hasInjury) {
          reasons.push({ kind: 'injury', label: 'Активная травма', color: '#B91C1C' })
        }

        return {
          athleteId: id,
          name: nameById.get(id) ?? '—',
          recovery,
          acwr: acwr?.acwr ?? null,
          zone: acwr?.zone ?? 'no_data',
          hasActiveInjury: hasInjury,
          reasons,
        }
      }).filter(r => r.reasons.length > 0)

      // Sort by severity: danger ACWR > injury > monitor ACWR > low recovery
      const score = (r: RiskRow): number => {
        let s = 0
        if (r.zone === 'danger') s += 100
        if (r.hasActiveInjury) s += 60
        if (r.zone === 'monitor') s += 30
        if (r.recovery != null && r.recovery < 40) s += 20
        return s
      }
      list.sort((a, b) => score(b) - score(a))
      setRows(list.slice(0, 6))
    } finally { setLoading(false) }
  }, [coachId])

  useEffect(() => { load() }, [load])

  const summary = useMemo(() => {
    let danger = 0, monitor = 0, injured = 0, lowRec = 0
    for (const r of rows) {
      if (r.zone === 'danger')  danger++
      if (r.zone === 'monitor') monitor++
      if (r.hasActiveInjury)    injured++
      if (r.recovery != null && r.recovery < 40) lowRec++
    }
    return { danger, monitor, injured, lowRec }
  }, [rows])

  if (loading) return null
  if (rows.length === 0) {
    return (
      <Alert variant="success" title="Команда в норме">
        Никто не требует срочного внимания.
      </Alert>
    )
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/30 p-5">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-700">⚠ Внимание</p>
          <h3 className="text-base font-bold text-foreground">Требуют вмешательства — {rows.length}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {summary.danger > 0 && <span>ACWR {summary.danger} · </span>}
            {summary.monitor > 0 && <span>зона monitor {summary.monitor} · </span>}
            {summary.injured > 0 && <span>травм {summary.injured} · </span>}
            {summary.lowRec > 0 && <span>низкое recovery {summary.lowRec}</span>}
          </p>
        </div>
        <Link href="/athletes/load" className="text-[11px] font-semibold text-red-700 hover:underline">
          ACWR-дашборд →
        </Link>
      </div>

      <div className="space-y-1.5">
        {rows.map(r => (
          <Link key={r.athleteId} href={`/athletes/${r.athleteId}`}
            className="flex items-center gap-3 rounded-xl bg-white border border-border px-3 py-2.5 hover:border-red-300 transition-colors">
            <div className="w-9 h-9 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-semibold text-xs shrink-0">
              {r.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">{r.name}</div>
              <div className="text-[11px] flex items-center gap-1.5 flex-wrap">
                {r.reasons.map((reason, i) => (
                  <span key={i} className="font-semibold" style={{ color: reason.color }}>
                    {reason.label}{i < r.reasons.length - 1 ? ' ·' : ''}
                  </span>
                ))}
              </div>
            </div>
            <i className="ki-filled ki-arrow-right text-xs text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
