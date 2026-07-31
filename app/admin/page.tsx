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

function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

type AdminTab = 'users' | 'verification' | 'privacy' | 'audit' | 'system'

type DBUser = { id: string; name: string; email: string; role: string; created_at: string }
type RecentActivity = { id: string; actor: string; action: string; detail: string; table_name: string; created_at: string }

type AdminUser = {
  email: string
  name: string
  role: 'athlete' | 'coach' | 'admin'
  status: 'active'
  created: string
  lastLogin: string
}

type AuditEntry = {
  actor: string
  action: 'login' | 'create' | 'update' | 'privacy_change' | 'role_change' | 'delete'
  target: 'users' | 'workouts' | 'athletes' | 'observation_diary'
  detail: string
  time: string
}

const USERS: AdminUser[] = [
  { email: 'athlete@proform.test', name: 'Sara Kowalski', role: 'athlete', status: 'active', created: '2025-01-15', lastLogin: '2 часа назад' },
  { email: 'coach@proform.test', name: 'Alex Trainer', role: 'coach', status: 'active', created: '2025-01-10', lastLogin: '1 день назад' },
  { email: 'admin@proform.test', name: 'Admin User', role: 'admin', status: 'active', created: '2025-01-01', lastLogin: 'Только что' },
]

const AUDIT: AuditEntry[] = [
  { actor: 'Sara Kowalski', action: 'login', target: 'users', detail: 'Вход через веб-интерфейс', time: '2 ч назад' },
  { actor: 'Sara Kowalski', action: 'create', target: 'workouts', detail: 'Создана тренировка на 62 минуты', time: '2 ч назад' },
  { actor: 'Sara Kowalski', action: 'update', target: 'workouts', detail: 'Публичность тренировки включена', time: '3 ч назад' },
  { actor: 'Sara Kowalski', action: 'privacy_change', target: 'athletes', detail: 'Тренировки доступны только тренерам', time: '1 д назад' },
  { actor: 'Alex Trainer', action: 'create', target: 'observation_diary', detail: 'Добавлена заметка: Возвращение в форму', time: '1 д назад' },
  { actor: 'Admin User', action: 'role_change', target: 'users', detail: 'Подтверждена роль атлета для Sara', time: '5 д назад' },
]

const SYSTEM_SERVICES = [
  { service: 'База данных Supabase', region: 'Франкфурт', status: 'Работает', uptime: '99.9%', icon: 'ki-data', tone: 'blue' },
  { service: 'Аутентификация', region: 'Глобальный контур', status: 'Работает', uptime: '100%', icon: 'ki-security-user', tone: 'green' },
  { service: 'Синхронизация WHOOP', region: 'Европейский узел', status: 'Активно', uptime: '99.7%', icon: 'ki-chart-line-up', tone: 'violet' },
  { service: 'Vercel Edge', region: 'Глобальный контур', status: 'Работает', uptime: '100%', icon: 'ki-route', tone: 'orange' },
  { service: 'Политики доступа', region: 'Слой данных', status: 'Включено', uptime: '100%', icon: 'ki-shield-tick', tone: 'emerald' },
  { service: 'Журнал действий', region: 'Слой данных', status: 'Активно', uptime: '100%', icon: 'ki-abstract-26', tone: 'slate' },
] as const

const TABS: { id: AdminTab; label: string; icon: string; hint: string }[] = [
  { id: 'users', label: 'Пользователи', icon: 'ki-people', hint: 'Роли, статусы и доступы' },
  { id: 'verification', label: 'Верификация', icon: 'ki-verify', hint: 'Подтверждение тренеров' },
  { id: 'privacy', label: 'Приватность', icon: 'ki-lock', hint: 'Политики видимости данных' },
  { id: 'audit', label: 'Журнал действий', icon: 'ki-notepad-edit', hint: 'Последние изменения и входы' },
  { id: 'system', label: 'Система', icon: 'ki-setting-2', hint: 'Ключевые сервисы и контуры' },
]

