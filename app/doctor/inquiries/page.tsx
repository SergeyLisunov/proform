'use client'
/**
 * /doctor/inquiries — Sprint W5 Day 26 (PR #43).
 *
 * Doctor queue:
 *   - Pending: inquiries assigned к me OR open queue (doctor_id=null)
 *   - Answered: история ответов
 *   - Inline reply textarea per inquiry → POST → status='answered' + claim
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import { Alert } from '@/components/ui/metronic'
import {
  listMyDoctorInquiries, respondToInquiry,
  QUESTION_TYPE_META, URGENCY_META, STATUS_META,
  type InquiryWithUsers,
} from '@/services/doctor-inquiries.service'

type FilterTab = 'pending' | 'answered' | 'all'

export default function DoctorInquiriesPage() {
  const { user, loading: userLoading } = useUser()
  const [inquiries, setInquiries] = useState<InquiryWithUsers[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<FilterTab>('pending')

  const [responseInputs, setResponseInputs] = useState<Record<string, string>>({})
  const [busyId, setBusyId]                 = useState<string | null>(null)

  // ── Sprint W6 Day 28: "Save as restriction" → recommendations ──────
  const [convertOpenId, setConvertOpenId]     = useState<string | null>(null)
  const [convertCategory, setConvertCategory] = useState<string>('activity_restriction')
  const [convertSeverity, setConvertSeverity] = useState<string>('moderate')
  const [convertValidUntil, setConvertValidUntil] = useState<string>('')
  const [convertBusy, setConvertBusy]         = useState(false)
  const [convertError, setConvertError]       = useState<string | null>(null)
  const [convertedMap, setConvertedMap]       = useState<Record<string, { id: string; title: string }>>({})

  function openConvertForm(id: string) {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    setConvertValidUntil(d.toISOString().slice(0, 10))
    setConvertCategory('activity_restriction')
    setConvertSeverity('moderate')
    setConvertError(null)
    setConvertOpenId(id)
  }

  async function handleConvert(inquiryId: string) {
    setConvertBusy(true); setConvertError(null)
    try {
      const res = await fetch(`/api/doctor-inquiries/${inquiryId}/convert-to-recommendation`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          category: convertCategory,
          severity: convertSeverity,
          valid_until: convertValidUntil || null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) {
        setConvertError(j.error ?? `HTTP ${res.status}`)
        return
      }
      if (j.recommendation) {
        setConvertedMap(prev => ({
          ...prev,
          [inquiryId]: { id: j.recommendation.id, title: j.recommendation.title },
        }))
        setConvertOpenId(null)
      }
    } catch (e) {
      setConvertError(e instanceof Error ? e.message : 'CONVERT_FAILED')
    } finally {
      setConvertBusy(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    const list = await listMyDoctorInquiries()
    setInquiries(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (userLoading) return
    if (!user || user.role !== 'doctor') { setLoading(false); return }
    load()
  }, [user, userLoading, load])

  async function handleRespond(inquiryId: string) {
    const text = (responseInputs[inquiryId] ?? '').trim()
    if (text.length < 5) return
    setBusyId(inquiryId)
    try {
      const ok = await respondToInquiry(inquiryId, text)
      if (ok) {
        setResponseInputs(prev => ({ ...prev, [inquiryId]: '' }))
        await load()
      }
    } finally { setBusyId(null) }
  }

  const filtered = useMemo(() => {
    if (filter === 'all') return inquiries
    return inquiries.filter(i => i.status === filter)
  }, [inquiries, filter])

  const counts = useMemo(() => ({
    pending:  inquiries.filter(i => i.status === 'pending').length,
    answered: inquiries.filter(i => i.status === 'answered').length,
    all:      inquiries.length,
  }), [inquiries])

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (!user || user.role !== 'doctor') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <i className="ki-filled ki-shield-cross text-3xl text-red-400" />
        <p className="text-sm font-semibold text-foreground">Требуется доступ врача</p>
        <Link href="/dashboard" className="text-sm text-violet-600 font-semibold hover:underline">← На главную</Link>
      </div>
    )
  }

  return (
    <div className="pf-enter max-w-5xl mx-auto px-4 py-8 flex flex-col gap-5">
      <div>
        <p className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground mb-1">Врач · Запросы</p>
        <h1 className="text-3xl font-bold text-foreground">Doctor Inquiries</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-xl">
          Запросы от тренеров на медицинское заключение. Ответ структурирован и сохраняется в системе —
          coach + athlete видят результат.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(['pending','answered','all'] as FilterTab[]).map(t => {
          const meta = t === 'all' ? null : STATUS_META[t as keyof typeof STATUS_META]
          const label = t === 'all' ? 'Все' : meta!.label
          const count = counts[t]
          const active = filter === t
          return (
            <button key={t} onClick={() => setFilter(t)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition border ${
                active
                  ? 'border-violet-300 bg-violet-50 text-violet-700'
                  : 'border-border bg-background hover:border-violet-200 text-muted-foreground'
              }`}>
              {meta ? `${meta.emoji} ` : ''}{label} · {count}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border bg-accent/30 px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 mb-4">
            <i className="ki-filled ki-message-question text-2xl" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            {filter === 'pending' ? 'Нет ожидающих запросов' : filter === 'answered' ? 'История ответов пуста' : 'Запросов нет'}
          </h3>
          <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
            Когда coach создаёт inquiry — он появится здесь.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(i => {
            const qt = QUESTION_TYPE_META[i.question_type]
            const ur = URGENCY_META[i.urgency]
            const st = STATUS_META[i.status]
            const responseInput = responseInputs[i.id] ?? ''
            const isPending = i.status === 'pending'
            return (
              <div key={i.id} className="rounded-2xl border-2 p-4"
                style={isPending && i.urgency === 'red_flag' ? { borderColor: '#FECACA', background: '#FEF2F2' }
                  : isPending && i.urgency === 'urgent' ? { borderColor: '#FED7AA', background: '#FFF7ED' }
                  : { borderColor: 'var(--border)' }}>
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: qt.bg, color: qt.color, border: `1px solid ${qt.border}` }}>
                      {qt.emoji} {qt.label}
                    </span>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: ur.bg, color: ur.color, border: `1px solid ${ur.border}` }}>
                      {ur.label}
                    </span>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                      {st.emoji} {st.label}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(i.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {isPending && ` · expires ${new Date(i.expires_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  От: <strong className="text-foreground">{i.coach_name ?? i.coach_id.slice(0, 8)}</strong>
                  {' · Атлет: '}
                  <strong className="text-foreground">{i.athlete_name ?? i.athlete_id.slice(0, 8)}</strong>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap mb-3">{i.question}</p>

                {i.response && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 mb-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1">
                      Ваш ответ · {i.responded_at ? new Date(i.responded_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : ''}
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{i.response}</p>
                  </div>
                )}

                {/* Sprint W6 Day 28: one-click "save as restriction" → recommendation */}
                {i.response && i.status === 'answered' && (
                  <div className="mb-2">
                    {convertedMap[i.id] ? (
                      <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800 flex items-center gap-2">
                        <i className="ki-filled ki-check-circle text-sm" />
                        <span>Создана рекомендация: <strong>{convertedMap[i.id].title}</strong></span>
                      </div>
                    ) : convertOpenId === i.id ? (
                      <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-3 space-y-2.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-violet-800">
                          Сохранить как ограничение
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Категория
                            <select value={convertCategory} onChange={e => setConvertCategory(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-violet-400">
                              <option value="activity_restriction">Ограничение активности</option>
                              <option value="load_restriction">Ограничение нагрузки</option>
                              <option value="recovery">Восстановление</option>
                              <option value="observation">Наблюдение</option>
                              <option value="clearance">Допуск</option>
                              <option value="referral">Направление</option>
                              <option value="general">Общая рекомендация</option>
                            </select>
                          </label>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Тяжесть
                            <select value={convertSeverity} onChange={e => setConvertSeverity(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-violet-400">
                              <option value="low">Низкая</option>
                              <option value="moderate">Умеренная</option>
                              <option value="high">Высокая</option>
                              <option value="critical">Критическая</option>
                            </select>
                          </label>
                        </div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">
                          Действует до
                          <input type="date" value={convertValidUntil}
                            onChange={e => setConvertValidUntil(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-violet-400" />
                        </label>
                        {convertError && (
                          <Alert variant="destructive">{convertError}</Alert>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <button onClick={() => handleConvert(i.id)} disabled={convertBusy}
                            className="flex-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 text-xs font-bold disabled:opacity-50">
                            {convertBusy ? 'Сохраняем…' : 'Создать рекомендацию'}
                          </button>
                          <button onClick={() => setConvertOpenId(null)} disabled={convertBusy}
                            className="rounded-lg border border-border bg-background hover:bg-muted px-3 py-1.5 text-xs font-semibold">
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => openConvertForm(i.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 px-3 py-1.5 text-xs font-semibold">
                        <i className="ki-filled ki-plus text-xs" />
                        Сохранить как ограничение
                      </button>
                    )}
                  </div>
                )}

                {isPending && (
                  <div className="border-t border-border pt-3 mt-3">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Ваш ответ</label>
                    <textarea value={responseInput}
                      onChange={e => setResponseInputs(prev => ({ ...prev, [i.id]: e.target.value }))}
                      rows={3} maxLength={4000}
                      placeholder="Структурированный ответ: оценка, рекомендация по нагрузке, follow-up"
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-violet-400 resize-vertical" />
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <p className="text-[10px] text-muted-foreground">{responseInput.length}/4000 · мин 5 символов</p>
                      <button onClick={() => handleRespond(i.id)} disabled={busyId === i.id || responseInput.trim().length < 5}
                        className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-4 py-1.5 text-xs font-bold disabled:opacity-50">
                        {busyId === i.id ? 'Отправляем…' : 'Отправить ответ'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
