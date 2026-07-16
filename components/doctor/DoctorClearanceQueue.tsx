'use client'

/**
 * DoctorClearanceQueue — P0: очередь допусков на дашборде врача.
 *
 * Светофор допуска — главный ежедневный артефакт врача (ров продукта), но
 * до этого виджета у него не было входа с дашборда: врач попадал на
 * /doctor/clearances только через sidebar. Показывает допуски с
 * review_needed = true (истёк valid_until у не-full статуса — по дизайну
 * миграции 092 это forcing function на пересмотр).
 *
 * RLS view current_clearances (security_invoker) скоупит выборку к пациентам
 * врача. Скрывается целиком, когда пересматривать нечего.
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

const STATUS_LABEL: Record<string, string> = {
  full:       'Полный допуск',
  limited:    'Ограниченный',
  light_only: 'Только лёгкая',
  banned:     'Запрещено',
}

interface Row {
  athlete_id: string
  status: string
  valid_until: string | null
  athleteName: string
}

export default function DoctorClearanceQueue() {
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, count } = await (sb() as any)
        .from('current_clearances')
        .select('athlete_id, status, valid_until', { count: 'exact' })
        .eq('review_needed', true)
        .order('valid_until', { ascending: true })
        .limit(5)
      if (cancelled || !data?.length) { if (!cancelled) { setRows([]); setTotal(0) } return }
      const ids = (data as Array<{ athlete_id: string }>).map(r => r.athlete_id)
      const { data: users } = await sb().from('users').select('id, name').in('id', ids)
      const nameMap = new Map((users ?? []).map(u => [u.id, u.name ?? 'Атлет']))
      if (cancelled) return
      setRows((data as Array<Omit<Row, 'athleteName'>>).map(r => ({
        ...r,
        athleteName: nameMap.get(r.athlete_id) ?? 'Атлет',
      })))
      setTotal(count ?? data.length)
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (rows.length === 0) return null

  return (
    <Card className="overflow-hidden border-orange-200">
      <div className="flex items-center justify-between border-b border-border bg-orange-50/60 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
            <i className="ki-filled ki-shield-tick text-sm" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-navy-500">Допуски: требуют пересмотра</h3>
            <p className="text-2xs text-muted-foreground">Срок действия истёк — статус помечен серым у тренера и атлета</p>
          </div>
        </div>
        <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-2xs font-bold text-orange-700">{total}</span>
      </div>
      <div className="divide-y divide-border">
        {rows.map(r => (
          <div key={r.athlete_id} className="flex items-center gap-3 px-5 py-3">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-slate-400" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">{r.athleteName}</div>
              <div className="text-2xs text-muted-foreground">
                {STATUS_LABEL[r.status] ?? r.status}
                {r.valid_until ? ` · истёк ${new Date(r.valid_until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}` : ''}
              </div>
            </div>
            <Link
              href="/doctor/clearances"
              className="shrink-0 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-2xs font-semibold text-orange-700 transition-colors hover:bg-orange-100"
            >
              Пересмотреть
            </Link>
          </div>
        ))}
      </div>
      <div className="border-t border-border px-5 py-2.5">
        <Link href="/doctor/clearances" className="text-2xs font-semibold text-orange-700 hover:underline">
          Все допуски →
        </Link>
      </div>
    </Card>
  )
}
