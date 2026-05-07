'use client'
/**
 * PersistentRestrictionsPanel — Sprint W2 Day 9.
 *
 * Лента активных рекомендаций от врачей/специалистов для атлета,
 * на которую coach ОБЯЗАН отреагировать. Рендерится сверху athlete
 * card для немедленной видимости (не за 5 кликами в одной из вкладок).
 *
 * Если у атлета нет активных рекомендаций — компонент возвращает null
 * (не засоряет UI здоровых атлетов).
 *
 * Coach может нажать "Понятно, скорректирую план" → POST к
 * /api/recommendations/[id]/ack — записывает acknowledged_by_coach_at.
 *
 * RLS гарантирует что coach видит entries только если:
 *   - visibility_level в ('coach_only','coach_and_athlete','org_full')
 *   - И coach связан с athlete через trainer_athletes(status='accepted')
 *     ИЛИ coach_id = me
 */
import { useCallback, useEffect, useState } from 'react'
import {
  CATEGORY_META, SEVERITY_META, type Recommendation,
} from '@/services/recommendations.service'

interface Props {
  athleteId: string
}

export default function PersistentRestrictionsPanel({ athleteId }: Props) {
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/recommendations?athlete_id=${encodeURIComponent(athleteId)}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (!json.ok) {
        console.warn('[PersistentRestrictionsPanel]', json.error)
        setRecs([])
        return
      }
      // Show only active/sent + un-acknowledged by coach
      const activeUnack = (json.data as Recommendation[]).filter(r =>
        ['sent', 'active', 'acknowledged'].includes(r.status)
        && !r.acknowledged_by_coach_at,
      )
      setRecs(activeUnack)
    } finally {
      setLoading(false)
    }
  }, [athleteId])

  useEffect(() => { load() }, [load])

  const acknowledge = async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/recommendations/${id}/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ as: 'coach' }),
      })
      const json = await res.json()
      if (json.ok) {
        // Optimistic remove
        setRecs(prev => prev.filter(r => r.id !== id))
      }
    } finally {
      setBusyId(null)
    }
  }

  if (loading || recs.length === 0) return null

  const critical = recs.filter(r => r.severity === 'critical' || r.severity === 'high').length

  return (
    <div
      className="rounded-2xl border-2 border-rose-300 overflow-hidden shadow-sm"
      style={{ background: 'linear-gradient(160deg,#FFF1F2 0%,#FFF8F8 60%,#FFFFFF 100%)' }}>
      <div className="flex items-center justify-between border-b border-rose-200/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-rose-200">
            <i className="ki-filled ki-shield-cross text-base text-rose-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-rose-900 leading-none">Ограничения от врача</h3>
            <div className="text-[11px] text-rose-700/80 mt-0.5">
              {recs.length} активных
              {critical > 0 ? ` · ${critical} требуют внимания` : ''}
            </div>
          </div>
        </div>
      </div>

      <div className="divide-y divide-rose-100">
        {recs.map(r => {
          const cat = CATEGORY_META[r.category]
          const sev = SEVERITY_META[r.severity]
          return (
            <div key={r.id} className="flex items-start gap-3 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ background: sev.bg, border: `1px solid ${sev.border}`, color: sev.color }}>
                <i className={`ki-filled ${cat.icon} text-sm`} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-bold text-foreground truncate">{r.title}</span>
                  <span className="rounded-full px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider"
                    style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}>
                    {sev.label}
                  </span>
                  <span className="rounded-full px-1.5 py-[1px] text-[9px] font-semibold bg-slate-100 text-slate-600">
                    {cat.label}
                  </span>
                  {r.valid_until && (
                    <span className="rounded-full px-1.5 py-[1px] text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      до {new Date(r.valid_until + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
                {r.body && (
                  <p className="mt-1 text-[12px] text-foreground/90 leading-snug line-clamp-2">
                    {r.body}
                  </p>
                )}
                <div className="mt-1.5 text-[10px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </div>
              </div>

              <button
                onClick={() => acknowledge(r.id)}
                disabled={busyId === r.id}
                className="shrink-0 rounded-lg bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 text-[11px] font-bold disabled:opacity-50">
                {busyId === r.id ? '…' : '✓ Понятно'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