const ROLE_BADGE: Record<string, string> = {
  athlete: 'bg-orange-50 text-orange-700 border border-orange-200',
  coach: 'bg-green-50 text-green-700 border border-green-200',
  admin: 'bg-violet-50 text-violet-700 border border-violet-200',
  organization: 'bg-blue-50 text-blue-700 border border-blue-200',
  doctor: 'bg-red-50 text-red-700 border border-red-200',
}

const ROLE_LABEL: Record<string, string> = {
  athlete: 'Атлет',
  coach: 'Тренер',
  admin: 'Администратор',
  organization: 'Организация',
  doctor: 'Доктор',
}

const STATUS_LABEL: Record<AdminUser['status'], string> = {
  active: 'Активен',
}

const ACTION_BADGE: Record<AuditEntry['action'], string> = {
  login: 'bg-blue-50 text-blue-700 border border-blue-200',
  create: 'bg-green-50 text-green-700 border border-green-200',
  update: 'bg-orange-50 text-orange-700 border border-orange-200',
  privacy_change: 'bg-violet-50 text-violet-700 border border-violet-200',
  role_change: 'bg-red-50 text-red-700 border border-red-200',
  delete: 'bg-red-50 text-red-700 border border-red-200',
}

const ACTION_LABEL: Record<AuditEntry['action'], string> = {
  login: 'Вход',
  create: 'Создание',
  update: 'Обновление',
  privacy_change: 'Приватность',
  role_change: 'Смена роли',
  delete: 'Удаление',
}

const TARGET_LABEL: Record<AuditEntry['target'], string> = {
  users: 'Пользователи',
  workouts: 'Тренировки',
  athletes: 'Атлеты',
  observation_diary: 'Дневник наблюдений',
}

const SYSTEM_TONE: Record<(typeof SYSTEM_SERVICES)[number]['tone'], { bg: string; icon: string; dot: string }> = {
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600', dot: 'bg-blue-500' },
  green: { bg: 'bg-green-50', icon: 'text-green-600', dot: 'bg-green-500' },
  violet: { bg: 'bg-violet-50', icon: 'text-violet-600', dot: 'bg-violet-500' },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-600', dot: 'bg-orange-500' },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', dot: 'bg-emerald-500' },
  slate: { bg: 'bg-slate-100', icon: 'text-slate-600', dot: 'bg-slate-500' },
}

const PRIVACY_RESOURCES = [
  { id: 'profile', label: 'Профиль' },
  { id: 'workouts', label: 'Тренировки' },
  { id: 'metrics', label: 'Метрики' },
  { id: 'competitions', label: 'Соревнования' },
  { id: 'diary', label: 'Дневник' },
] as const

