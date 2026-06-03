'use client'
/**
 * /coach/inquiries — Sprint W5 Day 26 (PR #43).
 *
 * Coach UI для doctor inquiries:
 *   - List own sent inquiries (всех statuses)
 *   - Create modal: athlete picker + question_type + urgency + free-text + optional doctor_id
 *   - Per-inquiry: status badge + response preview если answered + cancel for pending
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import {
  listMyCoachInquiries, createInquiry, cancelInquiry, listMyAssignedAthletes,
  QUESTION_TYPE_META, URGENCY_META, STATUS_META,
  type InquiryWithUsers, type QuestionType, type Urgency, type AthleteOption,
} from '@/services/doctor-inquiries.service'
import { Card, Alert } from '@/components/ui/metronic'

type FilterTab = 'all' | 'pending' | 'answered' | 'expired'

export default function CoachInquiriesPage() {
  const { user, loading: userLoading } = useUser()
  const [inquiries, setInquiries]       = useState<InquiryWithUsers[]>([])
  const [loading, setLoading]           = useState(true)
  const [filter, setFilter]             = useState<FilterTab>('all')

  const [showCreate, setShowCreate]     = useState(false)
  const [athletes, setAthletes]         = useState<AthleteOption[]>([])

  // Form state
  const [athleteId, setAthleteId]       = useState('')
  const [questionType, setQuestionType] = useState<QuestionType>('load_clearance')
  const [urgency, setUrgency]           = useState<Urgency>('routine')
  const [question, setQuestion]         = useState('')
  const [saving, setSaving]             = useState(false)
  const [formError, setFormError]       = useState<string | null>(null)
  const [busyId, setBusyId]             = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const list = await listMyCoachInquiries()
    setInquiries(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (userLoading) return
    if (!user || (user.role !== 'coach')) {
      setLoading(false); return
    }
    load()
  }, [user, userLoading, load])

  async function openCreate() {
    setFormError(null)
    const list = await listMyAssignedAthletes()
    setAthletes(list)
    if (list.length > 0 && !athleteId) setAthleteId(list[0].id)
    setShowCreate(true)
  }

  async function handleSubmit() {
    setFormError(null)
    if (!athleteId) { setFormError('Выберите атлета'); return }
    if (question.trim().length < 10) { setFormError('Минимум 10 символов в вопросе'); return }
    setSaving(true)
    try {
      const result = await createInquiry({
        athlete_id:    athleteId,
        question,
        question_type: questionType,
        urgency,
      })
      if (!result) { setFormError('Не удалось создать запрос'); return }
      // Sprint W6 Day 28: fire-and-forget email notification to doctor(s).
      // Silent fail — inquiry stays in queue even if email delivery breaks.
      fetch(`/api/doctor-inquiries/${result.id}/notify`, { method: 'POST' })
        .catch(e => console.warn('[coach/inquiries] notify failed', e))
      setShowCreate(false)
      setQuestion('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel(id: string) {
    if (!confirm('Отменить запрос врачу?')) return
    setBusyId(id)
    try {
      if (await cancelInquiry(id)) await load()
    } finally { setBusyId(null) }
  }

  const filtered = useMemo(() => {
    if (filter === 'all') return inquiries
    return inquiries.filter(i => i.status === filter)
  }, [inquiries, filter])

  const counts = useMemo(() => ({
    all:      inquiries.length,
    pending:  inquiries.filter(i => i.status === 'pending').length,
    answered: inquiries.filter(i => i.status === 'answered').length,
    expired:  inquiries.filter(i => i.status === 'expired').length,
  }), [inquiries])

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (!user || (user.role !== 'coach')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <i className="ki-filled ki-shield-cross text-3xl text-red-400" />
        <p className="text-sm font-semibold text-foreground">Требуется доступ тренера</p>
        <Link href="/dashboard" className="text-sm text-orange-600 font-semibold hover:underline">← На главную</Link>
      </div>
    )
  }

  return (
    <div className="pf-enter max-w-5xl mx-auto px-4 py-8 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground mb-1">Тренер · Запросы врачу</p>
          <h1 className="text-3xl font-bold text-foreground">Doctor Inquiries</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">
            Запрашивайте медицинское заключение перед допуском к нагрузке. Документированная цепочка
            решений снижает вашу ответственность.
          </p>
        </div>
        <button onClick={openCreate}
          className="rounded-2xl bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white px-5 py-2.5 text-sm font-bold shadow-md inline-flex items-center gap-1.5">
          <i className="ki-filled ki-plus text-sm" />
          Новый запрос
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(['all','pending','answered','expired'] as FilterTab[]).map(t => {
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

      {/* Inquiries list */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border bg-accent/30 px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 mb-4">
            <i className="ki-filled ki-message-question text-2xl" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            {filter === 'all' ? 'У вас пока нет запросов' : `Нет запросов в статусе "${STATUS_META[filter as keyof typeof STATUS_META]?.label ?? filter}"`}
          </h3>
          <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
            Запросите медицинское заключение когда сомневаетесь в готовности атлета к нагрузке.
          </p>
          <button onClick={openCreate}
            className="mt-4 rounded-xl bg-violet-500 hover:bg-violet-600 text-white px-5 py-2.5 text-sm font-semibold">
            + Создать первый запрос
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(i => {
            const qt = QUESTION_TYPE_META[i.question_type]
            const ur = URGENCY_META[i.urgency]
            const st = STATUS_META[i.status]
            return (
              <Card key={i.id} className="p-4">
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
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mb-1">
                  Атлет: <strong className="text-foreground">{i.athlete_name ?? i.athlete_id.slice(0, 8)}</strong>
                  {i.doctor_name && <> · Врач: <strong className="text-foreground">{i.doctor_name}</strong></>}
                  {!i.doctor_name && i.status === 'pending' && <> · ⏳ Открытая очередь</>}
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap mb-2">{i.question}</p>
                {i.response && (
                  <Alert variant="success" className="mt-3"
                    title={`Ответ врача · ${i.responded_at ? new Date(i.responded_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : ''}`}>
                    <p className="whitespace-pre-wrap">{i.response}</p>
                  </Alert>
                )}
                {i.status === 'pending' && (
                  <div className="flex justify-end mt-2">
                    <button onClick={() => handleCancel(i.id)} disabled={busyId === i.id}
                      className="rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground px-3 py-1 text-xs font-semibold">
                      Отменить
                    </button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-8 overflow-y-auto"
          onClick={() => setShowCreate(false)}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div onClick={e => e.stopPropagation()}
            className="relative z-10 w-full max-w-md rounded-2xl bg-background shadow-2xl border border-border">
            <div className="border-b border-border px-5 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Новый запрос врачу</h3>
              <button onClick={() => setShowCreate(false)} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
                <i className="ki-filled ki-cross text-xs" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {athletes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  У вас пока нет атлетов с принятой связью. Добавьте атлетов через /athletes.
                </p>
              ) : (
                <>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Атлет *</label>
                    <select value={athleteId} onChange={e => setAthleteId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-violet-400">
                      {athletes.map(a => <option key={a.id} value={a.id}>{a.name ?? a.id.slice(0, 8)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Тип вопроса</label>
                    <select value={questionType} onChange={e => setQuestionType(e.target.value as QuestionType)}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-violet-400">
                      {(Object.entries(QUESTION_TYPE_META) as Array<[QuestionType, typeof QUESTION_TYPE_META[QuestionType]]>).map(([k, v]) =>
                        <option key={k} value={k}>{v.emoji} {v.label}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Срочность</label>
                    <div className="mt-1 flex gap-1.5">
                      {(['routine','urgent','red_flag'] as Urgency[]).map(u => {
                        const m = URGENCY_META[u]
                        const sel = urgency === u
                        return (
                          <button key={u} type="button" onClick={() => setUrgency(u)}
                            className={`flex-1 rounded-lg border-2 px-2 py-1.5 text-[11px] font-bold transition ${
                              sel ? 'ring-2 ring-current' : 'opacity-60 hover:opacity-100'
                            }`}
                            style={{ background: m.bg, color: m.color, borderColor: m.border }}>
                            {m.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Вопрос * (мин. 10 символов)</label>
                    <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={5} maxLength={2000}
                      placeholder={QUESTION_TYPE_META[questionType].placeholder}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-violet-400 resize-vertical" />
                    <p className="mt-1 text-[10px] text-muted-foreground">{question.length}/2000</p>
                  </div>
                  {formError && (
                    <Alert variant="destructive">{formError}</Alert>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-border px-5 py-3">
              <button onClick={handleSubmit} disabled={saving || athletes.length === 0 || question.trim().length < 10}
                className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {saving ? 'Отправляем…' : 'Отправить врачу'}
              </button>
              <button onClick={() => setShowCreate(false)} disabled={saving}
                className="rounded-xl border border-border bg-background hover:bg-muted px-4 py-2.5 text-sm font-semibold">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
