'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'
import { useToast } from '@/lib/hooks/useToast'
import {
  listCoachesForVerification, setCoachVerification,
  type VerifiableCoach,
} from '@/services/admin-verifications.service'
import VerifiedBadge from '@/components/ui/VerifiedBadge'
import { Card, Alert } from '@/components/ui/metronic'
import {
  listMyAdminInvites, revokeAdminInvite,
  type AdminUserInvite, type AdminInviteRole,
} from '@/services/admin-invites.service'
import {
  listRecentAuditLog,
  type AuditAction, type AuditLogEntry,
} from '@/services/admin-audit.service'
import {
  assignAthleteToCoach, listCoachAthleteLinks,
  type CoachAthleteLink,
} from '@/services/admin-assignments.service'

function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

type AdminTab = 'users' | 'verification' | 'privacy' | 'audit' | 'system'

type DBUser = { id: string; name: string | null; email: string | null; role: string; created_at: string; is_searchable: boolean | null }
type RecentActivity = { id: string; actor: string; action: string; detail: string; table_name: string; created_at: string }

/** Состояние живой проверки связи с БД — единственное, что панель может
 *  утверждать о «системе» без внешнего мониторинга. */
type DbPing = {
  state: 'idle' | 'checking' | 'ok' | 'fail'
  ms:    number | null
  at:    string | null
  error: string | null
}

// Ревизия P1: отсюда удалены константы USERS (три выдуманных аккаунта),
// AUDIT (шесть выдуманных записей журнала) и SYSTEM_SERVICES (uptime «99.9%»
// и статусы сервисов, которые никто не измерял). Все три рендерились как
// настоящие данные рядом с реальными загрузчиками.

const TABS: { id: AdminTab; label: string; icon: string; hint: string }[] = [
  { id: 'users', label: 'Пользователи', icon: 'ki-people', hint: 'Роли и приглашения' },
  { id: 'verification', label: 'Верификация', icon: 'ki-verify', hint: 'Подтверждение тренеров' },
  { id: 'privacy', label: 'Приватность', icon: 'ki-lock', hint: 'Только просмотр' },
  { id: 'audit', label: 'Журнал действий', icon: 'ki-notepad-edit', hint: 'Записи audit_logs' },
  { id: 'system', label: 'Система', icon: 'ki-setting-2', hint: 'Проверка связи с БД' },
]

const ROLE_BADGE: Record<string, string> = {
  athlete: 'bg-orange-50 text-orange-700 border border-orange-200',
  coach: 'bg-green-50 text-green-700 border border-green-200',
  admin: 'bg-violet-50 text-violet-700 border border-violet-200',
  organization: 'bg-blue-50 text-blue-700 border border-blue-200',
  doctor: 'bg-red-50 text-red-700 border border-red-200',
  specialist: 'bg-sky-50 text-sky-700 border border-sky-200',
}

const ROLE_LABEL: Record<string, string> = {
  athlete: 'Атлет',
  coach: 'Тренер',
  admin: 'Администратор',
  organization: 'Организация',
  doctor: 'Доктор',
  specialist: 'Специалист',
}

/** Ровно тот же белый список, что проверяет сервер в /api/admin/users/role —
 *  предлагать в UI роль, которую маршрут отвергнет, значит снова обманывать. */
const ASSIGNABLE_ROLES = ['athlete', 'coach', 'doctor', 'specialist', 'organization', 'admin'] as const

const ACTION_BADGE: Record<AuditAction, string> = {
  login: 'bg-blue-50 text-blue-700 border border-blue-200',
  logout: 'bg-slate-100 text-slate-700 border border-slate-200',
  create: 'bg-green-50 text-green-700 border border-green-200',
  update: 'bg-orange-50 text-orange-700 border border-orange-200',
  privacy_change: 'bg-violet-50 text-violet-700 border border-violet-200',
  role_change: 'bg-red-50 text-red-700 border border-red-200',
  assign_athlete: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  delete: 'bg-red-50 text-red-700 border border-red-200',
  clearance_override: 'bg-amber-50 text-amber-800 border border-amber-300',
}

const ACTION_LABEL: Record<AuditAction, string> = {
  login: 'Вход',
  logout: 'Выход',
  create: 'Создание',
  update: 'Обновление',
  privacy_change: 'Приватность',
  role_change: 'Смена роли',
  assign_athlete: 'Назначение тренера',
  delete: 'Удаление',
  // Обход врачебного ограничения — событие для разбора, поэтому у него
  // собственный ярлык, а не безликое «Обновление» (миграция 109).
  clearance_override: 'Обход допуска',
}

/** Человеческие имена только для таблиц, которые реально встречаются в
 *  audit_logs; для остальных показываем сырое имя, а не выдумываем перевод. */
const TARGET_LABEL: Record<string, string> = {
  users: 'Пользователи',
  workouts: 'Тренировки',
  athletes: 'Атлеты',
  trainer_athletes: 'Связки тренер↔спортсмен',
  observation_diary: 'Дневник наблюдений',
}

