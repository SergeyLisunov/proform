'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import {
  listDiaryEntries, ENTRY_TYPE_META, RISK_LABELS, CATEGORY_LABELS, MOOD_EMOJI,
  type DiaryEntry,
} from '@/services/coach-diary.service'

/**
 * Печатная версия дневника тренера. Открывается как обычная страница
 * (чтобы заголовок был аккуратным в PDF), а `window.print()` вызывает
 * системный диалог "Сохранить как PDF".
 */

function todayISO() { return new Date().toISOString().slice(0, 10) }
function weekAgoISO() {
  const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10)
}
function fmt(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', weekday: 'long',
  })
}

function ExportInner() {
  const { user, loading: userLoading } = useUser()
  const sp = useSearchParams()
  const from = sp?.get('from') ?? weekAgoISO()
  const to   = sp?.get('to')   ?? todayISO()
  const athleteId = sp?.get('athlete') ?? undefined

  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [athleteName, setAthleteName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const all = await listDiaryEntries({
        coachId: user.id, athleteId,
      })
      const inRange = all.filter(e => e.date >= from && e.date <= to)
      setEntries(inRange)

      if (athleteId) {
        const sb = createClient()
        const { data } = await sb.from('users').select('name').eq('id', athleteId).maybeSingle()
        setAthleteName((data as { name: string | null } | null)?.name ?? null)
      }
    } finally { setLoading(false) }
  }, [user?.id, athleteId, from, to])

  useEffect(() => { load() }, [load])

  if (userLoading || loading) {
    return (
      <main className="p-10 text-sm text-slate-500">
        Готовим отчёт…
      </main>
    )
  }
  if (!user || user.role !== 'coach') {
    return <main className="p-10 text-sm text-red-500">Доступно только тренерам.</main>
  }

  // Group by date (desc).
  const byDate: Record<string, DiaryEntry[]> = {}
  for (const e of entries) (byDate[e.date] ??= []).push(e)
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  return (
    <main className="mx-auto max-w-[820px] px-8 py-10 bg-white text-slate-900 print:px-0 print:py-0">
      {/* Print controls — hidden on print */}
      <div className="mb-8 flex items-center justify-between print:hidden">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-600">ProForm · Дневник тренера</p>
          <h1 className="text-2xl font-bold mt-1">Отчёт {fmt(from)} — {fmt(to)}</h1>
        </div>
        <button onClick={() => window.print()}
          className="rounded-xl bg-orange-500 text-white px-5 py-2.5 text-sm font-semibold hover:bg-orange-600">
          <i className="ki-filled ki-printer text-xs mr-1" />
          Печать / PDF
        </button>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600">ProForm</p>
        <h1 className="text-xl font-bold">Дневник тренера — {user.name ?? 'без имени'}</h1>
        <p className="text-xs text-slate-500">
          Период: {fmt(from)} — {fmt(to)}
          {athleteName ? ` · Атлет: ${athleteName}` : ''}
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          За выбранный период записей нет.
        </div>
      ) : (
        <div className="space-y-6">
          {dates.map(d => (
            <section key={d} className="break-inside-avoid">
              <h2 className="text-sm font-bold text-orange-600 border-b border-slate-200 pb-1.5 mb-3">
                {fmt(d)}
              </h2>
              <div className="space-y-4">
                {byDate[d].map(e => {
                  const meta = ENTRY_TYPE_META[e.entry_type]
                  const risk = e.risk_level && e.risk_level !== 'critical' ? RISK_LABELS[e.risk_level] : null
                  return (
                    <article key={e.id}
                      className="rounded-lg border p-4 break-inside-avoid"
                      style={{ borderColor: meta.border, background: '#fff' }}>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
                          {meta.label}
                        </span>
                        {risk && (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: risk.color, background: risk.bg, border: `1px solid ${risk.border}` }}>
                            {risk.ru}
                          </span>
                        )}
                        {e.category && (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600">
                            {CATEGORY_LABELS[e.category]}
                          </span>
                        )}
                        {e.mood && <span className="text-sm">{MOOD_EMOJI[e.mood - 1]}</span>}
                        {e.energy_level && (
                          <span className="text-[10px] text-slate-500">энергия {e.energy_level}/10</span>
                        )}
                      </div>
                      {e.title && <h3 className="text-sm font-semibold mb-1">{e.title}</h3>}
                      <p className="text-[13px] whitespace-pre-wrap leading-relaxed text-slate-800">{e.note}</p>
                      {e.session_data?.key_metrics && (
                        <pre className="mt-2 rounded bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] font-mono whitespace-pre-wrap">
                          {e.session_data.key_metrics}
                        </pre>
                      )}
                      {e.tags && e.tags.length > 0 && (
                        <p className="mt-2 text-[11px] text-slate-500">
                          Теги: {e.tags.map(t => `#${t}`).join(' ')}
                        </p>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="hidden print:block mt-10 pt-4 border-t border-slate-200 text-[10px] text-slate-400 text-center">
        Сгенерировано ProForm · {new Date().toLocaleDateString('ru-RU')}
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; }
          aside, nav, header[class*="TopBar"] { display: none !important; }
          @page { size: A4; margin: 18mm 14mm; }
        }
      `}</style>
    </main>
  )
}

export default function DiaryExportPage() {
  return (
    <Suspense fallback={<main className="p-10 text-sm text-slate-500">Загружаем…</main>}>
      <ExportInner />
    </Suspense>
  )
}
