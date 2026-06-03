'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const WorkoutCommentsDrawer = dynamic(
  () => import('@/components/workout/WorkoutCommentsDrawer'),
  { ssr: false }
)

type FeedbackRow = {
  notification_id: string
  workout_id: string
  title: string
  body: string | null
  is_read: boolean
  created_at: string
}

function fmtRelative(iso: string): string {
  const d = new Date(iso)
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000)
  if (diffMin < 1) return 'только что'
  if (diffMin < 60) return `${diffMin} мин назад`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH} ч назад`
  const diffD = Math.round(diffH / 24)
  if (diffD < 7) return `${diffD} д назад`
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export default function AthleteFeedbackCard({ userId }: { userId: string }) {
  const [rows, setRows] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openFor, setOpenFor] = useState<string | null>(null)

  const load = async () => {
    const sb = createClient()
    const { data } = await sb
      .from('notifications')
      .select('id, entity_id, entity_type, title, body, is_read, created_at')
      .eq('user_id', userId)
      .eq('type', 'workout_comment')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(5)
    const list = (data ?? []) as Array<{
      id: string; entity_id: string | null; entity_type: string | null;
      title: string; body: string | null; is_read: boolean; created_at: string
    }>
    const mapped: FeedbackRow[] = list
      .filter(n => n.entity_type === 'workout' && n.entity_id)
      .map(n => ({
        notification_id: n.id,
        workout_id: n.entity_id!,
        title: n.title,
        body: n.body,
        is_read: n.is_read,
        created_at: n.created_at,
      }))
    setRows(mapped)
    setLoading(false)
  }

  useEffect(() => {
    let mounted = true
    ;(async () => { await load(); if (!mounted) return })()
    const sb = createClient()
    const ch = sb
      .channel(`athlete-feedback-${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => { load() })
      .subscribe()
    return () => { mounted = false; sb.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function markRead(id: string) {
    const sb = createClient()
    await (sb as any).from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id)
    setRows(prev => prev.map(r => r.notification_id === id ? { ...r, is_read: true } : r))
  }

  const unread = rows.filter(r => !r.is_read).length

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-100 mb-3" />
        <div className="space-y-2">
          <div className="h-12 animate-pulse rounded-xl bg-slate-50" />
          <div className="h-12 animate-pulse rounded-xl bg-slate-50" />
        </div>
      </div>
    )
  }

  if (rows.length === 0) return null

  return (
    <>
      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
              <i className="ki-filled ki-chat text-sm" style={{ color: '#D44A02' }} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Обратная связь</p>
              <h3 className="text-base font-semibold text-slate-900 mt-0.5">Отзывы к тренировкам</h3>
            </div>
          </div>
          {unread > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-1 text-[11px] font-bold text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              {unread} {unread === 1 ? 'новый' : 'новых'}
            </span>
          )}
        </div>
        <div className="divide-y divide-border">
          {rows.map(r => (
            <button
              key={r.notification_id}
              onClick={() => { setOpenFor(r.workout_id); if (!r.is_read) markRead(r.notification_id) }}
              className={`w-full text-left px-5 py-3 flex items-start gap-3 transition-colors ${r.is_read ? 'hover:bg-slate-50' : 'bg-orange-50/40 hover:bg-orange-50'}`}
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${r.is_read ? 'bg-slate-200' : 'bg-orange-500'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate">{r.title}</p>
                {r.body && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{r.body}</p>}
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{fmtRelative(r.created_at)}</p>
              </div>
              <i className="ki-filled ki-right text-xs text-slate-400 shrink-0 mt-1.5" />
            </button>
          ))}
        </div>
        <div className="px-5 py-2.5 border-t border-border bg-slate-50/50 rounded-b-2xl">
          <Link href="/notifications" className="text-[11px] font-semibold text-slate-500 hover:text-slate-900">
            Все уведомления →
          </Link>
        </div>
      </div>

      <WorkoutCommentsDrawer
        workoutId={openFor}
        currentUserId={userId}
        onClose={() => setOpenFor(null)}
      />
    </>
  )
}
