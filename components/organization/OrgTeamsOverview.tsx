'use client'
/**
 * OrgTeamsOverview — Sprint W2 Day 11.
 *
 * Compact teams overview widget на Org Dashboard. Использует
 * listOrgGroups (Day 10). Показывает максимум 4 команды + ссылку
 * "Все команды" → /org/teams.
 *
 * Empty state CTA → создать первую команду.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { listOrgGroups, LEVEL_META, type OrgGroupWithCounts } from '@/services/org-groups.service'
import { Card, Badge } from '@/components/ui/metronic'

export default function OrgTeamsOverview({ orgId }: { orgId: string }) {
  const [groups, setGroups]   = useState<OrgGroupWithCounts[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setGroups(await listOrgGroups(orgId))
    } finally { setLoading(false) }
  }, [orgId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <Card className="p-5 rounded-2xl">
        <p className="text-sm font-bold mb-3">Загрузка команд…</p>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </Card>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/30 p-6 text-center">
        <i className="ki-filled ki-people text-3xl text-violet-500 mb-2 block" />
        <p className="text-sm font-semibold text-foreground">Команд пока нет</p>
        <p className="text-xs text-muted-foreground mt-1">Группируйте атлетов по возрасту и уровню.</p>
        <Link href="/org/teams"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-violet-600 hover:underline">
          Создать первую команду →
        </Link>
      </div>
    )
  }

  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-bold text-foreground">Команды</h3>
          <p className="text-2xs text-muted-foreground mt-0.5">
            {groups.length} активных групп
          </p>
        </div>
        <Link href="/org/teams" className="text-[11px] font-semibold text-violet-600 hover:underline">
          Все →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5">
        {groups.slice(0, 4).map(g => {
          const lvl = g.level ? LEVEL_META[g.level] : null
          const ageRange = g.age_min && g.age_max ? `${g.age_min}–${g.age_max}` :
                          g.age_min ? `${g.age_min}+` :
                          g.age_max ? `до ${g.age_max}` : null
          return (
            <div key={g.id} className="rounded-xl border border-border bg-background p-3 hover:border-violet-200 transition-all">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="text-sm font-bold text-foreground truncate flex-1">{g.name}</h4>
                <div className="text-right shrink-0">
                  <div className="pf-num text-lg leading-none text-foreground font-bold">{g.athletes_count}</div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">атл.</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {ageRange && (
                  <Badge variant="warning" size="sm" className="!rounded-full uppercase tracking-wider">
                    {ageRange}
                  </Badge>
                )}
                {lvl && (
                  <span className="rounded-full px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider"
                    style={{ background: lvl.bg, color: lvl.color, border: `1px solid ${lvl.border}` }}>
                    {lvl.label}
                  </span>
                )}
                {g.head_coach && (
                  <span className="text-[10px] text-muted-foreground truncate">
                    тр. {g.head_coach.name ?? '—'}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
