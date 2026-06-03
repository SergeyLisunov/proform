'use client'
/**
 * OrgRosterMatrix — Sprint W2 Day 11.
 *
 * Coach × athletes_count матрица для Org Dashboard. Показывает кто
 * перегружен, у кого недостаточно атлетов, кто неактивен. Data из
 * trainer_athletes (active links per coach) cross with org_members
 * (только тренеры этой org).
 *
 * Если у org < 1 coach — рендерит empty state с CTA "Пригласить
 * первого тренера".
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, Badge } from '@/components/ui/metronic'

interface RosterRow {
  coach_id: string
  coach_name: string
  athletes_count: number
}

export default function OrgRosterMatrix({ orgId }: { orgId: string }) {
  const [rows, setRows]       = useState<RosterRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sb = createClient()
      // 1. Coaches of this org
      const { data: members } = await sb
        .from('org_members')
        .select('user_id')
        .eq('org_id', orgId)
        .eq('member_role', 'coach')
        .eq('status', 'active')
      const coachIds = ((members ?? []) as Array<{ user_id: string }>).map(m => m.user_id)
      if (coachIds.length === 0) {
        setRows([])
        return
      }

      // 2. Counts per coach
      const { data: links } = await sb
        .from('trainer_athletes')
        .select('trainer_id, athlete_id')
        .in('trainer_id', coachIds)
        .eq('status', 'accepted')
      const counts = new Map<string, number>()
      for (const l of ((links ?? []) as Array<{ trainer_id: string }>)) {
        counts.set(l.trainer_id, (counts.get(l.trainer_id) ?? 0) + 1)
      }

      // 3. Names
      const { data: users } = await sb
        .from('users')
        .select('id, name')
        .in('id', coachIds)
      const nameById = new Map(((users ?? []) as Array<{ id: string; name: string | null }>)
        .map(u => [u.id, u.name ?? '—']))

      const r: RosterRow[] = coachIds.map(cid => ({
        coach_id:        cid,
        coach_name:      nameById.get(cid) ?? '—',
        athletes_count:  counts.get(cid) ?? 0,
      })).sort((a, b) => b.athletes_count - a.athletes_count)
      setRows(r)
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <Card className="p-5 rounded-2xl">
        <p className="text-sm font-bold mb-3">Загрузка тренеров…</p>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </Card>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-accent/30 p-6 text-center">
        <i className="ki-filled ki-shield-tick text-3xl text-muted-foreground mb-2 block" />
        <p className="text-sm font-semibold text-foreground">У организации нет активных тренеров</p>
        <Link href="/org/coaches"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:underline">
          Пригласить первого тренера →
        </Link>
      </div>
    )
  }

  // Highlight overloaded (>20 athletes) + idle (=0)
  const max = Math.max(...rows.map(r => r.athletes_count), 1)

  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-bold text-foreground">Загрузка тренеров</h3>
          <p className="text-2xs text-muted-foreground mt-0.5">
            Athletes per coach · отсортировано по убыванию
          </p>
        </div>
        <Link href="/org/coaches" className="text-[11px] font-semibold text-orange-600 hover:underline">
          Все →
        </Link>
      </div>

      <div className="divide-y divide-border">
        {rows.map(r => {
          const pct = (r.athletes_count / max) * 100
          const overloaded = r.athletes_count > 20
          const idle = r.athletes_count === 0
          return (
            <div key={r.coach_id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-accent/30 transition">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 text-xs font-bold text-orange-700">
                {r.coach_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground truncate">{r.coach_name}</span>
                  {overloaded && (
                    <Badge variant="destructive" size="sm" className="!rounded-full uppercase tracking-wider">
                      Перегружен
                    </Badge>
                  )}
                  {idle && (
                    <Badge variant="secondary" size="sm" className="!rounded-full uppercase tracking-wider">
                      Без атлетов
                    </Badge>
                  )}
                </div>
                <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: overloaded ? '#E11D48' : idle ? '#94A3B8' : '#F97316',
                    }} />
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="pf-num text-lg leading-none font-bold text-foreground">{r.athletes_count}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">атлетов</div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
