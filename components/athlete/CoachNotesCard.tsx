'use client'

/**
 * CoachNotesCard — расшаренные записи дневника тренера у атлета
 * (P1, «share-флаги в никуда»).
 *
 * Инфраструктура шэринга существует с миграции 035: RLS-политика
 * obs_diary_shared_to_athlete + уведомление при включении флага — но у
 * атлета не было НИ ОДНОЙ поверхности, где записи можно прочитать:
 * клик по уведомлению вёл в пустоту. Карточка показывает последние
 * расшаренные записи на дашборде. Скрывается, пока записей нет.
 */
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/metronic'
import { ENTRY_TYPE_META, type DiaryEntryType } from '@/services/coach-diary.service'

interface SharedNote {
  id: string
  date: string
  entry_type: DiaryEntryType
  title: string | null
  note: string
}

export default function CoachNotesCard({ athleteId }: { athleteId: string }) {
  const [rows, setRows] = useState<SharedNote[]>([])

  useEffect(() => {
    let cancelled = false
    const sb = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(sb as any)
      .from('observation_diary')
      .select('id, date, entry_type, title, note')
      .eq('athlete_id', athleteId)
      .eq('is_shared_with_athlete', true)
      .order('date', { ascending: false })
      .limit(3)
      .then(({ data }: { data: SharedNote[] | null }) => {
        if (!cancelled) setRows(data ?? [])
      })
    return () => { cancelled = true }
  }, [athleteId])

  if (rows.length === 0) return null

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <i className="ki-filled ki-notepad-edit text-sm" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-navy-500">Заметки тренера</h3>
          <p className="text-2xs text-muted-foreground">Записи, которыми тренер поделился с вами</p>
        </div>
      </div>
      <div className="divide-y divide-border">
        {rows.map(r => {
          const meta = ENTRY_TYPE_META[r.entry_type]
          return (
            <div key={r.id} className="px-5 py-3.5">
              <div className="mb-1 flex items-center gap-2">
                {meta && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold"
                    style={{ color: meta.color, backgroundColor: meta.bg, border: `1px solid ${meta.border}` }}
                  >
                    <i className={`ki-filled ${meta.icon} text-[10px]`} />
                    {meta.label}
                  </span>
                )}
                <span className="text-2xs text-muted-foreground">
                  {new Date(r.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              {r.title && <div className="text-sm font-semibold text-foreground">{r.title}</div>}
              <p className="line-clamp-3 whitespace-pre-line text-sm text-slate-700">{r.note}</p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
