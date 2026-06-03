'use client'
/**
 * AskDoctorButton — Sprint W6 Day 28.
 *
 * Coach-facing CTA placed on athlete-card / profile pages. Opens a
 * right-side drawer with an inline inquiry form pre-filled with the
 * athlete_id. On submit:
 *   1. createInquiry() — inserts the row via RLS
 *   2. fire-and-forget /api/doctor-inquiries/[id]/notify — emails
 *      assigned doctor (or open queue fan-out, up to 20 doctors)
 *
 * This removes the previous 3-clicks UX (athlete card → /coach/inquiries
 * → New inquiry → pick athlete) down to 1 click on the athlete card.
 */
import { useState } from 'react'
import { Alert } from '@/components/ui/metronic'
import {
  createInquiry,
  QUESTION_TYPE_META,
  URGENCY_META,
  type QuestionType,
  type Urgency,
} from '@/services/doctor-inquiries.service'

interface AskDoctorButtonProps {
  athleteId:   string
  athleteName: string
  className?:  string
  onSubmitted?: () => void
}

export default function AskDoctorButton({ athleteId, athleteName, className, onSubmitted }: AskDoctorButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className
          ?? 'inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 px-3.5 py-2 text-xs font-semibold transition'}
      >
        <i className="ki-filled ki-message-question text-sm" />
        Спросить врача
      </button>

      {open && (
        <InquiryDrawer
          athleteId={athleteId}
          athleteName={athleteName}
          onClose={() => setOpen(false)}
          onSubmitted={onSubmitted}
        />
      )}
    </>
  )
}

interface DrawerProps {
  athleteId:   string
  athleteName: string
  onClose:     () => void
  onSubmitted?: () => void
}

function InquiryDrawer({ athleteId, athleteName, onClose, onSubmitted }: DrawerProps) {
  const [questionType, setQuestionType] = useState<QuestionType>('load_clearance')
  const [urgency, setUrgency]           = useState<Urgency>('routine')
  const [question, setQuestion]         = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [done, setDone]                 = useState<{ id: string; emailed: number } | null>(null)

  async function handleSubmit() {
    setError(null)
    if (question.trim().length < 10) { setError('Минимум 10 символов в вопросе'); return }
    setSaving(true)
    try {
      const created = await createInquiry({
        athlete_id:    athleteId,
        question,
        question_type: questionType,
        urgency,
      })
      if (!created) { setError('Не удалось создать запрос (проверьте связь с атлетом)'); setSaving(false); return }

      // Fire-and-forget notify. Surface the doctor email count in the
      // success state — coach gets quick feedback that delivery worked.
      let emailed = 0
      try {
        const res = await fetch(`/api/doctor-inquiries/${created.id}/notify`, { method: 'POST' })
        const j = await res.json().catch(() => ({}))
        emailed = typeof j.sent_count === 'number' ? j.sent_count : 0
      } catch { /* silent */ }

      setDone({ id: created.id, emailed })
      setQuestion('')
      onSubmitted?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CREATE_FAILED')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div
        onClick={e => e.stopPropagation()}
        className="relative z-10 flex h-full w-full max-w-md flex-col bg-background border-l border-border shadow-2xl"
      >
        <div className="border-b border-border px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Doctor inquiry</p>
            <h3 className="mt-0.5 text-lg font-semibold text-navy-500">Спросить врача</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Атлет: <strong className="text-foreground">{athleteName}</strong>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground" aria-label="Закрыть">
            <i className="ki-filled ki-cross text-sm" />
          </button>
        </div>

        {done ? (
          <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <i className="ki-filled ki-check-circle text-2xl" />
            </div>
            <h4 className="text-base font-semibold text-foreground">Запрос отправлен</h4>
            <p className="text-sm text-muted-foreground max-w-xs">
              {done.emailed > 0
                ? `Уведомление email отправлено врачам: ${done.emailed}.`
                : 'Запрос создан. Email-уведомление не отправилось — врач увидит его в очереди при следующем входе.'}
            </p>
            <div className="flex gap-2 mt-2">
              <a
                href="/coach/inquiries"
                className="rounded-xl border border-border bg-card hover:bg-muted text-foreground px-4 py-2 text-xs font-semibold"
              >
                К списку запросов
              </a>
              <button
                onClick={onClose}
                className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-xs font-semibold"
              >
                Закрыть
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
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
                  {(['routine', 'urgent', 'red_flag'] as Urgency[]).map(u => {
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
                <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={8} maxLength={2000}
                  placeholder={QUESTION_TYPE_META[questionType].placeholder}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-violet-400 resize-vertical" />
                <p className="mt-1 text-[10px] text-muted-foreground">{question.length}/2000</p>
              </div>

              {error && (
                <Alert variant="destructive">{error}</Alert>
              )}

              <Alert variant="info">
                Запрос будет направлен врачам (если назначен конкретный — только ему, иначе в открытую очередь).
                Email будет отправлен сразу после создания.
              </Alert>
            </div>

            <div className="border-t border-border px-5 py-3 flex items-center gap-2">
              <button onClick={handleSubmit} disabled={saving || question.trim().length < 10}
                className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {saving ? 'Отправляем…' : 'Отправить врачу'}
              </button>
              <button onClick={onClose} disabled={saving}
                className="rounded-xl border border-border bg-background hover:bg-muted px-4 py-2.5 text-sm font-semibold">
                Отмена
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
