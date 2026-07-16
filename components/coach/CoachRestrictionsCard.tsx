'use client'

/**
 * CoachRestrictionsCard — P0: клиентское возрождение серверного
 * CoachRestrictionsWidget (лежал мёртвым кодом в неимпортируемом
 * CoachDashboard.tsx). Замыкает петлю врач → тренер на живом дашборде:
 * записи medical_diary, которыми врач поделился с тренером
 * (is_shared_with_coach = true), по атлетам тренера.
 *
 * RLS-политика medical_diary_coach_shared гарантирует: тренер видит только
 * whitelisted-врачом записи и только по связанным атлетам. Скрывается
 * целиком, если активных ограничений нет — не шумит тренерам здоровых команд.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { Card } from '@/components/ui/metronic'

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

const SEVERITY: Record<string, { bg: string; fg: string; border: string; label: string }> = {
  low:      { bg: '#F0FDF4', fg: '#15803D', border: '#BBF7D0', label: 'низкая' },
  moderate: { bg: '#FEF0E7', fg: '#B03D04', border: '#FBC1A0', label: 'средняя' },
  high:     { bg: '#FEF2F2', fg: '#B91C1C', border: '#FECACA', label: 'высокая' },
  critical: { bg: '#FEE2E2', fg: '#7F1D1D', border: '#FCA5A5', label: 'критично' },
}

interface Entry {
  id: string
  athlete_id: string
  date: string
  entry_type: string | null
  title: string | null
  note: string | null
  severity: string | null
  athleteName: string
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export default function CoachRestrictionsCard({ athleteIds }: { athleteIds: string[] }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const idsKey = athleteIds.join(',')

  useEffect(() => {
    if (!idsKey) { setEntries([]); return }
    let cancelled = false
    async function load() {
      const ids = idsKey.split(',')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rows } = await (sb() as any)
        .from('medical_diary')
        .select('id, athlete_id, date, entry_type, title, note, severity')
        .in('athlete_id', ids)
        .eq('is_shared_with_coach', true)
        .order('date', { ascending: false })
        .limit(6)
      if (cancelled || !rows?.length) { if (!cancelled) setEntries([]); return }
      const athIds = [...new Set((rows as Array<{ athlete_id: string }>).map(r => r.athlete_id))]
      const { data: users } = await sb()
        .from('users').select('id, name').in('id', athIds)
      const nameMap = new Map((users ?? []).map(u => [u.id, u.name ?? 'Атлет']))
      if (cancelled) return
      setEntries((rows as Array<Omit<Entry, 'athleteName'>>).map(r => ({
        ...r,
        athleteName: nameMap.get(r.athlete_id) ?? 'Атлет',
      })))
    }
    load()
    return () => { cancelled = true }
  }, [idsKey])

  if (entries.length === 0) return null

  return (
    <Card className="overflow-hidden border-amber-200">
      <div className="flex items-center justify-between border-b border-border bg-amber-50/60 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <i className="ki-filled ki-shield-cross text-sm" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-navy-500">Ограничения от врача</h3>
            <p className="text-2xs text-muted-foreground">Записи, которыми врач поделился с вами</p>
          </div>
        </div>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-2xs font-bold text-amber-700">{entries.length}</span>
      </div>
      <div className="divide-y divide-border">
        {entries.map(e => {
          const sev = SEVERITY[e.severity ?? ''] ?? SEVERITY.moderate
          return (
            <div key={e.id} className="flex items-start gap-3 px-5 py-3">
              <span
                className="mt-0.5 inline-block shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ background: sev.bg, color: sev.fg, borderColor: sev.border }}
              >
                {sev.label}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">
                  {e.athleteName}
                  {e.title ? <span className="font-normal text-muted-foreground"> · {e.title}</span> : null}
                </div>
                {e.note && <p className="mt-0.5 line-clamp-2 text-2xs text-muted-foreground">{e.note}</p>}
              </div>
              <span className="shrink-0 text-2xs text-muted-foreground">{fmtDate(e.date)}</span>
            </div>
          )
        })}
      </div>
      <div className="border-t border-border px-5 py-2.5">
        <Link href="/athletes" className="text-2xs font-semibold text-amber-700 hover:underline">
          К карточкам атлетов →
        </Link>
      </div>
    </Card>
  )
}
