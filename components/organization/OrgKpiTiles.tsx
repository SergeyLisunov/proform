'use client'
/**
 * OrgKpiTiles — Sprint W2 Day 11.
 *
 * KPI ленточка для Org Dashboard. Aggregates:
 *   - athletes count (org_members.member_role='athlete' active)
 *   - coaches count
 *   - doctors+specialists count (with breakdown)
 *   - active recommendations count + unack-by-coach
 *   - athletes-at-risk — уникальные спортсмены с активной рекомендацией
 *     severity high/critical по этой организации.
 *   - MRR placeholder (zero until ЮKassa active subscriptions)
 *
 * Травмы в расчёт риска не входят намеренно: RLS injuries (миграция 106)
 * пускает только связанного тренера, врача и самого спортсмена — у
 * организации доступа к медзаписям нет и не должно быть. Раньше здесь
 * висел запрос к injuries без скоупа по org: он всегда возвращал пустой
 * набор, поэтому плитка показывала 0 при любых реальных рисках.
 *
 * Data fetched in 2 batched calls — no waterfall. RLS scopes to user's
 * own org via org_members membership.
 */
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/metronic'

interface Tile {
  label: string
  value: string | number
  hint?: string
  icon: string
  color: string
  bg: string
  href?: string
}

interface OrgKpis {
  athletes: number
  coaches: number
  doctors: number
  specialists: number
  activeRecs: number
  unackByCoach: number
  athletesAtRisk: number
}

export default function OrgKpiTiles({ orgId }: { orgId: string }) {
  const [k, setK]           = useState<OrgKpis | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sb = createClient()
      const [
        { data: members },
        { data: recs },
      ] = await Promise.all([
        sb.from('org_members')
          .select('member_role')
          .eq('org_id', orgId)
          .eq('status', 'active'),
        // athlete_id нужен, чтобы считать УНИКАЛЬНЫХ спортсменов в риске:
        // без него прошлая версия не могла посчитать ничего и молча давала 0.
        // Медконтент (title/body) не запрашиваем — организации он не положен.
        sb.from('recommendations')
          .select('id, athlete_id, severity, acknowledged_by_coach_at, status')
          .eq('organization_id', orgId)
          .in('status', ['sent', 'active', 'acknowledged']),
      ])
      const m = (members ?? []) as Array<{ member_role: string }>
      const r = (recs ?? []) as Array<{ id: string; athlete_id: string; severity: string; acknowledged_by_coach_at: string | null; status: string }>

      // "athletes-at-risk" — уникальные спортсмены с активным ограничением
      // high/critical. Статусы уже отфильтрованы .in() выше.
      const atRiskAthletes = new Set<string>()
      for (const rec of r) {
        if (rec.severity === 'high' || rec.severity === 'critical') {
          atRiskAthletes.add(rec.athlete_id)
        }
      }

      setK({
        athletes:       m.filter(x => x.member_role === 'athlete').length,
        coaches:        m.filter(x => x.member_role === 'coach').length,
        doctors:        m.filter(x => x.member_role === 'doctor').length,
        specialists:    m.filter(x => x.member_role === 'specialist').length,
        activeRecs:     r.length,
        unackByCoach:   r.filter(x => x.acknowledged_by_coach_at == null).length,
        athletesAtRisk: atRiskAthletes.size,
      })
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { load() }, [load])

  if (loading || !k) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-5 animate-pulse rounded-2xl">
            <div className="h-3 w-2/3 bg-muted rounded mb-3" />
            <div className="h-8 w-1/2 bg-muted rounded" />
          </Card>
        ))}
      </div>
    )
  }

  const tiles: Tile[] = [
    {
      label: 'Атлеты',         value: k.athletes,
      hint: 'Активных в организации',
      icon: 'ki-people',         color: '#2563EB', bg: '#EFF6FF',
      href: '/org/athletes',
    },
    {
      label: 'Тренеры',        value: k.coaches,
      hint: k.coaches === 0 ? 'Пригласите первого' : 'Активных',
      icon: 'ki-shield-tick',    color: '#16A34A', bg: '#F0FDF4',
      href: '/org/coaches',
    },
    {
      label: 'Врачи / специалисты', value: `${k.doctors}/${k.specialists}`,
      hint: 'Doctor / Massage / Physio / Nutrition',
      icon: 'ki-heart-circle',   color: '#E11D48', bg: '#FEF2F2',
      href: '/org/members?role=doctor',
    },
    {
      label: 'Рекомендации',   value: k.activeRecs,
      hint: k.unackByCoach > 0 ? `${k.unackByCoach} не ack тренером` : 'Все учтены',
      icon: 'ki-clipboard', color: '#7C3AED', bg: '#FAF5FF',
    },
    {
      label: 'Атлеты в риске', value: k.athletesAtRisk,
      hint: k.athletesAtRisk === 0 ? 'Нет серьёзных ограничений' : 'Ограничения high/critical',
      icon: 'ki-shield-cross',   color: '#B91C1C', bg: '#FEF2F2',
    },
    {
      label: 'MRR',            value: '0₽',
      hint: 'После активации подписки',
      icon: 'ki-dollar',         color: '#15803D', bg: '#F0FDF4',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {tiles.map(t => {
        const inner = (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-2xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{t.label}</div>
              <div className="pf-num mt-2 text-2xl leading-none text-foreground">{t.value}</div>
              {t.hint && <div className="mt-2 text-2xs text-muted-foreground line-clamp-2">{t.hint}</div>}
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: t.bg }}>
              <i className={`ki-filled ${t.icon}`} style={{ color: t.color, fontSize: 18 }} />
            </div>
          </div>
        )
        return t.href ? (
          <a key={t.label} href={t.href} className="no-underline">
            <Card className="p-5 rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-md">
              {inner}
            </Card>
          </a>
        ) : (
          <Card key={t.label} className="p-5 rounded-2xl">
            {inner}
          </Card>
        )
      })}
    </div>
  )
}
