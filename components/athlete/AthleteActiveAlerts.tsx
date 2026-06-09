'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { listInjuries, BODY_PART_LABELS, SEVERITY_LABELS, type Injury } from '@/services/injuries.service'
import { Alert } from '@/components/ui/metronic'

interface PassRow {
  id: string
  title: string | null
  expires_at: string | null
  total_sessions: number
  used_sessions: number
}

/**
 * Полоса активных сигналов: травмы (active/recovering) + истекающие
 * абонементы. Если ничего срочного — компонент возвращает null,
 * чтобы не загромождать.
 */
export default function AthleteActiveAlerts({ athleteId }: { athleteId: string }) {
  const [injuries, setInjuries] = useState<Injury[]>([])
  const [passes, setPasses] = useState<PassRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sb = createClient()
      const today = new Date().toISOString().slice(0, 10)
      const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
      const [inj, pas] = await Promise.all([
        listInjuries({ athleteId }),
        sb.from('athlete_passes')
          .select('id, title, expires_at, total_sessions, used_sessions')
          .eq('athlete_id', athleteId)
          .eq('status', 'active')
          .gte('expires_at', today)
          .lte('expires_at', in14)
          .order('expires_at', { ascending: true }),
      ])
      setInjuries(inj.filter(i => i.status === 'active' || i.status === 'recovering').slice(0, 4))
      setPasses(((pas.data ?? []) as PassRow[]).slice(0, 3))
    } finally { setLoading(false) }
  }, [athleteId])

  useEffect(() => { load() }, [load])

  if (loading) return null
  if (injuries.length === 0 && passes.length === 0) return null

  return (
    <Alert variant="primary" title="Требуют внимания" icon="ki-information-5">
      <div className="flex flex-wrap gap-2 mt-1">
        {injuries.map(i => {
          const sev = SEVERITY_LABELS[i.severity]
          const part = BODY_PART_LABELS[i.body_part] ?? i.body_part
          const isActive = i.status === 'active'
          return (
            <Link key={i.id} href="/injuries"
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] hover:shadow-sm transition-shadow ${
                isActive ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'
              }`}>
              <span className={`inline-flex items-center ${isActive ? 'text-red-600' : 'text-orange-600'}`}>
                <i className={`ki-filled ${isActive ? 'ki-shield-cross' : 'ki-arrows-circle'} text-[13px]`} />
              </span>
              <span>
                <strong className="text-foreground">{part}</strong>
                <span className="text-muted-foreground"> · {sev.toLowerCase()}</span>
                {i.status === 'recovering' && <span className="text-muted-foreground"> · восстановление</span>}
              </span>
            </Link>
          )
        })}

        {passes.map(p => {
          const remaining = Math.max(0, p.total_sessions - p.used_sessions)
          const expires = p.expires_at ? new Date(p.expires_at + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '—'
          return (
            <Link key={p.id} href="/calendar"
              className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-[12px] hover:shadow-sm transition-shadow">
              <span className="inline-flex items-center text-purple-600"><i className="ki-filled ki-time text-[13px]" /></span>
              <span>
                <strong className="text-foreground">{p.title ?? 'Абонемент'}</strong>
                <span className="text-muted-foreground"> · {remaining} занятий до {expires}</span>
              </span>
            </Link>
          )
        })}
      </div>
    </Alert>
  )
}