function getInitials(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  return parts.map(part => part[0]).join('').slice(0, 2).toUpperCase()
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** payload журнала — свободный jsonb; печатаем как есть, без домысливания. */
function describePayload(payload: Record<string, unknown> | null): string {
  if (!payload || typeof payload !== 'object') return 'Без деталей'
  const parts = Object.entries(payload).map(([key, value]) =>
    `${key}: ${value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
  return parts.length > 0 ? parts.join(' · ') : 'Без деталей'
}

export default function AdminPage() {
  const { user } = useUser()
  const { success, error: toastError } = useToast()
  const [tab, setTab] = useState<AdminTab>('users')

  // Users tab
  const [users, setUsers] = useState<DBUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [changingRole, setChangingRole] = useState<string | null>(null)

  // Stats
  const [stats, setStats] = useState({ total: 0, athletes: 0, coaches: 0, workouts: 0 })

  // Activity
  const [activity, setActivity] = useState<RecentActivity[]>([])
  const [actLoading, setActLoading] = useState(false)

  // Журнал действий — реальные audit_logs вместо константы AUDIT (ревизия P1)
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(true)

  // Вкладка «Система»: измеряемая проверка связи вместо выдуманного uptime
  const [dbPing, setDbPing] = useState<DbPing>({ state: 'idle', ms: null, at: null, error: null })

  // W9 Day 45: verification tab
  const [verCoaches, setVerCoaches] = useState<VerifiableCoach[]>([])
  const [verLoading, setVerLoading] = useState(false)
  const [verBusy, setVerBusy] = useState<string | null>(null)

  const loadVerCoaches = useCallback(async () => {
    setVerLoading(true)
    const list = await listCoachesForVerification()
    setVerCoaches(list)
    setVerLoading(false)
  }, [])

  // W10 Day 51: admin invite flow
  const [invites, setInvites] = useState<AdminUserInvite[]>([])
  const [invitesLoading, setInvitesLoading] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<AdminInviteRole>('coach')
  // W12 Day 58: bulk invite mode (wires W11 Day 57 endpoint)
  const [inviteMode, setInviteMode] = useState<'single' | 'bulk'>('single')
  const [bulkEmails, setBulkEmails] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)
  interface BulkResultRow { email: string; status: 'sent' | 'reused' | 'user_exists' | 'invalid' | 'failed'; error?: string }
  interface BulkSummary { total: number; sent: number; reused: number; user_exists: number; invalid: number; failed: number }
  const [bulkResults, setBulkResults] = useState<{ summary: BulkSummary; results: BulkResultRow[] } | null>(null)
  const [inviteSaving, setInviteSaving] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const loadInvites = useCallback(async () => {
    setInvitesLoading(true)
    const list = await listMyAdminInvites({ limit: 50 })
    setInvites(list)
    setInvitesLoading(false)
  }, [])

  const onSubmitInvite = useCallback(async () => {
    if (inviteSaving) return
    setInviteError(null)
    const email = inviteEmail.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError('Введите корректный email')
      return
    }
    setInviteSaving(true)
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: inviteRole }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const errMap: Record<string, string> = {
          user_already_exists: 'Пользователь с таким email уже зарегистрирован',
          invalid_email:       'Некорректный email',
          invalid_role:        'Недопустимая роль',
          admin_only:          'Доступно только администраторам',
        }
        setInviteError(errMap[data?.error] ?? (data?.error || 'Не удалось отправить приглашение'))
        return
      }
      success(data.email_sent ? 'Приглашение отправлено на почту' : 'Приглашение создано (email не настроен)')
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteRole('coach')
      void loadInvites()
    } finally {
      setInviteSaving(false)
    }
  }, [inviteSaving, inviteEmail, inviteRole, success, loadInvites])

  // W12 Day 58: parse newline / comma / whitespace separated emails;
  // dedup + lowercase. Cap at 50 (matches server MAX_BATCH).
  const parsedBulkEmails = useMemo(() => {
    const arr = bulkEmails.split(/[\s,;]+/g).map(s => s.trim().toLowerCase()).filter(Boolean)
    return Array.from(new Set(arr))
  }, [bulkEmails])

  const onSubmitBulkInvite = useCallback(async () => {
    if (bulkSaving) return
    setInviteError(null)
    setBulkResults(null)
    if (parsedBulkEmails.length === 0) {
      setInviteError('Вставьте хотя бы один email')
      return
    }
    if (parsedBulkEmails.length > 50) {
      setInviteError(`Максимум 50 email за раз (сейчас ${parsedBulkEmails.length})`)
      return
    }
    setBulkSaving(true)
    try {
      const res = await fetch('/api/admin/invite/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: parsedBulkEmails, role: inviteRole }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const errMap: Record<string, string> = {
          batch_too_large: `Максимум 50 email за раз`,
          empty_emails:    'Email список пуст',
          invalid_role:    'Недопустимая роль',
          admin_only:      'Доступно только администраторам',
        }
        setInviteError(errMap[data?.error] ?? (data?.error || 'Не удалось отправить bulk-приглашение'))
        return
      }
      setBulkResults({ summary: data.summary, results: data.results })
      const sentLabel = `${data.summary.sent + data.summary.reused} / ${data.summary.total}`
      success(`Bulk-приглашения отправлены: ${sentLabel}`)
      void loadInvites()
    } finally {
      setBulkSaving(false)
    }
  }, [bulkSaving, parsedBulkEmails, inviteRole, success, loadInvites])

  /** Хост Supabase — публичная переменная, единственный проверяемый факт
   *  о том, к какому контуру подключена панель. */
  const supabaseHost = useMemo(() => {
    try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').host } catch { return '—' }
  }, [])

  const onRevokeInvite = useCallback(async (inviteId: string) => {
    const res = await revokeAdminInvite(inviteId)
    if (!res.ok) {
      toastError(res.error ?? 'Не удалось отозвать приглашение')
      return
    }
    success('Приглашение отозвано')
    void loadInvites()
  }, [success, toastError, loadInvites])

  const onToggleVerification = useCallback(async (coach: VerifiableCoach) => {
    if (verBusy) return
    setVerBusy(coach.id)
    const res = await setCoachVerification({ coachId: coach.id, verified: !coach.is_verified })
    setVerBusy(null)
    if (!res.ok) {
      toastError(res.error ?? 'Не удалось переключить верификацию')
      return
    }
    success(coach.is_verified ? 'Верификация снята' : 'Тренер верифицирован')
    void loadVerCoaches()
  }, [verBusy, loadVerCoaches, success, toastError])

  // Assign modal
  const [showAssign, setShowAssign] = useState(false)
  const [assignAthlete, setAssignAthlete] = useState('')
  const [assignCoach, setAssignCoach] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [links, setLinks] = useState<CoachAthleteLink[]>([])
  const [linksLoading, setLinksLoading] = useState(false)

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    const sb = getSB()
    const { data, error } = await sb
      .from('users')
      .select('id, name, email, role, created_at, is_searchable')
      .order('created_at', { ascending: false })
    if (error) { console.error(error); setUsersLoading(false); return }
    const list = (data ?? []) as DBUser[]
    setUsers(list)
    // Обновляем ТОЛЬКО свои поля. Абсолютный setStats с workouts: 0 затирал
    // счётчик, который параллельно проставляет loadWorkoutCount: запросы
    // стартуют вместе, а count по workouts (head:true) обычно возвращается
    // раньше полного select по users — и реальное число заменялось нулём
    // до перезагрузки страницы.
    setStats(prev => ({
      ...prev,
      total: list.length,
      athletes: list.filter(u => u.role === 'athlete').length,
      coaches: list.filter(u => u.role === 'coach').length,
    }))
    setUsersLoading(false)
  }, [])

  const loadWorkoutCount = useCallback(async () => {
    const sb = getSB()
    const { count } = await sb.from('workouts').select('*', { count: 'exact', head: true })
    setStats(prev => ({ ...prev, workouts: count ?? 0 }))
  }, [])

  const loadActivity = useCallback(async () => {
    setActLoading(true)
    const sb = getSB()
    // Show recent workouts as activity feed
    const { data } = await sb
      .from('workouts')
      .select('id, activity_type, event_date, created_at, athlete_id, users!workouts_athlete_id_fkey(name, email)')
      .order('created_at', { ascending: false })
      .limit(30)
    const items: RecentActivity[] = (data ?? []).map((w: any) => ({
      id: w.id,
      actor: w.users?.name ?? w.users?.email ?? 'Атлет',
      action: 'create',
      detail: `${w.activity_type ?? 'Тренировка'} · ${w.event_date}`,
      table_name: 'workouts',
      created_at: w.created_at,
    }))
    setActivity(items)
    setActLoading(false)
  }, [])

  const loadAuditLog = useCallback(async () => {
    setAuditLoading(true)
    setAuditEntries(await listRecentAuditLog(50))
    setAuditLoading(false)
  }, [])

  const loadLinks = useCallback(async () => {
    setLinksLoading(true)
    setLinks(await listCoachAthleteLinks())
    setLinksLoading(false)
  }, [])

  /** Единственное проверяемое утверждение о «системе»: база ответила за N мс. */
  const checkDbConnection = useCallback(async () => {
    setDbPing(prev => ({ ...prev, state: 'checking' }))
    const startedAt = performance.now()
    const { error } = await getSB().from('users').select('id', { count: 'exact', head: true })
    const ms = Math.round(performance.now() - startedAt)
    setDbPing({
      state: error ? 'fail' : 'ok',
      ms,
      at: new Date().toISOString(),
      error: error?.message ?? null,
    })
  }, [])

  useEffect(() => {
    if (user?.role !== 'admin') return
    void loadUsers()
    void loadWorkoutCount()
    void loadAuditLog()
  }, [user, loadUsers, loadWorkoutCount, loadAuditLog])

  useEffect(() => {
    if (user?.role !== 'admin') return
    if (tab === 'audit' && activity.length === 0) void loadActivity()
    if (tab === 'verification' && verCoaches.length === 0) void loadVerCoaches()
    if (tab === 'users' && invites.length === 0) void loadInvites()
    if (tab === 'system' && dbPing.state === 'idle') void checkDbConnection()
  }, [tab, user, activity.length, verCoaches.length, invites.length, dbPing.state,
      loadActivity, loadVerCoaches, loadInvites, checkDbConnection])

  async function changeRole(userId: string, newRole: string) {
    if (changingRole) return
    setChangingRole(userId)
    // Смена роли идёт через серверный маршрут: он перепроверяет права админа
    // на сервере и пишет запись в audit_logs. Прямая запись users.role из
    // браузера запрещена (P0-ревизия, миграция 104).
    const res = await fetch('/api/admin/users/role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({})) as { error?: string }
      toastError(j.error === 'self_role_change_forbidden'
        ? 'Нельзя менять роль самому себе'
        : 'Ошибка смены роли')
      setChangingRole(null)
      return
    }
    const nextUsers = users.map(u => u.id === userId ? { ...u, role: newRole } : u)
    setUsers(nextUsers)
    // Пересчитываем срезы по ролям на месте — иначе карточки «Атлеты/Тренеры»
    // разъезжаются с таблицей до следующей полной загрузки.
    setStats(prev => ({
      ...prev,
      athletes: nextUsers.filter(u => u.role === 'athlete').length,
      coaches:  nextUsers.filter(u => u.role === 'coach').length,
    }))
    success('Роль обновлена')
    void loadAuditLog() // смена роли пишется в журнал — показываем свежую запись
    setChangingRole(null)
  }

  /**
   * Назначение тренера. Прежняя версия писала в athletes.coach_id — колонку,
   * которой нет в модели доступа; реальная связь живёт в trainer_athletes
   * (см. services/admin-assignments.service.ts).
   */
  async function handleAssign() {
    if (!assignAthlete || !assignCoach || assigning) return
    setAssigning(true)
    const res = await assignAthleteToCoach({ athleteId: assignAthlete, coachId: assignCoach })
    setAssigning(false)
    if (!res.ok) {
      toastError(res.error ?? 'Не удалось назначить тренера')
      return
    }
    if (res.alreadyLinked) {
      success('Связь уже существует — ничего не изменилось')
    } else {
      success('Тренер назначен')
      if (res.auditWarning) toastError(`Связь создана, но запись в журнал не прошла: ${res.auditWarning}`)
    }
    setShowAssign(false)
    setAssignAthlete('')
    setAssignCoach('')
    void loadLinks()
    void loadAuditLog()
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
          <i className="ki-filled ki-shield-cross text-2xl text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Доступ запрещён</p>
          <p className="mt-1 text-2sm text-muted-foreground">У вас нет прав для доступа к этому разделу.</p>
        </div>
      </div>
    )
  }

  const athleteCount = stats.athletes
  const coachCount = stats.coaches
  const adminCount = users.filter(u => u.role === 'admin').length
  const athleteOptions = users.filter(u => u.role === 'athlete')
  const coachOptions = users.filter(u => u.role === 'coach')
  const nameById = new Map(users.map(u => [u.id, u.name ?? u.email ?? u.id]))
  const coachesOfSelectedAthlete = assignAthlete
    ? links.filter(l => l.athlete_id === assignAthlete)
    : []

  // Все четыре плитки — счётчики из БД. Прежние «Сущности данных: 13» и
  // «Журналы и sync: 100K» ничего не считали (ревизия P1).
  const dash = (value: number) => (usersLoading ? '—' : value)
  const summary = [
    { label: 'Пользователи', value: dash(stats.total), hint: 'Строк в таблице users', icon: 'ki-people', color: '#2563EB', bg: '#EFF6FF' },
    { label: 'Атлеты', value: dash(stats.athletes), hint: 'Пользователи с ролью athlete', icon: 'ki-check-circle', color: '#16A34A', bg: '#F0FDF4' },
    { label: 'Тренеры', value: dash(stats.coaches), hint: 'Пользователи с ролью coach', icon: 'ki-security-user', color: '#F35703', bg: '#FEF0E7' },
    { label: 'Тренировки', value: stats.workouts, hint: 'Всего записей в workouts', icon: 'ki-chart-line-up', color: '#9333EA', bg: '#FAF5FF' },
  ]

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 pf-enter">
      <section className="relative overflow-hidden rounded-[32px] border border-border bg-card shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(243,87,3,0.12),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.08),_transparent_28%)]" />
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-700">
                  Администрирование
                </span>
                <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-700">
                  Системный контроль
                </span>
              </div>
              <h1 className="pf-num text-[clamp(2.2rem,4vw,3.9rem)] leading-[0.95] tracking-tight text-navy-500">
                Панель администратора
              </h1>
              <p className="mt-4 max-w-xl text-sm text-muted-foreground md:text-base">
                Центр контроля пользователей, политик доступа, журнала действий и базовых сервисов платформы.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => { setShowAssign(true); void loadLinks() }}
                  className="inline-flex items-center gap-2 rounded-[14px] border border-orange-200 bg-[linear-gradient(135deg,#F35703,#D44A02)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(243,87,3,0.26)] transition-transform hover:-translate-y-0.5"
                >
                  <i className="ki-filled ki-people text-sm" />
                  Назначить атлета
                </button>
                <Link
                  href="/admin/orgs"
                  className="inline-flex items-center gap-2 rounded-[14px] border border-border bg-background/80 px-4 py-2.5 text-sm font-semibold text-foreground no-underline shadow-sm transition-all hover:border-orange-200 hover:text-orange-700"
                >
                  <i className="ki-filled ki-office-bag text-sm" />
                  Управление организациями
                </Link>
                <Link
                  href="/admin/commerce"
                  className="inline-flex items-center gap-2 rounded-[14px] border border-green-200 bg-green-50/80 px-4 py-2.5 text-sm font-semibold text-green-700 no-underline shadow-sm transition-all hover:bg-green-100"
                >
                  <i className="ki-filled ki-chart-line-up text-sm" />
                  Коммерция · MRR
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[380px]">
              <div className="rounded-2xl border border-border bg-background/85 p-4 shadow-sm">
                <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Контур доступа</div>
                <div className="mt-2 text-lg font-semibold text-foreground">Права admin активны</div>
                <div className="mt-1 text-2xs text-muted-foreground">Роли, политики и связки доступны для проверки</div>
              </div>
              <div className="rounded-2xl border border-border bg-background/85 p-4 shadow-sm">
                <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Журнал действий</div>
                <div className="mt-2 text-lg font-semibold text-foreground">
                  {auditLoading ? 'Загружаю…' : `${auditEntries.length} записей`}
                </div>
                <div className="mt-1 text-2xs text-muted-foreground">
                  {auditLoading
                    ? 'Читаю audit_logs'
                    : auditEntries.length === 0
                      ? 'В audit_logs пока пусто'
                      : `Последняя — ${formatDateTime(auditEntries[0].created_at)}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map(item => (
          <Card key={item.label} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{item.label}</div>
                <div className="pf-num mt-2 text-3xl leading-none text-foreground">{item.value}</div>
                <div className="mt-2 text-2xs text-muted-foreground">{item.hint}</div>
              </div>
              <div
                style={{ width: 44, height: 44, borderRadius: 14, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <i className={`ki-filled ${item.icon} text-base`} style={{ color: item.color }} />
              </div>
            </div>
          </Card>
        ))}
      </section>

      <section className="overflow-hidden rounded-[30px] border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-2xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Операционный центр</div>
              <h2 className="mt-2 text-xl font-semibold text-navy-500">Контроль ролей, журналов и системных контуров</h2>
              <p className="mt-1 text-2sm text-muted-foreground">Переключайтесь между разделами без потери текущего admin-сценария.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:w-[420px]">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={[
                    'rounded-2xl border px-4 py-3 text-left transition-all',
                    tab === t.id
                      ? 'border-orange-200 bg-orange-50/80 shadow-sm'
                      : 'border-border bg-background/80 hover:border-orange-200 hover:bg-orange-50/40',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tab === t.id ? 'bg-white text-orange-600' : 'bg-accent text-muted-foreground'}`}>
                      <i className={`ki-filled ${t.icon} text-sm`} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-2sm font-semibold text-foreground">{t.label}</div>
                      <div className="text-[11px] text-muted-foreground">{t.hint}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 md:p-6">
          {tab === 'users' && (
            <div className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,2fr)]">
                <div className="rounded-[26px] border border-border bg-background p-5">
                  <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Структура ролей</div>
                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
                      <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-orange-700">Атлеты</div>
                      <div className="pf-num mt-2 text-3xl text-foreground">{dash(athleteCount)}</div>
                      <div className="mt-1 text-2xs text-muted-foreground">Основные участники продуктового контура</div>
                    </div>
                    <div className="rounded-2xl border border-green-100 bg-green-50/70 p-4">
                      <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-green-700">Тренеры</div>
                      <div className="pf-num mt-2 text-3xl text-foreground">{dash(coachCount)}</div>
                      <div className="mt-1 text-2xs text-muted-foreground">Наставники и кураторы программ</div>
                    </div>
                    <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
                      <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-violet-700">Администраторы</div>
                      <div className="pf-num mt-2 text-3xl text-foreground">{dash(adminCount)}</div>
                      <div className="mt-1 text-2xs text-muted-foreground">Контроль ролей, приватности и системных связок</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[26px] border border-border bg-background p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Управление пользователями</div>
                      <h3 className="mt-2 text-lg font-semibold text-navy-500">Роли, статусы и последние входы</h3>
                    </div>
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="inline-flex items-center gap-2 rounded-[14px] border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-100"
                    >
                      <i className="ki-filled ki-plus text-xs" />
                      Новый пользователь
                    </button>
                  </div>

                  {/* Ревизия P1: список — это реальные строки users, которые
                      грузились и выбрасывались; раньше здесь рендерились три
                      выдуманных аккаунта вида athlete@proform.test. */}
                  <div className="mt-4 space-y-3">
                    {usersLoading ? (
                      <div className="py-10 text-center">
                        <div className="mx-auto h-6 w-6 rounded-full border-2 border-orange-500 border-t-transparent pf-spin" />
                      </div>
                    ) : users.length === 0 ? (
                      <div className="rounded-2xl border-2 border-dashed border-border bg-accent/30 px-6 py-10 text-center">
                        <i className="ki-filled ki-people mb-2 block text-3xl text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Пользователей не найдено.</p>
                      </div>
                    ) : users.map(userItem => {
                      const isSelf = userItem.id === user?.id
                      const busy = changingRole === userItem.id
                      const knownRole = (ASSIGNABLE_ROLES as readonly string[]).includes(userItem.role)
                      return (
                      <div key={userItem.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-transform hover:-translate-y-0.5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-sm font-bold pf-num text-foreground">
                              {getInitials(userItem.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-foreground">
                                {userItem.name ?? 'Без имени'}
                                {isSelf && <span className="ml-2 text-2xs font-medium text-muted-foreground">(вы)</span>}
                              </div>
                              <div className="truncate font-mono text-2xs text-muted-foreground">{userItem.email ?? '—'}</div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-2xs font-semibold ${ROLE_BADGE[userItem.role] ?? 'bg-accent text-muted-foreground border border-border'}`}>
                              {ROLE_LABEL[userItem.role] ?? userItem.role}
                            </span>
                          </div>

                          {/* «Последний вход» убран: users не хранит время входа,
                              а auth.users из браузера недоступна — показывать было
                              нечего, кроме выдуманного «2 часа назад». */}
                          <div className="grid min-w-[190px] gap-1 rounded-2xl border border-border bg-background/70 px-3 py-2 lg:text-right">
                            <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Регистрация</div>
                            <div className="text-2sm font-medium text-foreground">{formatDateTime(userItem.created_at)}</div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              disabled
                              title="Редактирование чужого профиля из админки не реализовано — пользователь правит данные сам в /settings"
                              className="inline-flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-xl border border-border bg-background text-muted-foreground opacity-60"
                            >
                              <i className="ki-filled ki-pencil text-xs" />
                            </button>
                            <select
                              value={userItem.role}
                              disabled={isSelf || changingRole !== null}
                              title={isSelf
                                ? 'Нельзя менять роль самому себе — защита от потери последнего доступа'
                                : 'Смена роли идёт через серверный маршрут с записью в журнал'}
                              onChange={e => {
                                const nextRole = e.target.value
                                if (nextRole !== userItem.role) void changeRole(userItem.id, nextRole)
                              }}
                              className="rounded-xl border border-border bg-background px-3 py-2 text-2xs text-foreground outline-none transition-colors focus:border-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {!knownRole && <option value={userItem.role}>{userItem.role} (нестандартная роль)</option>}
                              {ASSIGNABLE_ROLES.map(role => (
                                <option key={role} value={role}>{ROLE_LABEL[role] ?? role}</option>
                              ))}
                            </select>
                            {busy && <div className="h-4 w-4 rounded-full border-2 border-orange-500 border-t-transparent pf-spin" />}
                          </div>
                        </div>
                      </div>
                      )
                    })}
                  </div>
                </div>

                {/* W10 Day 51: pending admin-issued invites */}
                <div className="rounded-[26px] border border-border bg-background p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <div>
                      <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Приглашения</div>
                      <h3 className="mt-2 text-lg font-semibold text-navy-500">
                        Отправленные приглашения
                        {invites.filter(i => i.status === 'pending').length > 0 && (
                          <span className="ml-2 pf-num text-sm text-orange-700">
                            ({invites.filter(i => i.status === 'pending').length} активных)
                          </span>
                        )}
                      </h3>
                    </div>
                  </div>
                  {invitesLoading ? (
                    <div className="py-6 text-center">
                      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full pf-spin mx-auto" />
                    </div>
                  ) : invites.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      Пока не было отправлено приглашений. Используйте кнопку «Новый пользователь» выше.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {invites.map(inv => {
                        const isPending = inv.status === 'pending'
                        const roleLabel = ROLE_LABEL[inv.target_role] ?? inv.target_role
                        const statusLabel = inv.status === 'pending' ? 'Ожидает'
                          : inv.status === 'claimed' ? 'Принято'
                          : inv.status === 'expired' ? 'Истекло'
                          : 'Отозвано'
                        return (
                          <div key={inv.id} className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3 flex-wrap">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-sm font-semibold text-foreground truncate">{inv.email}</span>
                                <span className="inline-flex items-center rounded-full bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 text-2xs font-semibold">
                                  {roleLabel}
                                </span>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold ${
                                  isPending ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : inv.status === 'claimed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-muted text-muted-foreground border border-border'
                                }`}>
                                  {statusLabel}
                                </span>
                              </div>
                              <div className="mt-0.5 text-2xs text-muted-foreground">
                                Создано {new Date(inv.created_at).toLocaleDateString('ru-RU')}
                                {isPending && ` · истекает ${new Date(inv.expires_at).toLocaleDateString('ru-RU')}`}
                                {inv.claimed_at && ` · принято ${new Date(inv.claimed_at).toLocaleDateString('ru-RU')}`}
                              </div>
                            </div>
                            {isPending && (
                              <button
                                onClick={() => onRevokeInvite(inv.id)}
                                className="rounded-xl border border-border bg-card hover:bg-accent text-muted-foreground px-3 py-1.5 text-xs font-semibold"
                                title="Отозвать приглашение"
                              >
                                Отозвать
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'verification' && (
            <div className="space-y-5">
              <div className="rounded-[26px] border border-border bg-background p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                  <div>
                    <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Верификация тренеров</div>
                    <h3 className="mt-2 text-lg font-semibold text-navy-500">Подтверждение личности и квалификации</h3>
                    <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
                      Включите бейдж только после проверки документов и опыта тренера.
                      Verified-бейдж отображается на профиле, в marketplace и других местах как сигнал доверия.
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="pf-num text-3xl font-bold text-foreground">
                      {verCoaches.filter(c => c.is_verified).length}
                      <span className="text-base text-muted-foreground font-normal"> / {verCoaches.length}</span>
                    </div>
                    <div className="text-2xs text-muted-foreground">верифицировано</div>
                  </div>
                </div>

                {verLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
                  </div>
                ) : verCoaches.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-border bg-accent/30 px-6 py-12 text-center">
                    <i className="ki-filled ki-people text-3xl text-muted-foreground mb-2 block" />
                    <p className="text-sm text-muted-foreground">Тренеров пока нет в базе.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {verCoaches.map(c => {
                      const busy = verBusy === c.id
                      return (
                        <div key={c.id}
                          className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 flex-wrap">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-sm font-bold pf-num text-foreground overflow-hidden">
                            {c.avatar_url
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                              : getInitials(c.name ?? c.nickname ?? '?')}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Link href={`/profile/${c.id}`} className="text-sm font-semibold text-foreground hover:text-orange-600 truncate">
                                {c.name ?? c.nickname ?? 'Без имени'}
                              </Link>
                              {c.is_verified && <VerifiedBadge size="sm" />}
                            </div>
                            <div className="truncate font-mono text-2xs text-muted-foreground">{c.email ?? '—'}</div>
                            {c.is_verified && c.verified_at && (
                              <div className="mt-0.5 text-[10px] text-muted-foreground">
                                Верифицирован {new Date(c.verified_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => onToggleVerification(c)}
                            disabled={busy}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold shadow-sm transition disabled:cursor-not-allowed ${
                              c.is_verified
                                ? 'bg-card border border-border text-muted-foreground hover:bg-accent'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            } ${busy ? 'opacity-60' : ''}`}
                          >
                            {busy
                              ? <><div className="w-3 h-3 border-2 border-current/40 border-t-current rounded-full pf-spin" /> Обновляю…</>
                              : c.is_verified
                                ? <><i className="ki-filled ki-cross text-xs" /> Снять</>
                                : <><i className="ki-filled ki-verify text-xs" /> Верифицировать</>}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'privacy' && (
            <div className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,2fr)]">
                <div className="rounded-[26px] border border-border bg-background p-5">
                  <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Контур приватности</div>
                  <h3 className="mt-2 text-lg font-semibold text-navy-500">Матрица доступа для athlete-профилей</h3>
                  <p className="mt-2 text-2sm text-muted-foreground">
                    Администратор видит и корректирует видимость профиля, дневника, тренировок и метрик без перехода в отдельные сервисы.
                  </p>
                  <div className="mt-4 space-y-2 text-2sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-orange-500" />
                      Приватно: доступ только владельцу
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-violet-500" />
                      Только тренеры: контроль внутри команды
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      Публично: видно другим пользователям
                    </div>
                  </div>
                </div>

                {/* Ревизия P1: матрица из пяти селектов была декорацией — ни
                    value/onChange, ни источника данных; значения «Приватно» для
                    выдуманных атлетов выглядели как настоящие политики.
                    Оставлено только проверяемое: список реальных атлетов и флаг
                    users.is_searchable. Остальную приватность спортсмен задаёт
                    сам в /settings — админского канала записи здесь нет. */}
                <div className="space-y-4">
                  <Alert variant="warning">
                    Редактирование политик видимости из админки не реализовано. Настройки приватности
                    (публичный профиль, публичные тренировки, доступ для поиска) меняет сам спортсмен
                    в разделе «Настройки → Приватность».
                  </Alert>

                  {usersLoading ? (
                    <div className="py-10 text-center">
                      <div className="mx-auto h-6 w-6 rounded-full border-2 border-orange-500 border-t-transparent pf-spin" />
                    </div>
                  ) : athleteOptions.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-border bg-accent/30 px-6 py-10 text-center">
                      <i className="ki-filled ki-lock mb-2 block text-3xl text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Атлетов в базе пока нет.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {athleteOptions.map(userItem => (
                        <div key={userItem.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-2xs font-bold pf-num text-foreground">
                            {getInitials(userItem.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-2sm font-semibold text-foreground">{userItem.name ?? 'Без имени'}</div>
                            <div className="truncate font-mono text-2xs text-muted-foreground">{userItem.email ?? '—'}</div>
                          </div>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-2xs font-semibold ${
                            userItem.is_searchable
                              ? 'border border-green-200 bg-green-50 text-green-700'
                              : 'border border-border bg-card text-muted-foreground'
                          }`}>
                            {userItem.is_searchable ? 'Доступен для поиска' : 'Скрыт из поиска'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'audit' && (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Журнал действий</div>
                  <h3 className="mt-2 text-lg font-semibold text-navy-500">Входы, изменения и чувствительные операции</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { void loadAuditLog(); void loadActivity() }}
                    disabled={auditLoading}
                    className="inline-flex items-center gap-2 rounded-[14px] border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-orange-200 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <i className="ki-filled ki-arrows-circle text-xs" />
                    {auditLoading ? 'Обновляю…' : 'Обновить'}
                  </button>
                  <button
                    disabled
                    title="Экспорт журнала в CSV не реализован"
                    className="inline-flex cursor-not-allowed items-center gap-2 rounded-[14px] border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground opacity-60"
                  >
                    <i className="ki-filled ki-abstract-26 text-xs" />
                    Экспорт CSV
                  </button>
                </div>
              </div>

              {/* Ревизия P1: слева — настоящие audit_logs (раньше константа AUDIT
                  из шести придуманных записей), справа — реальная лента последних
                  тренировок из loadActivity(), которая грузилась и не рендерилась. */}
              <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,0.9fr)]">
                <div className="space-y-3">
                  {auditLoading ? (
                    <div className="py-10 text-center">
                      <div className="mx-auto h-6 w-6 rounded-full border-2 border-orange-500 border-t-transparent pf-spin" />
                    </div>
                  ) : auditEntries.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-border bg-accent/30 px-6 py-10 text-center">
                      <i className="ki-filled ki-notepad-edit mb-2 block text-3xl text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">В audit_logs нет записей.</p>
                      <p className="mt-1 text-2xs text-muted-foreground">
                        Журнал заполняется только привилегированными операциями (смена роли, назначение тренера).
                      </p>
                    </div>
                  ) : auditEntries.map(entry => (
                    <div key={entry.id} className="rounded-2xl border border-border bg-background px-4 py-4 shadow-sm">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-2xs font-bold pf-num text-foreground">
                            {getInitials(entry.actor_name ?? entry.actor_email)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-2sm font-semibold text-foreground">
                              {entry.actor_name ?? entry.actor_email ?? 'Системное событие'}
                            </div>
                            <div className="truncate text-2xs text-muted-foreground">{describePayload(entry.payload)}</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-2xs font-semibold ${ACTION_BADGE[entry.action] ?? 'border border-border bg-accent text-muted-foreground'}`}>
                            {ACTION_LABEL[entry.action] ?? entry.action}
                          </span>
                          {entry.target_table && (
                            <span className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-2xs font-medium text-muted-foreground">
                              {TARGET_LABEL[entry.target_table] ?? entry.target_table}
                            </span>
                          )}
                          <span className="text-2xs text-muted-foreground">{formatDateTime(entry.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-[26px] border border-border bg-background p-5">
                  <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Последние тренировки</div>
                  <p className="mt-2 text-2xs text-muted-foreground">
                    Не журнал аудита: тренировки в audit_logs не пишутся, это отдельная лента из таблицы workouts.
                  </p>
                  {actLoading ? (
                    <div className="py-8 text-center">
                      <div className="mx-auto h-5 w-5 rounded-full border-2 border-orange-500 border-t-transparent pf-spin" />
                    </div>
                  ) : activity.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">Тренировок пока нет.</p>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {activity.slice(0, 10).map(item => (
                        <div key={item.id} className="rounded-2xl border border-border bg-card px-3 py-2">
                          <div className="text-2sm font-semibold text-foreground">{item.actor}</div>
                          <div className="truncate text-2xs text-muted-foreground">{item.detail}</div>
                          <div className="text-[11px] text-muted-foreground">{formatDateTime(item.created_at)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'system' && (
            <div className="space-y-5">
              <div>
                <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Система</div>
                <h3 className="mt-2 text-lg font-semibold text-navy-500">Что панель может проверить прямо сейчас</h3>
              </div>

              {/* Ревизия P1: раньше здесь были шесть карточек сервисов с uptime
                  99.9% / 100% и статусами «Работает» — ни одна цифра ниоткуда не
                  бралась. Мониторинга у проекта нет, поэтому вместо выдуманной
                  сводки — честное предупреждение и один измеряемый факт. */}
              <Alert variant="warning" title="Мониторинга у платформы нет">
                Панель не знает uptime сервисов, состояние Vercel Edge или синхронизаций — эти данные
                собирал бы внешний мониторинг, которого в проекте нет. Ниже показано только то, что
                браузер может проверить сам.
              </Alert>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] border border-border bg-background p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${
                          dbPing.state === 'ok' ? 'bg-green-500'
                          : dbPing.state === 'fail' ? 'bg-red-500'
                          : 'bg-slate-400'
                        }`} />
                        <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {dbPing.state === 'ok' ? 'Ответила'
                            : dbPing.state === 'fail' ? 'Ошибка'
                            : dbPing.state === 'checking' ? 'Проверяю'
                            : 'Не проверялось'}
                        </span>
                      </div>
                      <div className="mt-2 text-sm font-semibold text-foreground">Связь с базой данных</div>
                      <div className="mt-1 break-all text-2xs text-muted-foreground">
                        {dbPing.at ? `Проверено ${formatDateTime(dbPing.at)}` : 'Запрос к таблице users из браузера'}
                      </div>
                      {dbPing.error && <div className="mt-1 text-2xs text-red-600">{dbPing.error}</div>}
                    </div>
                    <div className="text-right">
                      <div className="pf-num text-xl text-foreground">{dbPing.ms === null ? '—' : `${dbPing.ms} мс`}</div>
                      <div className="text-[11px] text-muted-foreground">ответ</div>
                    </div>
                  </div>
                  <button
                    onClick={() => void checkDbConnection()}
                    disabled={dbPing.state === 'checking'}
                    className="mt-4 inline-flex items-center gap-2 rounded-[14px] border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-orange-200 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <i className="ki-filled ki-arrows-circle text-xs" />
                    {dbPing.state === 'checking' ? 'Проверяю…' : 'Проверить связь'}
                  </button>
                </div>

                <div className="rounded-[24px] border border-border bg-background p-5 shadow-sm">
                  <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Подключение</div>
                  <dl className="mt-3 space-y-2 text-2sm">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-muted-foreground">Проект Supabase</dt>
                      <dd className="break-all text-right font-mono text-2xs text-foreground">{supabaseHost}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-muted-foreground">Окружение сборки</dt>
                      <dd className="font-mono text-2xs text-foreground">{process.env.NODE_ENV}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-muted-foreground">Пользователей в базе</dt>
                      <dd className="pf-num text-foreground">{dash(stats.total)}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-muted-foreground">Тренировок в базе</dt>
                      <dd className="pf-num text-foreground">{stats.workouts}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-muted-foreground">Записей в журнале</dt>
                      <dd className="pf-num text-foreground">{auditLoading ? '—' : auditEntries.length}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className={`w-full ${inviteMode === 'bulk' ? 'max-w-xl' : 'max-w-md'} rounded-[28px] border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-orange-700">Приглашения</div>
                <h3 className="pf-num mt-2 text-xl text-navy-500">
                  {inviteMode === 'bulk' ? 'Массовое приглашение' : 'Новый пользователь'}
                </h3>
              </div>
              <button
                onClick={() => { setShowInviteModal(false); setInviteError(null); setBulkResults(null) }}
                className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost"
              >
                <i className="ki-filled ki-cross text-sm" />
              </button>
            </div>

            {/* W12 Day 58: mode toggle */}
            <div className="mb-4 inline-flex rounded-2xl border border-border bg-background p-1">
              <button
                onClick={() => { setInviteMode('single'); setBulkResults(null); setInviteError(null) }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  inviteMode === 'single'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Один email
              </button>
              <button
                onClick={() => { setInviteMode('bulk'); setInviteError(null) }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  inviteMode === 'bulk'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Массово (до 50)
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {inviteMode === 'single' ? (
                <div>
                  <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Email</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="newuser@example.com"
                    className="w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Список email (через запятую, пробел или новую строку)
                  </label>
                  <textarea
                    value={bulkEmails}
                    onChange={e => setBulkEmails(e.target.value)}
                    rows={6}
                    placeholder="coach1@example.com&#10;coach2@example.com&#10;coach3@example.com"
                    className="w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-orange-400 resize-vertical font-mono"
                    style={{ minHeight: 110 }}
                  />
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      {parsedBulkEmails.length === 0
                        ? 'Вставьте до 50 адресов'
                        : `Распознано: ${parsedBulkEmails.length}${parsedBulkEmails.length > 50 ? ' (превышает лимит 50)' : ''}`}
                    </span>
                    {parsedBulkEmails.length > 50 && (
                      <span className="text-red-600 font-semibold inline-flex items-center gap-1"><i className="ki-filled ki-information-2 text-xs" /> обрежется до 50</span>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Роль</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as AdminInviteRole)}
                  className="w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                >
                  <option value="athlete">Атлет</option>
                  <option value="coach">Тренер</option>
                  <option value="doctor">Врач</option>
                  <option value="organization">Организация</option>
                </select>
              </div>

              <Alert variant="primary">
                {inviteMode === 'bulk'
                  ? 'Каждый пользователь получит свою ссылку с предзаполненной ролью. Существующие пользователи будут пропущены. Дубликаты email на pending-инвайт переиспользуются.'
                  : 'Пользователь получит email со ссылкой на регистрацию с предзаполненной ролью. Приглашение активно 30 дней.'}
              </Alert>

              {inviteError && (
                <p className="text-xs text-red-600">{inviteError}</p>
              )}

              {/* W12 Day 58: bulk results summary */}
              {bulkResults && (
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Результат</span>
                    {bulkResults.summary.sent > 0 && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                        Sent: {bulkResults.summary.sent}
                      </span>
                    )}
                    {bulkResults.summary.reused > 0 && (
                      <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[10px] font-bold">
                        Reused: {bulkResults.summary.reused}
                      </span>
                    )}
                    {bulkResults.summary.user_exists > 0 && (
                      <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[10px] font-bold">
                        Уже есть: {bulkResults.summary.user_exists}
                      </span>
                    )}
                    {bulkResults.summary.invalid > 0 && (
                      <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.5 text-[10px] font-bold">
                        Invalid: {bulkResults.summary.invalid}
                      </span>
                    )}
                    {bulkResults.summary.failed > 0 && (
                      <span className="inline-flex items-center rounded-full bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-[10px] font-bold">
                        Ошибка: {bulkResults.summary.failed}
                      </span>
                    )}
                  </div>
                  <div className="max-h-44 overflow-y-auto divide-y divide-border">
                    {bulkResults.results.map(r => {
                      const statusMeta: Record<string, { color: string; label: string }> = {
                        sent:        { color: 'text-emerald-700',     label: 'Отправлено' },
                        reused:      { color: 'text-blue-700',        label: 'Переиспользовано' },
                        user_exists: { color: 'text-amber-700',       label: 'Уже зарегистрирован' },
                        invalid:     { color: 'text-muted-foreground',label: 'Невалидный' },
                        failed:      { color: 'text-red-700',         label: 'Ошибка' },
                      }
                      const meta = statusMeta[r.status] ?? { color: '', label: r.status }
                      return (
                        <div key={r.email} className="flex items-center justify-between py-1.5 text-xs">
                          <span className="font-mono text-foreground truncate flex-1 mr-2">{r.email}</span>
                          <span className={`${meta.color} font-semibold shrink-0`}>{meta.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {inviteMode === 'bulk' ? (
                  <button
                    onClick={onSubmitBulkInvite}
                    disabled={bulkSaving || parsedBulkEmails.length === 0}
                    className="kt-btn kt-btn-primary flex-1 disabled:opacity-60"
                  >
                    {bulkSaving
                      ? 'Отправляю…'
                      : `Отправить ${parsedBulkEmails.length > 0 ? parsedBulkEmails.length : ''} приглашений`}
                  </button>
                ) : (
                  <button
                    onClick={onSubmitInvite}
                    disabled={inviteSaving}
                    className="kt-btn kt-btn-primary flex-1 disabled:opacity-60"
                  >
                    {inviteSaving ? 'Отправляю…' : 'Отправить приглашение'}
                  </button>
                )}
                <button
                  onClick={() => { setShowInviteModal(false); setInviteError(null); setBulkResults(null) }}
                  className="kt-btn kt-btn-outline"
                >
                  {bulkResults ? 'Закрыть' : 'Отмена'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[28px] border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-orange-700">Операции доступа</div>
                <h3 className="pf-num mt-2 text-xl text-navy-500">Назначить атлета тренеру</h3>
              </div>
              <button onClick={() => setShowAssign(false)} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
                <i className="ki-filled ki-cross text-sm" />
              </button>
            </div>
            {/* Ревизия P1: селекты получили value/onChange и реальные списки,
                кнопка пишет связь в trainer_athletes (раньше просто закрывала
                модалку, а мёртвый handleAssign целился в athletes.coach_id). */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Атлет</label>
                <select
                  value={assignAthlete}
                  onChange={e => setAssignAthlete(e.target.value)}
                  disabled={usersLoading || athleteOptions.length === 0}
                  className="w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {usersLoading ? 'Загружаю…' : athleteOptions.length === 0 ? 'Атлетов в базе нет' : '— выберите атлета —'}
                  </option>
                  {athleteOptions.map(a => (
                    <option key={a.id} value={a.id}>{a.name ?? 'Без имени'}{a.email ? ` (${a.email})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Тренер</label>
                <select
                  value={assignCoach}
                  onChange={e => setAssignCoach(e.target.value)}
                  disabled={usersLoading || coachOptions.length === 0}
                  className="w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {usersLoading ? 'Загружаю…' : coachOptions.length === 0 ? 'Тренеров в базе нет' : '— выберите тренера —'}
                  </option>
                  {coachOptions.map(c => (
                    <option key={c.id} value={c.id}>{c.name ?? 'Без имени'}{c.email ? ` (${c.email})` : ''}</option>
                  ))}
                </select>
              </div>

              {assignAthlete && (
                <div className="rounded-2xl border border-border bg-background px-3 py-2.5">
                  <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Текущие тренеры атлета</div>
                  {linksLoading ? (
                    <div className="mt-2 h-4 w-4 rounded-full border-2 border-orange-500 border-t-transparent pf-spin" />
                  ) : coachesOfSelectedAthlete.length === 0 ? (
                    <div className="mt-1 text-2sm text-muted-foreground">Связей нет</div>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {coachesOfSelectedAthlete.map(link => (
                        <li key={`${link.trainer_id}-${link.athlete_id}`} className="text-2sm text-foreground">
                          {nameById.get(link.trainer_id) ?? link.trainer_id}
                          <span className="ml-1 text-2xs text-muted-foreground">({link.status ?? '—'})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <Alert variant="primary">
                Создаёт связь в trainer_athletes со статусом «accepted» — тренер получит доступ к тренировкам,
                метрикам и травмам спортсмена. Действие пишется в журнал действий.
              </Alert>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => void handleAssign()}
                  disabled={!assignAthlete || !assignCoach || assigning}
                  title={!assignAthlete || !assignCoach ? 'Выберите атлета и тренера' : 'Создать связь тренер↔спортсмен'}
                  className="kt-btn kt-btn-primary flex-1 disabled:opacity-60"
                >
                  {assigning ? 'Назначаю…' : 'Назначить'}
                </button>
                <button onClick={() => setShowAssign(false)} className="kt-btn kt-btn-outline">Отмена</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
