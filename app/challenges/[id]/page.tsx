'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'
import { useToast } from '@/lib/hooks/useToast'

type Challenge = {
  id: string
  owner_id: string
  org_id: string | null
  title: string
  description: string | null
  metric: 'duration_min' | 'strain' | 'workouts_count'
  activity_type: string | null
  starts_at: string
  ends_at: string
  owner: { id: string; name: string | null; nickname: string | null; avatar_url: string | null; role: string | null } | null
  org:   { id: string; org_name: string | null; logo_url: string | null } | null
}

type LeaderRow = {
  user_id: string
  user_name: string | null
  user_nickname: string | null
  user_avatar: string | null
  total_min: number | string
  total_strain: number | string
  workouts_count: number
  score: number | string
}

const METRIC_LABEL: Record<Challenge['metric'], string> = {
  duration_min:   'Минуты',
  strain:         'Strain',
  workouts_count: 'Тренировок',
}

function fmtScore(metric: Challenge['metric'], score: number): string {
  if (metric === 'duration_min')   return `${Math.round(score)} мин`
  if (metric === 'strain')         return score.toFixed(1)
  if (metric === 'workouts_count') return `${score}`
  return String(score)
}

function displayName(r: LeaderRow): string {
  return r.user_nickname || r.user_name || 'Атлет'
}

export default function ChallengeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string)
  const { user } = useUser()
  const { success, error } = useToast()

  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([])
  const [joined, setJoined] = useState(false)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  const isOwner = !!user && challenge?.owner_id === user.id

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/challenges/${id}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'LOAD_ERROR')
      setChallenge(json.challenge as Challenge)
      setLeaderboard((json.leaderboard ?? []) as LeaderRow[])
      setCount(json.participants_count ?? 0)
      setJoined(!!json.me?.joined)
    } catch (e) {
      error(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }, [id, error])

  useEffect(() => { load() }, [load])

  async function toggleJoin() {
    if (toggling || !id) return
    setToggling(true)
    try {
      const res = await fetch(`/api/challenges/${id}/join`, {
        method: joined ? 'DELETE' : 'POST',
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'JOIN_ERROR')
      success(joined ? 'Вы вышли из челленджа' : 'Вы присоединились')
      await load()
    } catch (e) {
      error(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setToggling(false)
    }
  }

  async function remove() {
    if (!id || !confirm('Удалить челлендж?')) return
    try {
      const res = await fetch(`/api/challenges/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'DELETE_ERROR')
      success('Челлендж удалён')
      router.push('/challenges')
    } catch (e) {
      error(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 rounded-full border-2 border-emerald-500 border-t-transparent pf-spin" />
      </div>
    )
  }

  if (!challenge) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-foreground">Челлендж не найден.</p>
        <Link href="/challenges" className="mt-3 inline-block text-xs font-bold text-emerald-600 hover:underline">
          ← К списку
        </Link>
      </div>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const status =
    today < challenge.starts_at ? 'upcoming' :
    today > challenge.ends_at   ? 'finished' :
    'active'

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/challenges" className="hover:text-foreground">← К челленджам</Link>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_40%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5">
                {status === 'active' ? 'В разгаре' : status === 'upcoming' ? 'Скоро' : 'Завершён'}
              </span>
              <span className="text-muted-foreground">
                {new Date(challenge.starts_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} — {new Date(challenge.ends_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <h1 className="pf-num text-[30px] leading-tight text-navy-500">{challenge.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{METRIC_LABEL[challenge.metric]}</span>
              {challenge.activity_type && (
                <span className="rounded-full bg-muted px-2 py-0.5">{challenge.activity_type}</span>
              )}
              <span>· {count} участников</span>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
            {status !== 'finished' && (
              <button
                type="button"
                onClick={toggleJoin}
                disabled={toggling}
                className={`rounded-full px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50 ${
                  joined
                    ? 'border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
                    : 'bg-emerald-500 text-white hover:bg-emerald-600'
                }`}
              >
                {toggling ? '…' : joined ? 'Выйти' : 'Присоединиться'}
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={remove}
                className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
              >
                Удалить
              </button>
            )}
          </div>
        </div>
        {challenge.description && (
          <p className="relative mt-5 max-w-[720px] whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {challenge.description}
          </p>
        )}
      </section>

      {/* Leaderboard */}
      <section className="rounded-[20px] border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Лидерборд</div>
            <h3 className="pf-num mt-1 text-[20px] leading-none text-navy-500">{METRIC_LABEL[challenge.metric]}</h3>
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-background/60 py-10 text-center">
            <p className="text-sm text-muted-foreground">Пока нет участников</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-2xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left">#</th>
                  <th className="px-3 py-2.5 text-left">Атлет</th>
                  <th className="px-3 py-2.5 text-right">Минут</th>
                  <th className="px-3 py-2.5 text-right">Strain</th>
                  <th className="px-3 py-2.5 text-right">Трен-к</th>
                  <th className="px-3 py-2.5 text-right">Балл</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r, i) => {
                  const score  = Number(r.score)
                  const mine   = user && r.user_id === user.id
                  return (
                    <tr
                      key={r.user_id}
                      className={`border-t border-border ${mine ? 'bg-emerald-50/60' : ''}`}
                    >
                      <td className="px-3 py-2.5 font-bold text-foreground">
                        {i < 3 ? <span className="text-lg leading-none">{medals[i]}</span> : i + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-xs font-bold text-foreground">
                            {r.user_avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.user_avatar} alt="" className="h-8 w-8 object-cover" />
                            ) : (
                              (displayName(r)[0] ?? '?').toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-foreground">{displayName(r)}</div>
                            {mine && <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Вы</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{Math.round(Number(r.total_min))}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{Number(r.total_strain).toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{r.workouts_count}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-foreground">{fmtScore(challenge.metric, score)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