function getInitials(name: string) {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
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

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    const sb = getSB()
    const { data, error } = await sb
      .from('users')
      .select('id, name, email, role, created_at')
      .order('created_at', { ascending: false })
    if (error) { console.error(error); setUsersLoading(false); return }
    const list = (data ?? []) as DBUser[]
    setUsers(list)
    setStats({
      total: list.length,
      athletes: list.filter(u => u.role === 'athlete').length,
      coaches: list.filter(u => u.role === 'coach').length,
      workouts: 0, // loaded separately
    })
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

  useEffect(() => {
    if (user?.role !== 'admin') return
    loadUsers()
    loadWorkoutCount()
  }, [user, loadUsers, loadWorkoutCount])

  useEffect(() => {
    if (tab === 'audit' && activity.length === 0) loadActivity()
    if (tab === 'verification' && verCoaches.length === 0) void loadVerCoaches()
    if (tab === 'users' && invites.length === 0) void loadInvites()
  }, [tab, activity.length, loadActivity])

  async function changeRole(userId: string, newRole: string) {
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
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    success('Роль обновлена')
    setChangingRole(null)
  }

  async function handleAssign() {
    if (!assignAthlete || !assignCoach) return
    setAssigning(true)
    const sb = getSB()
    const { error } = await sb
      .from('athletes')
      .update({ coach_id: assignCoach })
      .eq('id', assignAthlete)
    if (error) { toastError('Ошибка назначения тренера'); setAssigning(false); return }
    success('Тренер назначен')
    setAssigning(false)
    setShowAssign(false)
    setAssignAthlete('')
    setAssignCoach('')
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

  const todayActiveCount = USERS.filter(item => item.lastLogin === 'Только что' || item.lastLogin.includes('час')).length
  const athleteCount = USERS.filter(item => item.role === 'athlete').length
  const coachCount = USERS.filter(item => item.role === 'coach').length

  const summary = [
    { label: 'Пользователи', value: USERS.length, hint: 'Все тестовые аккаунты контура', icon: 'ki-people', color: '#2563EB', bg: '#EFF6FF' },
    { label: 'Активны сегодня', value: todayActiveCount, hint: 'Свежие входы и действия за день', icon: 'ki-check-circle', color: '#16A34A', bg: '#F0FDF4' },
    { label: 'Сущности данных', value: '13', hint: 'Базовые системные таблицы и политики', icon: 'ki-data', color: '#F35703', bg: '#FEF0E7' },
    { label: 'Журналы и sync', value: '100K', hint: 'События аудита и интеграций', icon: 'ki-chart-line-up', color: '#9333EA', bg: '#FAF5FF' },
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
                  onClick={() => setShowAssign(true)}
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
                <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Живая активность</div>
                <div className="mt-2 text-lg font-semibold text-foreground">{AUDIT.length} событий</div>
                <div className="mt-1 text-2xs text-muted-foreground">Свежие логи входов, изменений и политик</div>
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
                      <div className="pf-num mt-2 text-3xl text-foreground">{athleteCount}</div>
                      <div className="mt-1 text-2xs text-muted-foreground">Основные участники продуктового контура</div>
                    </div>
                    <div className="rounded-2xl border border-green-100 bg-green-50/70 p-4">
                      <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-green-700">Тренеры</div>
                      <div className="pf-num mt-2 text-3xl text-foreground">{coachCount}</div>
                      <div className="mt-1 text-2xs text-muted-foreground">Наставники и кураторы программ</div>
                    </div>
                    <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
                      <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-violet-700">Администраторы</div>
                      <div className="pf-num mt-2 text-3xl text-foreground">1</div>
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

                  <div className="mt-4 space-y-3">
                    {USERS.map(userItem => (
                      <div key={userItem.email} className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-transform hover:-translate-y-0.5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-sm font-bold pf-num text-foreground">
                              {getInitials(userItem.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-foreground">{userItem.name}</div>
                              <div className="truncate font-mono text-2xs text-muted-foreground">{userItem.email}</div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-2xs font-semibold ${ROLE_BADGE[userItem.role]}`}>
                              {ROLE_LABEL[userItem.role]}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-2xs font-medium text-muted-foreground">
                              {STATUS_LABEL[userItem.status]}
                            </span>
                          </div>

                          <div className="grid min-w-[190px] gap-1 rounded-2xl border border-border bg-background/70 px-3 py-2 lg:text-right">
                            <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Последний вход</div>
                            <div className="text-2sm font-medium text-foreground">{userItem.lastLogin}</div>
                            <div className="text-[11px] text-muted-foreground">Создан {userItem.created}</div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              disabled
                              title="Редактирование профиля — Sprint W10. Сейчас пользователь правит сам через /settings"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground opacity-60 cursor-not-allowed"
                            >
                              <i className="ki-filled ki-pencil text-xs" />
                            </button>
                            <select className="rounded-xl border border-border bg-background px-3 py-2 text-2xs text-muted-foreground outline-none transition-colors focus:border-orange-400">
                              <option>Сменить роль</option>
                              <option>атлет</option>
                              <option>тренер</option>
                              <option>администратор</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
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

                <div className="space-y-4">
                  {USERS.filter(item => item.role === 'athlete').map(userItem => (
                    <div key={userItem.email} className="rounded-[26px] border border-border bg-background p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-foreground">{userItem.name}</div>
                          <div className="text-2xs text-muted-foreground">Текущие политики видимости для athlete-профиля</div>
                        </div>
                        <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-2xs font-semibold text-orange-700">
                          Доступ контролируется вручную
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {PRIVACY_RESOURCES.map(resource => (
                          <div key={resource.id} className="rounded-2xl border border-border bg-card px-3 py-3 shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-2sm font-medium text-foreground">{resource.label}</span>
                              <i className="ki-filled ki-security-user text-sm text-orange-500" />
                            </div>
                            <select className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-2xs text-muted-foreground outline-none transition-colors focus:border-orange-400">
                              <option value="private">Приватно</option>
                              <option value="coaches_only">Только тренеры</option>
                              <option value="public">Публично</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
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
                <button
                  disabled
                  title="Экспорт audit-журнала в CSV — Sprint W10"
                  className="inline-flex items-center gap-2 rounded-[14px] border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground opacity-60 cursor-not-allowed"
                >
                  <i className="ki-filled ki-abstract-26 text-xs" />
                  Экспорт CSV
                </button>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,0.9fr)]">
                <div className="space-y-3">
                  {AUDIT.map((entry, index) => (
                    <div key={`${entry.actor}-${index}`} className="rounded-2xl border border-border bg-background px-4 py-4 shadow-sm">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-2xs font-bold pf-num text-foreground">
                            {getInitials(entry.actor)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-2sm font-semibold text-foreground">{entry.actor}</div>
                            <div className="truncate text-2xs text-muted-foreground">{entry.detail}</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-2xs font-semibold ${ACTION_BADGE[entry.action]}`}>
                            {ACTION_LABEL[entry.action]}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-2xs font-medium text-muted-foreground">
                            {TARGET_LABEL[entry.target]}
                          </span>
                          <span className="text-2xs text-muted-foreground">{entry.time}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-[26px] border border-border bg-background p-5">
                  <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Фокус контроля</div>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
                      <div className="text-sm font-semibold text-foreground">Роли и назначения</div>
                      <div className="mt-1 text-2xs text-muted-foreground">Подтверждение athlete-ролей и ручные связки с тренерами.</div>
                    </div>
                    <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
                      <div className="text-sm font-semibold text-foreground">Приватность</div>
                      <div className="mt-1 text-2xs text-muted-foreground">Изменения видимости тренировок и чувствительных метрик.</div>
                    </div>
                    <div className="rounded-2xl border border-green-100 bg-green-50/70 p-4">
                      <div className="text-sm font-semibold text-foreground">Авторизация</div>
                      <div className="mt-1 text-2xs text-muted-foreground">Последние входы и активные пользовательские сессии.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'system' && (
            <div className="space-y-5">
              <div>
                <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Система</div>
                <h3 className="mt-2 text-lg font-semibold text-navy-500">Сервисы, политики и инфраструктурные контуры</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {SYSTEM_SERVICES.map(service => {
                  const tone = SYSTEM_TONE[service.tone]
                  return (
                    <div key={service.service} className="rounded-[24px] border border-border bg-background p-5 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone.bg}`}>
                          <i className={`ki-filled ${service.icon} text-base ${tone.icon}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                            <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{service.status}</span>
                          </div>
                          <div className="mt-2 text-sm font-semibold text-foreground">{service.service}</div>
                          <div className="mt-1 text-2xs text-muted-foreground">{service.region}</div>
                        </div>
                        <div className="text-right">
                          <div className="pf-num text-xl text-foreground">{service.uptime}</div>
                          <div className="text-[11px] text-muted-foreground">uptime</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
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
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Атлет</label>
                <select className="w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-orange-400">
                  <option>Sara Kowalski (athlete@proform.test)</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Тренер</label>
                <select className="w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-orange-400">
                  <option>Alex Trainer (coach@proform.test)</option>
                </select>
              </div>
              <Alert variant="primary">
                Назначение связывает тестового атлета с тренером в рамках демонстрационного admin-сценария.
              </Alert>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    // Demo flow — реальное назначение через RPC будет в Sprint W10.
                    setShowAssign(false)
                  }}
                  className="kt-btn kt-btn-primary flex-1"
                  title="Демо-режим — закроет диалог. Реальное назначение в Sprint W10"
                >
                  Назначить
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
