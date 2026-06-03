'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { createBrowserClient } from '@supabase/ssr'
import { Card } from '@/components/ui/metronic'

const DoctorHeroBar         = dynamic(() => import('@/components/doctor/DoctorHeroBar'),         { ssr: false })
const DoctorQuickActions    = dynamic(() => import('@/components/doctor/DoctorQuickActions'),    { ssr: false })
const DoctorTodayCheckups   = dynamic(() => import('@/components/doctor/DoctorTodayCheckups'),   { ssr: false })
const DoctorActiveInjuries  = dynamic(() => import('@/components/doctor/DoctorActiveInjuries'),  { ssr: false })

function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

interface PatientUser {
  id: string
  name: string | null
  nickname: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  sport: string | null
  city: string | null
}

interface PatientLink {
  id: string
  user: PatientUser | null
  status: string
  initiated_at: string
}

interface DoctorNote {
  id: string
  type: string
  title: string
  body: string | null
  entity_id: string | null
  created_at: string
  is_read: boolean
}

function displayName(u: PatientUser | null): string {
  if (!u) return '—'
  const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  return full || u.nickname || u.name || 'Пациент'
}

function todayISO(): string { return new Date().toISOString().slice(0, 10) }
function tomorrowISO(): string {
  const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10)
}

export default function DoctorDashboard({ userId, name }: { userId: string; name: string }) {
  const [patients, setPatients] = useState<PatientLink[]>([])
  const [notes, setNotes] = useState<DoctorNote[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadNotif, setUnreadNotif] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [activeInjuriesCount, setActiveInjuriesCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const sb = getSB()

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

    type ConnRow = {
      id: string
      status: string
      initiated_at: string
      initiator?: (PatientUser & { id: string; role: string }) | null
      recipient?: (PatientUser & { id: string; role: string }) | null
    }

    const list: PatientLink[] = (conns ?? []).map((raw) => {
      const c = raw as unknown as ConnRow
      const other = c.initiator?.id === userId ? c.recipient ?? null : c.initiator ?? null
      return {
        id: c.id,
        user: other ? {
          id: other.id, name: other.name, nickname: other.nickname,
          first_name: other.first_name, last_name: other.last_name,
          avatar_url: other.avatar_url, sport: other.sport, city: other.city,
        } : null,
        status: c.status,
        initiated_at: c.initiated_at,
      }
    })
    setPatients(list)

    const { data: notif } = await sb
      .from('notifications')
      .select('id, type, title, body, entity_id, created_at, is_read')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6)
    setNotes((notif ?? []) as DoctorNote[])

    const { count: unread } = await sb
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId).eq('is_read', false)
    setUnreadNotif(unread ?? 0)

    const { count: todayChk } = await sb
      .from('medical_checkups')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', userId)
      .eq('status', 'scheduled')
      .gte('checkup_date', todayISO())
      .lte('checkup_date', tomorrowISO())
    setTodayCount(todayChk ?? 0)

    const { count: activeInj } = await sb
      .from('injuries')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'recovered')
    setActiveInjuriesCount(activeInj ?? 0)

    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const firstName = name.split(' ')[0] || 'доктор'
  const recentPatients = patients.slice(0, 6)

  return (
    <div className="flex flex-col gap-5 pf-page-enter">

      {/* 1. HERO */}
      <DoctorHeroBar
        firstName={firstName}
        stats={{
          patientsCount: patients.length,
          todayCheckups: todayCount,
          activeInjuries: activeInjuriesCount,
          unreadNotif,
        }}
      />

      {/* 2. ACTIVE INJURIES — высокий приоритет */}
      <DoctorActiveInjuries />

      {/* 3. QUICK ACTIONS */}
      <DoctorQuickActions />

      {/* 4. TODAY'S CHECKUPS + NOTIFICATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <DoctorTodayCheckups doctorId={userId} />
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Лента</p>
              <h3 className="text-base font-bold text-foreground">Уведомления</h3>
            </div>
            <Link href="/notifications" className="text-[11px] font-semibold text-red-600 hover:underline">
              Все →
            </Link>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 rounded-full border-2 border-red-500 border-t-transparent pf-spin" />
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-6 text-center text-muted-foreground">
              <i className="ki-filled ki-notification-on text-[18px]" />
              <p className="text-xs">Новых уведомлений нет</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {notes.slice(0, 5).map(n => (
                <div key={n.id} className="rounded-xl border border-border bg-background px-2.5 py-2">
                  <div className="flex items-start gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                      <i className="ki-filled ki-notepad-edit text-[12px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-semibold text-foreground">{n.title}</div>
                      {n.body && <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{n.body}</p>}
                      <div className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 5. PATIENTS */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Подопечные</p>
            <h3 className="pf-num text-xl text-foreground">Активные пациенты</h3>
          </div>
          <Link href="/connections"
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:border-red-200 hover:text-red-700">
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
            <Link href="/network?tab=find"
              className="rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-red-600">
              Перейти к поиску
            </Link>
          </div>
        ) : (
          <div className="grid gap-2">
            {recentPatients.map((p) => (
              <div key={p.id}
                className="group flex items-center gap-3 rounded-2xl border border-border bg-background px-3 py-3 transition-all hover:border-red-200 hover:bg-red-50/60">
                <Link href={p.user ? `/profile/${p.user.id}` : '/connections'}
                  className="flex flex-1 min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 overflow-hidden">
                    {p.user?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.user.avatar_url} alt="" className="h-10 w-10 rounded-xl object-cover" />
                    ) : (
                      <i className="ki-filled ki-user text-[15px]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">{displayName(p.user)}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
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
                  <Link href={`/doctor/report/${p.user.id}`}
                    title="Медицинский отчёт · PDF"
                    className="flex h-8 items-center gap-1 rounded-lg border border-red-200 bg-white px-2 text-[11px] font-bold text-red-700 hover:bg-red-50">
                    <i className="ki-filled ki-document text-[12px]" />
                    Отчёт
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
