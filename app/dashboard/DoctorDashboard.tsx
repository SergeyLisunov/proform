'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

type PatientLink = {
  id: string
  user: {
    id: string
    name: string | null
    nickname: string | null
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    sport: string | null
    city: string | null
  } | null
  status: string
  initiated_at: string
}

type DoctorNote = {
  id: string
  type: string
  title: string
  body: string | null
  entity_id: string | null
  created_at: string
  is_read: boolean
}

function displayName(u: PatientLink['user']): string {
  if (!u) return '—'
  const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  return full || u.nickname || u.name || 'Пациент'
}

export default function DoctorDash({ userId, name }: { userId: string; name: string }) {
  const [patients, setPatients] = useState<PatientLink[]>([])
  const [notes, setNotes] = useState<DoctorNote[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadNotif, setUnreadNotif] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const sb = getSB()

    // Связи где я (доктор) участвую — через connections
    const { data: conns } = await sb
      .from('connections')
      .select(`
        id, status, initiated_at, connection_type,
        initiator:users!connections_initiator_id_fkey(id, name, nickname, first_name, last_name, avatar_url, sport, city, role),
        recipient:users!connections_recipient_id_fkey(id, name, nickname, first_name, last_name, avatar_url, sport, city, role)
      `)
      .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)
      .eq('status', 'active')
      .in('connection_type', ['doctor_athlete', 'coach_doctor', 'org_doctor'])
      .order('initiated_at', { ascending: false })

    const list: PatientLink[] = (conns ?? []).map((c: any) => {
      const other = c.initiator?.id === userId ? c.recipient : c.initiator
      return {
        id: c.id,
        user: other ? {
          id: other.id,
          name: other.name,
          nickname: other.nickname,
          first_name: other.first_name,
          last_name: other.last_name,
          avatar_url: other.avatar_url,
          sport: other.sport,
          city: other.city,
        } : null,
        status: c.status,
        initiated_at: c.initiated_at,
      }
    })
    setPatients(list)

    // Последние уведомления / медицинские отметки
    const { data: notif } = await sb
      .from('notifications')
      .select('id, type, title, body, entity_id, created_at, is_read')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6)
    setNotes((notif ?? []) as DoctorNote[])

    const { count } = await sb
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    setUnreadNotif(count ?? 0)

    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  const totalPatients = patients.length
  const recentPatients = patients.slice(0, 6)

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-border bg-card shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(220,38,38,0.12),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(249,115,22,0.08),_transparent_28%)]" />
        <div className="relative flex flex-col gap-5 p-6 md:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-red-700">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Медицинский кабинет
            </div>
            <h1 className="pf-num text-[32px] leading-none text-foreground md:text-[40px]">
              Здравствуйте, {name.split(' ')[0] || 'доктор'}
            </h1>
            <p className="mt-2 max-w-[540px] text-sm leading-relaxed text-muted-foreground">
              Ваши подопечные, медицинские заметки и входящие запросы на связь.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border bg-background/80 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Пациенты</div>
              <div className="pf-num mt-1 text-[24px] leading-none text-foreground">{totalPatients}</div>
            </div>
            <div className="rounded-2xl border border-border bg-background/80 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Уведомления</div>
              <div className="pf-num mt-1 text-[24px] leading-none text-foreground">{unreadNotif}</div>
            </div>
            <Link
              href="/search"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 transition-all hover:bg-red-100"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-red-700">Найти</div>
              <div className="pf-num mt-1 text-[14px] leading-tight text-red-700">Атлета или тренера</div>
            </Link>
          </div>
        </div>
      </section>

      {/* Pacients + Notes */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-[20px] border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Подопечные</div>
              <h3 className="pf-num mt-1 text-[20px] leading-none text-foreground">Активные связи</h3>
            </div>
            <Link
              href="/connections"
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:border-red-200 hover:text-red-700"
            >
              Все связи
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 rounded-full border-2 border-red-500 border-t-transparent pf-spin" />
            </div>
          ) : recentPatients.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-background/60 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                <i className="ki-filled ki-heart-circle text-[20px]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Пока нет пациентов</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Найдите атлетов или тренеров через поиск и отправьте приглашение.
                </p>
              </div>
              <Link
                href="/search"
                className="rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-red-600"
              >
                Перейти к поиску
              </Link>
            </div>
          ) : (
            <div className="grid gap-2.5">
              {recentPatients.map((p) => (
                <div
                  key={p.id}
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-background px-3 py-3 transition-all hover:border-red-200 hover:bg-red-50/60"
                >
                  <Link
                    href={p.user ? `/profile/${p.user.id}` : '/connections'}
                    className="flex flex-1 min-w-0 items-center gap-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                      {p.user?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.user.avatar_url} alt="" className="h-10 w-10 rounded-xl object-cover" />
                      ) : (
                        <i className="ki-filled ki-user text-[15px]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">{displayName(p.user)}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-2xs text-muted-foreground">
                        {p.user?.sport && <span className="truncate">{p.user.sport}</span>}
                        {p.user?.city && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-border" />
                            <span className="truncate">{p.user.city}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                  {p.user && (
                    <Link
                      href={`/doctor/report/${p.user.id}`}
                      title="Медицинский отчёт · PDF"
                      className="flex h-8 items-center gap-1 rounded-lg border border-red-200 bg-white px-2 text-[11px] font-bold text-red-700 hover:bg-red-50"
                      onClick={e => e.stopPropagation()}
                    >
                      <i className="ki-filled ki-document text-[12px]" />
                      Отчёт
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[20px] border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Лента</div>
              <h3 className="pf-num mt-1 text-[20px] leading-none text-foreground">Последние уведомления</h3>
            </div>
            <Link
              href="/notifications"
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:border-red-200 hover:text-red-700"
            >
              Все
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 rounded-full border-2 border-red-500 border-t-transparent pf-spin" />
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-background/60 py-10 text-center">
              <i className="ki-filled ki-notification-on text-[18px] text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Новых уведомлений нет</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {notes.map((n) => (
                <div
                  key={n.id}
                  className="rounded-2xl border border-border bg-background px-3 py-3"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                      <i className="ki-filled ki-notepad-edit text-[13px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">{n.title}</div>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-2xs text-muted-foreground">{n.body}</p>}
                      <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
