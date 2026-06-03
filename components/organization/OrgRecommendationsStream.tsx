'use client'
/**
 * OrgRecommendationsStream — Sprint W2 Day 11.
 *
 * Active recommendations stream for Org Dashboard. Renders ONLY metadata
 * (athlete name, doctor name, category, severity, ack status) — NEVER
 * shows medical content (title/body) unless `visibility_level='org_full'`,
 * because org admins should not access private medical text by default.
 *
 * Privacy is enforced both at SQL (RLS) and at app-layer (this component
 * uses listOrgRecommendations which redacts non-org_full bodies).
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { listOrgRecommendations, CATEGORY_META, SEVERITY_META, type OrgRecommendationView } from '@/services/recommendations.service'
import { createClient } from '@/lib/supabase/client'
import { Card, Badge } from '@/components/ui/metronic'

export default function OrgRecommendationsStream({ orgId }: { orgId: string }) {
  const [recs, setRecs]       = useState<OrgRecommendationView[]>([])
  const [loading, setLoading] = useState(true)
  const [nameById, setNameById] = useState<Map<string, string>>(new Map())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listOrgRecommendations(orgId)
      setRecs(list)

      // Resolve athlete + doctor names in batch
      const ids = Array.from(new Set([
        ...list.map(r => r.athlete_id),
        ...list.map(r => r.doctor_id),
      ]))
      if (ids.length === 0) return
      const sb = createClient()
      const { data } = await sb.from('users').select('id, name').in('id', ids)
      setNameById(new Map(((data ?? []) as Array<{ id: string; name: string | null }>)
        .map(u => [u.id, u.name ?? '—'])))
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <Card className="p-5 rounded-2xl">
        <p className="text-sm font-bold mb-3">Загрузка рекомендаций…</p>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </Card>
    )
  }

  if (recs.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-emerald-50/30 p-6 text-center">
        <i className="ki-filled ki-check-circle text-3xl text-emerald-500 mb-2 block" />
        <p className="text-sm font-semibold text-foreground">Активных медицинских рекомендаций нет</p>
        <p className="text-xs text-muted-foreground mt-1">Пациенты в норме.</p>
      </div>
    )
  }

  const unack = recs.filter(r => !r.acknowledged_by_coach_at).length

  return (
    <div className="rounded-2xl border border-rose-200 overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#FEF2F2 0%,#FFF8F8 60%,#FFFFFF 100%)' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-rose-100/80">
        <div>
          <h3 className="text-sm font-bold text-rose-900">Активные рекомендации</h3>
          <p className="text-2xs text-rose-700/80 mt-0.5">
            {recs.length} рекомендаций
            {unack > 0 ? ` · ${unack} не ack тренером` : ''}
          </p>
        </div>
        <Link href="/org/members" className="text-[11px] font-semibold text-rose-600 hover:underline">
          Все →
        </Link>
      </div>

      <div className="divide-y divide-rose-100/70">
        {recs.slice(0, 6).map(r => {
          const cat = CATEGORY_META[r.category]
          const sev = SEVERITY_META[r.severity]
          const athleteName = nameById.get(r.athlete_id) ?? 'Атлет'
          const doctorName = nameById.get(r.doctor_id) ?? 'Врач'
          return (
            <div key={r.id} className="flex items-start gap-3 px-5 py-3">
              <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
                style={{ background: sev.bg, border: `1px solid ${sev.border}`, color: sev.color }}>
                <i className={`ki-filled ${cat.icon} text-sm`} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-bold text-foreground truncate max-w-[160px]">{athleteName}</span>
                  <span className="rounded-full px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider"
                    style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}>
                    {sev.label}
                  </span>
                  <Badge variant="secondary" size="sm" className="!rounded-full !font-semibold">
                    {cat.label}
                  </Badge>
                  {r.acknowledged_by_coach_at ? (
                    <Badge variant="success" size="sm" className="!rounded-full uppercase tracking-wider">
                      Тренер ack
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="sm" className="!rounded-full uppercase tracking-wider">
                      Не ack
                    </Badge>
                  )}
                </div>
                {r.title ? (
                  <div className="mt-0.5 text-[12px] text-foreground/90 truncate">{r.title}</div>
                ) : (
                  <div className="mt-0.5 text-[12px] italic text-muted-foreground">
                    🔒 содержание скрыто (не org_full visibility)
                  </div>
                )}
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} · от {doctorName}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {recs.length > 6 && (
        <div className="px-5 py-2.5 border-t border-rose-100/70 bg-white/60 text-center">
          <Link href="/org/members" className="text-[11px] font-semibold text-rose-600 hover:underline">
            Ещё {recs.length - 6} →
          </Link>
        </div>
      )}
    </div>
  )
}
