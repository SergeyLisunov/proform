'use client'
/**
 * RecommendationForm — Sprint W2 Day 9.
 *
 * Doctor / specialist creates STRUCTURED recommendation for an athlete.
 * Replaces free-text medical_diary as the primary channel for ограничения
 * и медотметок которые тренер должен учесть.
 *
 * Used in:
 *   - MedicalDiaryClient (doctor side) as a primary entry point
 *   - Patient card (future Day 11) — quick action button
 *
 * Form is client-side, validates locally, POSTs to /api/recommendations.
 * On success — closes modal + calls onSaved callback.
 */
import { useState } from 'react'
import {
  CATEGORY_META, SEVERITY_META, VISIBILITY_META,
  type RecommendationCategory, type RecommendationSeverity,
  type RecommendationVisibility,
} from '@/services/recommendations.service'

const CATEGORIES: RecommendationCategory[] = [
  'load_restriction','activity_restriction','recovery','observation',
  'consultation_request','clearance','nutrition','general','referral',
]

const SEVERITIES: RecommendationSeverity[] = ['low', 'moderate', 'high', 'critical']

const VISIBILITIES: RecommendationVisibility[] = [
  'coach_and_athlete', 'coach_only', 'athlete_only', 'org_full',
]

export interface RecommendationFormProps {
  athleteId: string
  athleteName: string
  organizationId?: string | null
  /** Pre-fill coach if doctor knows the specific addressee */
  defaultCoachId?: string | null
  onClose: () => void
  onSaved?: () => void
}

export default function RecommendationForm({
  athleteId, athleteName, organizationId, defaultCoachId, onClose, onSaved,
}: RecommendationFormProps) {
  const [title,            setTitle]            = useState('')
  const [body,             setBody]             = useState('')
  const [category,         setCategory]         = useState<RecommendationCategory>('load_restriction')
  const [severity,         setSeverity]         = useState<RecommendationSeverity>('moderate')
  const [visibility,       setVisibility]       = useState<RecommendationVisibility>('coach_and_athlete')
  const [validUntil,       setValidUntil]       = useState<string>('')
  const [saving,           setSaving]           = useState(false)
  const [error,            setError]            = useState<string | null>(null)
  const [saveAsDraft,      setSaveAsDraft]      = useState(false)

  const submit = async () => {
    if (title.trim().length < 3) {
      setError('Заголовок должен быть от 3 символов')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/recommendations', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athlete_id:       athleteId,
          organization_id:  organizationId ?? null,
          coach_id:         defaultCoachId ?? null,
          title:            title.trim(),
          body:             body.trim() || null,
          category,
          severity,
          visibility_level: visibility,
          valid_until:      validUntil || null,
          send:             !saveAsDraft,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setError(json.error || `HTTP ${res.status}`)
        return
      }
      onSaved?.()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-8 overflow-y-auto" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div onClick={e => e.stopPropagation()}
        className="relative z-10 w-full max-w-xl rounded-2xl bg-background shadow-2xl border border-border">

        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-700">Медицинская рекомендация</p>
            <h3 className="text-lg font-semibold text-foreground">Для пациента: {athleteName}</h3>
          </div>
          <button onClick={onClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
            <i className="ki-filled ki-cross text-xs" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Заголовок</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Например: «Без прыжков 2 недели»"
              maxLength={120}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-rose-400 outline-none" />
          </div>

          {/* Category */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Категория</label>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {CATEGORIES.map(c => {
                const meta = CATEGORY_META[c]
                const selected = category === c
                return (
                  <button key={c} type="button" onClick={() => setCategory(c)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[11px] font-semibold transition ${
                      selected ? 'ring-2 ring-rose-300 border-rose-400 bg-rose-50' : 'border-border bg-background hover:border-rose-200'
                    }`}>
                    <i className={`ki-filled ${meta.icon} text-base`} style={{ color: meta.color }} />
                    <span className="text-center leading-tight">{meta.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Тяжесть</label>
            <div className="mt-1 flex gap-1.5">
              {SEVERITIES.map(s => {
                const meta = SEVERITY_META[s]
                const selected = severity === s
                return (
                  <button key={s} type="button" onClick={() => setSeverity(s)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
                      selected
                        ? 'ring-2 ring-current'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}>
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Кому видна</label>
            <div className="mt-1 space-y-1.5">
              {VISIBILITIES.map(v => {
                const meta = VISIBILITY_META[v]
                const selected = visibility === v
                return (
                  <label key={v}
                    className={`flex items-start gap-2 cursor-pointer rounded-lg border px-3 py-2 transition ${
                      selected ? 'border-rose-400 bg-rose-50' : 'border-border bg-background hover:border-rose-200'
                    }`}>
                    <input type="radio" name="visibility" checked={selected}
                      onChange={() => setVisibility(v)}
                      className="mt-1 accent-rose-500" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground">{meta.label}</div>
                      <div className="text-[11px] text-muted-foreground leading-snug">{meta.hint}</div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Valid until */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Действует до (опционально)</label>
            <input
              type="date"
              value={validUntil}
              onChange={e => setValidUntil(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-rose-400 outline-none" />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Если оставить пустым, рекомендация будет действовать бессрочно. По истечении срока статус автоматически меняется на «Истекло».
            </p>
          </div>

          {/* Body */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Описание</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="Опишите подробности — причину ограничения, рекомендации тренеру по корректировке плана и т.д."
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-rose-400 outline-none" />
          </div>

          {/* Save as draft */}
          <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <input type="checkbox" checked={saveAsDraft} onChange={e => setSaveAsDraft(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-rose-500" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">Сохранить как черновик</div>
              <div className="text-[11px] text-muted-foreground">Получатели не получат уведомление, пока вы не отправите.</div>
            </div>
          </label>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <i className="ki-filled ki-shield-cross mr-1.5" />
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          <button onClick={submit} disabled={saving || title.trim().length < 3}
            className="flex-1 rounded-xl bg-rose-500 hover:bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-md disabled:opacity-50">
            {saving ? 'Сохраняем…' : saveAsDraft ? 'Сохранить черновик' : 'Отправить'}
          </button>
          <button onClick={onClose} disabled={saving}
            className="rounded-xl border border-border bg-background hover:bg-muted px-4 py-2.5 text-sm font-semibold">
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
