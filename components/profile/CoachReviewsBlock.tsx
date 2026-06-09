'use client'
/**
 * <CoachReviewsBlock /> — Sprint W9 Day 44.
 *
 * Inline block inside CoachProfile (in /profile/[id]). Combines:
 *   - aggregate summary (avg rating + count) prominently up top
 *   - write/edit form for the current authenticated athlete (if
 *     reviewing a different user)
 *   - paginated list of recent reviews with author info
 *
 * Self-view: if user.role === 'coach' and viewing own profile, the
 * form is hidden. Athletes viewing themselves never trigger this
 * block (CoachProfile renders only for profile.role === 'coach').
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useDialog } from '@/lib/hooks/useDialog'
import { useUser } from '@/lib/hooks/useUser'
import { Card, Badge } from '@/components/ui/metronic'
import {
  listReviewsForCoach, getMyReviewForCoach, upsertReview, deleteMyReview,
  replyToReview,
  type CoachReviewWithAuthor, type CoachReview, type ReviewSummary,
} from '@/services/coach-reviews.service'

interface CoachReviewsBlockProps {
  coachId: string
  summary: ReviewSummary | null   // pre-fetched on page load to avoid layout-shift
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return iso }
}

function StarRating({
  value, max = 5, onChange, size = 'md', readonly = false,
}: { value: number; max?: number; onChange?: (v: number) => void; size?: 'sm' | 'md' | 'lg'; readonly?: boolean }) {
  const cls = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-2xl' : 'text-lg'
  return (
    <div className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < Math.round(value)
        return (
          <button
            key={i}
            type="button"
            disabled={readonly}
            onClick={() => !readonly && onChange?.(i + 1)}
            className={`${cls} leading-none transition-transform ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
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

export default function CoachReviewsBlock({ coachId, summary }: CoachReviewsBlockProps) {
  const { confirm } = useDialog()
  const { user, loading: userLoading } = useUser()
  const [reviews, setReviews]       = useState<CoachReviewWithAuthor[]>([])
  const [myReview, setMyReview]     = useState<CoachReview | null>(null)
  const [loading, setLoading]       = useState(true)

  // Form state
  const [showForm, setShowForm]     = useState(false)
  const [formRating, setFormRating] = useState(5)
  const [formComment, setFormComment] = useState('')
  const [saving, setSaving]         = useState(false)
  const [formError, setFormError]   = useState<string | null>(null)
  const [toast, setToast]           = useState<{ ok: boolean; msg: string } | null>(null)

  // W10 Day 48: reply state — one editable reply at a time
  const [replyingId, setReplyingId] = useState<string | null>(null)
  const [replyText, setReplyText]   = useState('')
  const [replySaving, setReplySaving] = useState(false)

  const refresh = useCallback(async () => {
    const [list, mine] = await Promise.all([
      listReviewsForCoach(coachId),
      getMyReviewForCoach(coachId),
    ])
    setReviews(list)
    setMyReview(mine)
    if (mine) {
      setFormRating(mine.rating)
      setFormComment(mine.comment ?? '')
    }
    setLoading(false)
  }, [coachId])

  useEffect(() => { void refresh() }, [refresh])

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const isSelf = !!user && user.id === coachId
  const canWrite = !!user && !isSelf && !userLoading
  // W10 Day 48: coach can reply to reviews ON THEIR OWN profile
  const canReply = !!user && isSelf && user.role === 'coach'

  const onStartReply = useCallback((review: CoachReviewWithAuthor) => {
    setReplyingId(review.id)
    setReplyText(review.coach_response ?? '')
  }, [])

  const onCancelReply = useCallback(() => {
    setReplyingId(null)
    setReplyText('')
  }, [])

  const onSubmitReply = useCallback(async () => {
    if (!replyingId || replySaving) return
    setReplySaving(true)
    const res = await replyToReview({ reviewId: replyingId, response: replyText })
    setReplySaving(false)
    if (!res.ok) {
      setToast({ ok: false, msg: res.error ?? 'Не удалось сохранить ответ' })
      return
    }
    const isClear = replyText.trim().length === 0
    setToast({ ok: true, msg: isClear ? 'Ответ удалён' : 'Ответ опубликован' })
    setReplyingId(null)
    setReplyText('')
    await refresh()
  }, [replyingId, replyText, replySaving, refresh])

  const onSubmit = useCallback(async () => {
    if (saving) return
    setFormError(null)
    if (formRating < 1 || formRating > 5) {
      setFormError('Поставьте от 1 до 5 звёзд')
      return
    }
    setSaving(true)
    const res = await upsertReview({
      coach_id: coachId,
      rating:   formRating,
      comment:  formComment,
    })
    setSaving(false)
    if (!res.ok) {
      setFormError(res.error ?? 'Не удалось сохранить отзыв')
      return
    }
    setShowForm(false)
    setToast({ ok: true, msg: myReview ? 'Отзыв обновлён' : 'Спасибо за отзыв!' })
    await refresh()
  }, [saving, formRating, formComment, coachId, myReview, refresh])

  const onDelete = useCallback(async () => {
    if (!(await confirm('Удалить ваш отзыв безвозвратно?'))) return
    const res = await deleteMyReview(coachId)
    if (!res.ok) {
      setToast({ ok: false, msg: res.error ?? 'Не удалось удалить' })
      return
    }
    setShowForm(false)
    setMyReview(null)
    setFormRating(5)
    setFormComment('')
    setToast({ ok: true, msg: 'Отзыв удалён' })
    await refresh()
  }, [coachId, refresh])

  // Prefer pre-fetched summary (avoids flash). Fallback to computing from
  // loaded reviews if caller didn't provide one (profile-page case).
  const computedCount = reviews.length
  const computedAvg = computedCount > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / computedCount
    : null
  const avg = summary?.avg_rating ?? computedAvg
  const count = summary?.review_count ?? computedCount

  return (
    <Card className="p-5">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ marginBottom: 8 }}>
            <Badge variant="warning" size="sm" className="uppercase tracking-wider">
              Отзывы атлетов
            </Badge>
          </div>
          {avg !== null && count > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="pf-num" style={{ fontSize: 32, fontWeight: 800, color: 'var(--foreground)', lineHeight: 1 }}>{avg.toFixed(1)}</span>
              <div>
                <StarRating value={avg} readonly />
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{count} {pluralize(count, ['отзыв', 'отзыва', 'отзывов'])}</p>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Пока нет отзывов — будьте первыми!</p>
          )}
        </div>
        {canWrite && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            style={{
              padding: '8px 14px', borderRadius: 12,
              background: myReview ? 'var(--accent)' : '#F35703',
              color: myReview ? 'var(--foreground)' : '#fff',
              fontSize: 13, fontWeight: 700, border: '1px solid ' + (myReview ? 'var(--border)' : '#D44A02'),
              display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            }}
          >
            <i className={`ki-filled ${myReview ? 'ki-pencil' : 'ki-star'} text-xs`} />
            {myReview ? 'Изменить мой отзыв' : 'Оставить отзыв'}
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: 'var(--accent)', border: '1px dashed var(--border)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
            {myReview ? 'Редактирование отзыва' : 'Новый отзыв'}
          </p>
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 6 }}>Оценка</p>
            <StarRating value={formRating} onChange={setFormRating} size="lg" />
          </div>
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 6 }}>Комментарий <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(необязательно)</span></p>
            <textarea
              value={formComment}
              onChange={e => setFormComment(e.target.value.slice(0, 1000))}
              rows={4}
              placeholder="Чем понравился тренер? Что можно улучшить?"
              style={{
                width: '100%', padding: 10, borderRadius: 12,
                border: '1px solid var(--border)', background: 'var(--card)',
                fontSize: 13, color: 'var(--foreground)', resize: 'vertical', minHeight: 80,
              }}
            />
            <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 4, textAlign: 'right' }}>{formComment.length}/1000</p>
          </div>
          {formError && (
            <p style={{ fontSize: 12, color: '#DC2626', marginBottom: 8 }}>{formError}</p>
          )}
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 10, lineHeight: 1.45 }}>
            Оставляйте отзывы, если действительно тренировались у этого тренера.
            Один отзыв на тренера — повторное сохранение обновит предыдущий.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onSubmit}
              disabled={saving}
              style={{
                padding: '9px 16px', borderRadius: 12,
                background: '#F35703', color: '#fff', fontSize: 13, fontWeight: 700,
                border: '1px solid #D44A02', cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {saving ? <><div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full pf-spin" /> Сохраняю…</> : <><i className="ki-filled ki-check text-xs" /> Сохранить</>}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                if (myReview) { setFormRating(myReview.rating); setFormComment(myReview.comment ?? '') }
                setFormError(null)
              }}
              style={{ padding: '9px 14px', borderRadius: 12, background: 'var(--card)', color: 'var(--foreground)', fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', cursor: 'pointer' }}
            >
              Отмена
            </button>
            {myReview && (
              <button
                type="button"
                onClick={onDelete}
                style={{
                  padding: '9px 14px', borderRadius: 12, background: 'transparent',
                  color: '#DC2626', fontSize: 13, fontWeight: 600,
                  border: '1px solid #FECACA', cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                <i className="ki-filled ki-trash text-xs" style={{ marginRight: 4 }} />Удалить
              </button>
            )}
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" style={{ margin: '0 auto' }} />
        </div>
      ) : reviews.length === 0 ? (
        !showForm && (
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', padding: '12px 0' }}>
            Здесь появятся отзывы атлетов о работе тренера.
          </p>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reviews.map(r => {
            const isMine = !!user && r.athlete_id === user.id
            return (
              <div key={r.id} style={{
                padding: 14, borderRadius: 14,
                background: isMine ? '#FEF0E7' : 'var(--accent)',
                border: '1px solid ' + (isMine ? '#FBC1A0' : 'var(--border)'),
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 99,
                      background: '#FDDDCB', color: '#B03D04', fontSize: 13, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
                    }}>
                      {r.athlete_avatar_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={r.athlete_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (r.athlete_name ?? r.athlete_nickname ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <Link href={`/profile/${r.athlete_id}`} style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', textDecoration: 'none' }}>
                        {r.athlete_name ?? r.athlete_nickname ?? 'Атлет'}
                      </Link>
                      <p style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
                        {fmtDate(r.created_at)}
                        {r.updated_at !== r.created_at && ' · ред.'}
                        {isMine && ' · ваш отзыв'}
                      </p>
                    </div>
                  </div>
                  <StarRating value={r.rating} readonly size="sm" />
                </div>
                {r.comment && (
                  <p style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: 0 }}>{r.comment}</p>
                )}

                {/* W10 Day 48: coach response thread */}
                {r.coach_response && replyingId !== r.id && (
                  <div style={{
                    marginTop: 10, padding: '10px 12px',
                    borderRadius: 12, borderLeft: '3px solid #16A34A',
                    background: '#F0FDF4',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        <i className="ki-filled ki-message-text text-[10px]" style={{ marginRight: 4 }} />
                        Ответ тренера
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
                        {r.coach_response_at && fmtDate(r.coach_response_at)}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: 0 }}>{r.coach_response}</p>
                    {canReply && (
                      <button
                        type="button"
                        onClick={() => onStartReply(r)}
                        style={{ marginTop: 6, padding: '4px 10px', borderRadius: 8, background: 'transparent', color: '#15803D', fontSize: 11, fontWeight: 600, border: '1px solid #BBF7D0', cursor: 'pointer' }}
                      >
                        Редактировать ответ
                      </button>
                    )}
                  </div>
                )}

                {/* W10 Day 48: reply form (inline) */}
                {canReply && replyingId === r.id && (
                  <div style={{
                    marginTop: 10, padding: 12, borderRadius: 12,
                    background: '#F0FDF4', border: '1px solid #BBF7D0',
                  }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                      {r.coach_response ? 'Редактирование ответа' : 'Ответ атлету'}
                    </p>
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value.slice(0, 800))}
                      rows={3}
                      placeholder="Поблагодарите атлета или ответьте на критику..."
                      style={{
                        width: '100%', padding: 8, borderRadius: 10,
                        border: '1px solid #BBF7D0', background: 'var(--card)',
                        fontSize: 13, color: 'var(--foreground)', resize: 'vertical', minHeight: 60,
                      }}
                    />
                    <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 3, textAlign: 'right' }}>{replyText.length}/800</p>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={onSubmitReply}
                        disabled={replySaving}
                        style={{
                          padding: '6px 12px', borderRadius: 10,
                          background: '#16A34A', color: '#fff', fontSize: 12, fontWeight: 700,
                          border: '1px solid #15803D', cursor: replySaving ? 'wait' : 'pointer',
                          opacity: replySaving ? 0.7 : 1,
                        }}
                      >
                        {replySaving ? 'Сохраняю…' : (replyText.trim() ? 'Опубликовать' : 'Очистить ответ')}
                      </button>
                      <button
                        type="button"
                        onClick={onCancelReply}
                        style={{ padding: '6px 12px', borderRadius: 10, background: 'var(--card)', color: 'var(--foreground)', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', cursor: 'pointer' }}
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

                {/* Empty-state CTA for coach to start a reply */}
                {canReply && !r.coach_response && replyingId !== r.id && (
                  <button
                    type="button"
                    onClick={() => onStartReply(r)}
                    style={{
                      marginTop: 8, padding: '6px 12px', borderRadius: 10,
                      background: 'transparent', color: '#15803D', fontSize: 12, fontWeight: 600,
                      border: '1px dashed #BBF7D0', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <i className="ki-filled ki-message-text text-xs" />
                    Ответить атлету
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: '10px 16px', borderRadius: 12,
          background: toast.ok ? '#10B981' : '#DC2626', color: '#fff',
          fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.16)',
        }}>
          <i className={`ki-filled ${toast.ok ? 'ki-check-circle' : 'ki-warning-2'} text-sm`} />
          {toast.msg}
        </div>
      )}
    </Card>
  )
}

function pluralize(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}
