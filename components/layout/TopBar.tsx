'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'
import { useMobileMenu } from '@/lib/hooks/useMobileMenu'

// ── типы ──────────────────────────────────────────────────────────────────────

type Notification = {
  id:           string
  type:         string
  title:        string
  body:         string | null
  action_url:   string | null
  is_read:      boolean
  is_archived:  boolean
  created_at:   string
}

// ── константы ──────────────────────────────────────────────────────────────────

const TITLES: Record<string, { title: string; sub: string }> = {
  '/dashboard':       { title: 'Главная',               sub: 'Обзор ваших тренировок' },
  '/calendar':        { title: 'Календарь',             sub: 'График и события' },
  '/diary':           { title: 'Дневник тренировок',    sub: 'Сессии и наблюдения' },
  '/analytics':       { title: 'Аналитика',             sub: 'Анализ показателей' },
  '/athletes':        { title: 'Мои атлеты',            sub: 'Панель тренера' },
  '/admin/orgs':      { title: 'Организации',           sub: 'Управление организациями' },
  '/admin':           { title: 'Панель администратора', sub: 'Системное администрирование' },
  '/org/members':     { title: 'Участники',             sub: 'Управление участниками' },
  '/org/wall':        { title: 'Стена',                 sub: 'Посты и объявления' },
  '/org/newsletters': { title: 'Рассылки',              sub: 'Рассылка участникам' },
  '/org':             { title: 'Организация',           sub: 'Дашборд организации' },
  '/settings':        { title: 'Профиль атлета',        sub: 'Личные данные и антропометрия' },
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  athlete:      { bg: '#FEF0E7', text: '#F35703', border: '#FBC1A0' },
  coach:        { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  admin:        { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
  organization: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  doctor:       { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
}

const NOTIF_ICONS: Record<string, string> = {
  invitation_received:     'ki-user-plus',
  claim_request:           'ki-key',
  invitation_accepted:     'ki-check-circle',
  invitation_declined:     'ki-cross-circle',
  invitation_cancelled:    'ki-information-5',
  connection_terminated:   'ki-disconnect',
  broadcast:               'ki-notification-on',
  system:                  'ki-setting-2',
  comment:                 'ki-message-text',
  announcement:            'ki-notification-on',
  coach_mark:              'ki-notepad-edit',
  org_post:                'ki-office-bag',
  // W13 Day 65: extend для W12 Day 60 in-app event surface + older types
  session_scheduled:       'ki-calendar',
  session_cancelled:       'ki-calendar-2',
  checkup_scheduled:       'ki-medical-clinic',
  checkup_cancelled:       'ki-medical-clinic',
  invited_to_event:        'ki-rocket',
  event_cancelled:         'ki-rocket',
  pass_issued:             'ki-cup',
  rsvp_received:           'ki-check-circle',
  coach_replied_to_review: 'ki-message-text',
  new_review_for_coach:    'ki-star',
  pass_session_used:       'ki-minus-squared',
}

const NOTIF_COLORS: Record<string, string> = {
  invitation_received:     '#F35703',
  claim_request:           '#F35703',
  invitation_accepted:     '#16A34A',
  invitation_declined:     '#DC2626',
  invitation_cancelled:    '#64748B',
  connection_terminated:   '#DC2626',
  broadcast:               '#2563EB',
  system:                  '#7C3AED',
  comment:                 '#2563EB',
  announcement:            '#F35703',
  coach_mark:              '#16A34A',
  org_post:                '#7C3AED',
  // W13 Day 65: extend для W12 Day 60 + older types — palette matches
  // /notifications page TYPE_COLOR map для cross-surface consistency
  session_scheduled:       '#2563EB',
  session_cancelled:       '#94A3B8',
  checkup_scheduled:       '#DC2626',
  checkup_cancelled:       '#94A3B8',
  invited_to_event:        '#7C3AED',
  event_cancelled:         '#94A3B8',
  pass_issued:             '#F35703',
  rsvp_received:           '#16A34A',
  coach_replied_to_review: '#16A34A',
  new_review_for_coach:    '#F59E0B',
  pass_session_used:       '#F35703',
}

// ── mobile menu toggle ────────────────────────────────────────────────────────
// Uses MobileMenuProvider context (lib/hooks/useMobileMenu) instead of
// Metronic's data-kt-drawer-toggle, which never wired up reliably under
// Next.js hydration. The previous implementation rendered a button with
// `data-kt-drawer-toggle="#sidebar"` and trusted core.bundle.js to install
// click handlers — it didn't, leaving the burger inert on every mobile load.
function MobileMenuToggle() {
  const { open, toggle } = useMobileMenu()
  return (
    <button
      type="button"
      aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
      aria-expanded={open}
      aria-controls="sidebar"
      onClick={toggle}
      className="kt-btn kt-btn-icon kt-btn-ghost lg:hidden"
    >
      <i className={`ki-filled ${open ? 'ki-cross' : 'ki-burger-menu-2'} text-base`} />
    </button>
  )
}

// ── supabase helper ────────────────────────────────────────────────────────────
function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'только что'
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч назад`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} д назад`
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

// ── NOTIFICATIONS DRAWER ───────────────────────────────────────────────────────
function NotificationsDrawer({
  userId, onClose,
}: {
  userId: string
  onClose: () => void
}) {
  const router = useRouter()
  const { user } = useUser()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  // Форма нового объявления (только для тренеров/организаций/админов)
  const [showForm, setShowForm]   = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formBody, setFormBody]   = useState('')
  const [formType, setFormType]   = useState<'comment' | 'announcement'>('comment')
  const [sending, setSending]     = useState(false)

  const canSend = user?.role && ['coach', 'organization', 'admin', 'doctor'].includes(user.role)

  useEffect(() => {
    setMounted(true)
    requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, []) // eslint-disable-line

  useEffect(() => { loadNotifications() }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 260)
  }

  async function loadNotifications() {
    setLoading(true)
    try {
      const { data } = await sb()
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(50)
      setNotifications((data ?? []) as Notification[])
    } finally {
      setLoading(false)
    }
  }

  async function archiveNotif(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await sb().from('notifications').update({ is_archived: true }).eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  async function markAllRead() {
    await sb()
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  async function markRead(id: string) {
    await sb().from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function handleNotifClick(n: Notification) {
    if (!n.is_read) await markRead(n.id)
    if (n.action_url) { handleClose(); router.push(n.action_url) }
  }

  async function sendAnnouncement(e: React.FormEvent) {
    e.preventDefault()
    if (!formTitle.trim() || !user) return
    setSending(true)
    try {
      // Получаем всех атлетов
      const { data: athletes } = await sb()
        .from('users')
        .select('id')
        .eq('role', 'athlete')

      if (athletes && athletes.length > 0) {
        const rows = athletes.map(a => ({
          user_id: a.id,
          type:    formType,
          title:   formTitle.trim(),
          body:    formBody.trim() || null,
        }))
        await sb().from('notifications').insert(rows)
      }

      setFormTitle('')
      setFormBody('')
      setShowForm(false)
      // Обновляем свои уведомления
      loadNotifications()
    } finally {
      setSending(false)
    }
  }

  const displayed = tab === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications
  const unreadCount = notifications.filter(n => !n.is_read).length

  if (!mounted) return null

  return (
    <>
      {/* Backdrop */}
      <div onClick={handleClose} style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(15,23,42,0.5)',
        backdropFilter: 'blur(2px)',
        transition: 'opacity 0.26s',
        opacity: visible ? 1 : 0,
      }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 420, maxWidth: '100vw', zIndex: 9999,
        background: 'var(--card)',
        borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        transition: 'transform 0.26s cubic-bezier(.32,.72,0,1)',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
      }}>

        {/* Header */}
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 className="pf-heading-sm" style={{ color: 'var(--foreground)', margin: 0 }}>Уведомления</h2>
            {unreadCount > 0 && (
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
                {unreadCount} непрочитанных
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={markAllRead}
                className="px-2.5 py-1 rounded-lg text-2xs font-semibold border border-border text-muted-foreground hover:bg-muted transition-all">
                Прочитать все
              </button>
            )}
            <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
              <i className="ki-filled ki-cross text-sm" />
            </button>
          </div>
        </div>

        {/* Форма объявления (только для тренеров/орг/адм) */}
        {canSend && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {!showForm ? (
              <button onClick={() => setShowForm(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border text-muted-foreground hover:border-orange-300 hover:text-foreground hover:bg-orange-50/30 transition-all text-2sm">
                <i className="ki-filled ki-plus text-sm" />
                Отправить объявление атлетам
              </button>
            ) : (
              <form onSubmit={sendAnnouncement} className="flex flex-col gap-2">
                <div className="flex gap-2 mb-1">
                  {(['comment', 'announcement'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setFormType(t)}
                      className={`px-2.5 py-1 rounded-lg text-2xs font-semibold border transition-all ${formType === t ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-border text-muted-foreground'}`}>
                      {t === 'comment' ? '💬 Комментарий' : '📢 Объявление'}
                    </button>
                  ))}
                </div>
                <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)}
                  required placeholder="Заголовок *"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:border-orange-400 transition-all" />
                <textarea value={formBody} onChange={e => setFormBody(e.target.value)}
                  rows={2} placeholder="Текст сообщения (необязательно)…"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:border-orange-400 transition-all resize-none" />
                <div className="flex gap-2">
                  <button type="submit" disabled={sending || !formTitle.trim()}
                    className="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-2xs font-semibold transition-all disabled:opacity-60">
                    {sending ? 'Отправка…' : 'Отправить всем атлетам'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)}
                    className="px-3 py-2 rounded-lg border border-border text-2xs text-muted-foreground hover:bg-muted transition-all">
                    Отмена
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Табы */}
        <div style={{ display: 'flex', gap: 4, padding: '10px 20px 0', flexShrink: 0 }}>
          {([['all', 'Все'], ['unread', 'Непрочитанные']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-2xs font-semibold transition-all ${tab === id ? 'bg-orange-50 text-orange-600 border border-orange-200' : 'text-muted-foreground hover:text-foreground'}`}>
              {label}
              {id === 'unread' && unreadCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Список */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <i className="ki-filled ki-notification-on text-3xl text-muted-foreground/20 mb-3 block" />
              <p className="text-2sm text-muted-foreground">
                {tab === 'unread' ? 'Нет непрочитанных уведомлений' : 'Уведомлений пока нет'}
              </p>
            </div>
          ) : (
            displayed.map(n => {
              const icon  = NOTIF_ICONS[n.type]  ?? 'ki-notification-on'
              const color = NOTIF_COLORS[n.type] ?? '#64748B'
              return (
                <div key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={`group flex items-start gap-3 px-5 py-3.5 transition-colors ${n.action_url ? 'cursor-pointer' : ''} ${!n.is_read ? 'bg-orange-50/40' : 'hover:bg-accent/30'}`}
                  style={{ borderBottom: '1px solid var(--border)', borderLeft: `3px solid ${!n.is_read ? color : 'transparent'}` }}
                >
                  {/* Тип иконка */}
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: color + '15', border: `1px solid ${color}25` }}>
                    <i className={`ki-filled ${icon} text-xs`} style={{ color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-2sm leading-tight ${!n.is_read ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                        {n.title}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-orange-500" />}
                        <button
                          onClick={e => archiveNotif(n.id, e)}
                          className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                          title="Скрыть"
                        >
                          <i className="ki-filled ki-cross text-[10px]" />
                        </button>
                      </div>
                    </div>
                    {n.body && (
                      <p className="text-2xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground/60">{timeAgo(n.created_at)}</span>
                      {n.action_url && (
                        <span className="text-[10px] text-orange-500 font-medium">Подробнее →</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}

// ── MAIN TOPBAR ────────────────────────────────────────────────────────────────
export default function TopBar() {
  const pathname   = usePathname()
  const { user }   = useUser()
  const [showNotif, setShowNotif] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const meta  = Object.entries(TITLES).find(([k]) => pathname === k || pathname.startsWith(k + '/'))?.[1]
  const title = meta?.title ?? 'Sporteo'
  const sub   = meta?.sub   ?? ''
  const date  = new Date().toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const rc    = user ? ROLE_COLORS[user.role] : null

  // Счётчик непрочитанных: initial load + Realtime
  useEffect(() => {
    if (!user?.id) return
    const client = sb()

    const loadCount = async () => {
      const { count } = await client
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .eq('is_archived', false)
      setUnreadCount(count ?? 0)
    }
    loadCount()

    const channel = client
      .channel(`notif-badge-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => { setUnreadCount(prev => prev + 1) })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => { loadCount() })
      .subscribe()

    return () => { client.removeChannel(channel) }
  }, [user?.id])

  const userPill = user && rc ? (
    <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-full border transition-all"
      style={{ background: rc.bg, borderColor: rc.border }}>
      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ background: rc.text + '20', color: rc.text, fontFamily: "var(--pf-font-sans)", fontWeight: 700 }}>
        {user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
      </div>
      <span className="text-2sm font-semibold" style={{ color: rc.text }}>
        {user.name.split(' ')[0]}
      </span>
      <span className="text-2xs uppercase font-bold opacity-60" style={{ color: rc.text }}>
        {user.role === 'athlete' ? 'Атлет'
          : user.role === 'coach' ? 'Тренер'
          : user.role === 'doctor' ? 'Врач'
          : user.role === 'admin' ? 'Админ'
          : 'Орг'}
      </span>
      <i className="ki-filled ki-pencil text-[10px] opacity-40" style={{ color: rc.text }} />
    </div>
  ) : null

  return (
    <>
      <header
        id="header"
        className={`kt-header fixed top-0 z-10 start-0 end-0 flex items-stretch shrink-0 border-b border-b-border transition-shadow duration-200 ${scrolled ? 'shadow-sm' : 'shadow-none'}`}
        style={{ background: 'var(--card, white)' }}
      >
        <div className="kt-container-fixed flex justify-between items-center px-5 lg:px-8 gap-4 w-full" id="headerContainer">

          {/* Left */}
          <div className="flex items-center gap-3">
            <MobileMenuToggle />
            <div>
              <h1 className="pf-num text-xl text-navy-500 leading-none">{title}</h1>
              {sub && <p className="text-2xs text-muted-foreground mt-0.5 hidden sm:block">{sub}</p>}
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">

            {/* Дата → кликабельна, ведёт в /calendar */}
            <Link
              href="/calendar"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border hover:border-orange-300 hover:bg-orange-50/40 transition-all no-underline group"
              title="Открыть календарь"
            >
              <i className="ki-filled ki-calendar text-xs text-muted-foreground group-hover:text-orange-500 transition-colors" />
              <span className="text-2xs text-muted-foreground group-hover:text-foreground transition-colors">{date}</span>
            </Link>

            {/* WHOOP Live */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-2xs font-bold uppercase tracking-wide"
              style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#16A34A' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live
            </div>

            {/* Колокольчик → открывает drawer уведомлений */}
            <button
              onClick={() => setShowNotif(true)}
              className="kt-btn kt-btn-icon kt-btn-ghost relative"
              title="Уведомления"
            >
              <i className="ki-filled ki-notification-on text-base" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Плашка пользователя — клик ведёт в /settings (свой профиль) */}
            {userPill && (
              <Link href="/settings" className="no-underline hover:opacity-80 transition-opacity" title="Открыть профиль">
                {userPill}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Drawer уведомлений */}
      {showNotif && user?.id && (
        <NotificationsDrawer
          userId={user.id}
          onClose={() => setShowNotif(false)}
        />
      )}
    </>
  )
}
