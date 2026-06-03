'use client'
/**
 * MyRecommendationsCard — Sprint W2 Day 9.
 *
 * Показывает атлету рекомендации обращённые к нему (visibility_level
 * допускает athlete-side просмотр: athlete_only / coach_and_athlete /
 * org_full). НЕ показывает рекомендации с visibility='coach_only' —
 * там доктор хочет проинформировать только тренера, не паниковать
 * атлета незавершённым диагнозом.
 *
 * Если рекомендаций нет — карточка не рендерится (empty UI).
 *
 * Acknowledge button — POST к /api/recommendations/[id]/ack with
 * as='athlete'. Trigger в migration 052 авто-bump'ит status на
 * 'acknowledged' если оба parties (per visibility) ack'нули.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  CATEGORY_META, SEVERITY_META, type Recommendation,
} from '@/services/recommendations.service'
import { Badge } from '@/components/ui/metronic'

interface Props {
  athleteId: string
}

export default function MyRecommendationsCard({ athleteId }: Props) {
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
        setRecs([])
        return
      }
      const activeForAthlete = (json.data as Recommendation[]).filter(r =>
        ['sent', 'active', 'acknowledged'].includes(r.status)
      )
      setRecs(activeForAthlete)
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
        body: JSON.stringify({ as: 'athlete' }),
      })
      const json = await res.json()
      if (json.ok) {
        setRecs(prev => prev.map(r => r.id === id ? { ...r, acknowledged_by_athlete_at: new Date().toISOString() } : r))
      }
    } finally {
      setBusyId(null)
    }
  }

  if (loading || recs.length === 0) return null

  return (
    <div
      className="rounded-2xl border border-blue-200 overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#EFF6FF 0%,#F0F9FF 60%,#FFFFFF 100%)' }}>
      <div className="flex items-center justify-between border-b border-blue-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-blue-100">
            <i className="ki-filled ki-heart-circle text-base text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-blue-900 leading-none">Рекомендации от врача</h3>
            <div className="text-[11px] text-blue-700/80 mt-0.5">{recs.length} активных</div>
          </div>
        </div>
      </div>

      <div className="divide-y divide-blue-100">
        {recs.map(r => {
          const cat = CATEGORY_META[r.category]
          const sev = SEVERITY_META[r.severity]
          const acked = !!r.acknowledged_by_athlete_at
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
                  {r.valid_until && (
                    <Badge variant="warning" size="sm">
                      до {new Date(r.valid_until + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </Badge>
                  )}
                </div>
                {r.body && (
                  <p className="mt-1 text-[12px] text-foreground/80 leading-snug line-clamp-3">
                    {r.body}
                  </p>
                )}
                <div className="mt-1.5 text-[10px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} · {cat.label}
                </div>
              </div>

              {!acked ? (
                <button
                  onClick={() => acknowledge(r.id)}
                  disabled={busyId === r.id}
                  className="shrink-0 rounded-lg bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 text-[11px] font-bold disabled:opacity-50">
                  {busyId === r.id ? '…' : '✓ Понятно'}
                </button>
              ) : (
                <Badge variant="success" size="sm" className="shrink-0 uppercase tracking-wider">
                  Учтено
                </Badge>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
