'use client'
/**
 * <AthleteReviewPrompt /> — Sprint W10 Day 49.
 *
 * Inline review form shown on /athlete/passes when athlete has
 * exhausted a pass with a coach they haven't reviewed yet. Catches
 * feedback at the freshest possible moment (right after the pass loop).
 *
 * Renders own state — independent of the bigger <CoachReviewsBlock>
 * on /profile/[id]. Both compose the same upsertReview() service.
 *
 * After successful submit OR explicit skip → calls onDismiss to let
 * the parent remove this card from the list (optimistic UX, no
 * page reload needed).
 */
import { useCallback, useState } from 'react'
import Link from 'next/link'
import { upsertReview } from '@/services/coach-reviews.service'

interface AthleteReviewPromptProps {
  coachId:        string
  coachName:      string | null
  coachAvatarUrl: string | null
  /** Title of one of the exhausted passes — context for the athlete */
  contextTitle:   string | null
  onDismiss:      () => void
}

function StarRating({
  value, onChange, readonly = false,
}: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < Math.round(value)
        return (
          <button
            key={i}
            type="button"
            disabled={readonly}
            onClick={() => !readonly && onChange?.(i + 1)}
            className={`text-2xl leading-none transition-transform ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
            style={{ color: filled ? '#F59E0B' : '#D1D5DB', background: 'none', border: 'none', padding: 0 }}
            aria-label={`${i + 1} звезда`}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}

export default function AthleteReviewPrompt({
  coachId, coachName, coachAvatarUrl, contextTitle, onDismiss,
}: AthleteReviewPromptProps) {
  const [expanded, setExpanded] = useState(false)
  const [rating, setRating]     = useState(5)
  const [comment, setComment]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const onSubmit = useCallback(async () => {
    if (saving) return
    setError(null)
    const res = await (async () => {
      setSaving(true)
      try { return await upsertReview({ coach_id: coachId, rating, comment }) }
      finally { setSaving(false) }
    })()
    if (!res.ok) { setError(res.error ?? 'Не удалось сохранить отзыв'); return }
    onDismiss()
  }, [saving, coachId, rating, comment, onDismiss])

  const initial = (coachName ?? '?').charAt(0).toUpperCase()

  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-sm font-bold text-amber-700 overflow-hidden shrink-0">
            {coachAvatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={coachAvatarUrl} alt="" className="w-full h-full object-cover" />
              : initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-bold uppercase tracking-[0.18em] text-amber-700 mb-0.5">
              Оцените тренера
            </p>
            <Link href={`/profile/${coachId}`} className="text-sm font-bold text-foreground hover:text-amber-700 truncate block no-underline">
              {coachName ?? 'Тренер'}
            </Link>
            {contextTitle && (
              <p className="text-[11px] text-muted-foreground truncate">
                Контекст: «{contextTitle}»
              </p>
            )}
          </div>
        </div>
        {!expanded && (
          <div className="flex gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="inline-flex items-center gap-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-xs font-bold shadow-sm"
            >
              <i className="ki-filled ki-star text-xs" />
              Оставить отзыв
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-xl bg-card hover:bg-accent text-muted-foreground px-3 py-1.5 text-xs font-semibold border border-border"
              title="Не показывать этот prompt"
            >
              Позже
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-amber-200">
          <div className="mb-2">
            <p className="text-[11px] font-semibold text-muted-foreground mb-1">Оценка</p>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <div className="mb-2">
            <p className="text-[11px] font-semibold text-muted-foreground mb-1">
              Комментарий <span className="text-muted-foreground font-normal">(необязательно)</span>
            </p>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value.slice(0, 1000))}
              rows={3}
              placeholder="Чем запомнились тренировки?"
              className="w-full rounded-xl border border-amber-200 bg-card px-3 py-2 text-sm outline-none focus:border-amber-400 resize-vertical"
              style={{ minHeight: 70 }}
            />
            <p className="text-right text-[10px] text-muted-foreground mt-0.5">{comment.length}/1000</p>
          </div>
          {error && (
            <p className="text-xs text-red-600 mb-2">{error}</p>
          )}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={onSubmit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white px-3 py-1.5 text-xs font-bold shadow-sm disabled:cursor-not-allowed"
            >
              {saving
                ? <><div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full pf-spin" /> Сохраняю…</>
                : <><i className="ki-filled ki-check text-xs" /> Опубликовать</>}
            </button>
            <button
              type="button"
              onClick={() => { setExpanded(false); setError(null) }}
              className="rounded-xl bg-card hover:bg-accent text-muted-foreground px-3 py-1.5 text-xs font-semibold border border-border"
            >
              Свернуть
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
