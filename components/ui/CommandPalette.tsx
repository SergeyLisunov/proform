'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Cmd = {
  id: string
  title: string
  subtitle?: string
  icon: string
  iconColor?: string
  kbd?: string[]
  run: () => void
}

export default function CommandPalette() {
  const router = useRouter()
  const [open, setOpen]   = useState(false)
  const [q, setQ]         = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const close = useCallback(() => { setOpen(false); setQ(''); setActive(0) }, [])

  const go = useCallback((href: string) => () => { close(); router.push(href) }, [close, router])
  const fire = useCallback((name: string) => () => {
    close()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(name))
    }
  }, [close])

  const commands: Cmd[] = useMemo(() => [
    // Navigation
    { id: 'nav-dashboard',     title: 'Главная',          subtitle: 'Дашборд',                icon: 'ki-home-2',          iconColor: '#F97316', run: go('/dashboard') },
    { id: 'nav-diary',         title: 'Дневник',          subtitle: 'Все тренировки',         icon: 'ki-book',            iconColor: '#2563EB', run: go('/diary') },
    { id: 'nav-calendar',      title: 'Календарь',        subtitle: 'Планирование',           icon: 'ki-calendar',        iconColor: '#16A34A', run: go('/calendar') },
    { id: 'nav-templates',     title: 'Шаблоны',          subtitle: 'Библиотека тренировок',  icon: 'ki-notepad-edit',    iconColor: '#F97316', run: go('/templates') },
    { id: 'nav-challenges',    title: 'Челленджи',        subtitle: 'Лидерборды и вызовы',    icon: 'ki-crown',           iconColor: '#10B981', run: go('/challenges') },
    { id: 'nav-cycles',        title: 'Циклы',            subtitle: 'Макроциклы и периодизация', icon: 'ki-chart-simple', iconColor: '#0D9488', run: go('/cycles') },
    { id: 'nav-athletes',      title: 'Атлеты',           subtitle: 'Моя команда',            icon: 'ki-people',          iconColor: '#9333EA', run: go('/athletes') },
    { id: 'nav-competitions',  title: 'Соревнования',     subtitle: 'Старты сезона',          icon: 'ki-crown',           iconColor: '#EA580C', run: go('/competitions') },
    { id: 'nav-connections',   title: 'Связи',            subtitle: 'Тренеры и клубы',        icon: 'ki-address-book',    iconColor: '#0284C7', run: go('/connections') },
    { id: 'nav-messages',      title: 'Сообщения',        subtitle: 'Чаты',                   icon: 'ki-messages',        iconColor: '#7C3AED', run: go('/messages') },
    { id: 'nav-notes',         title: 'Заметки',          subtitle: 'Быстрые записи',         icon: 'ki-notepad-edit',    iconColor: '#D97706', run: go('/notes') },
    { id: 'nav-notifications', title: 'Уведомления',                                         icon: 'ki-notification',    iconColor: '#DC2626', run: go('/notifications') },
    { id: 'nav-search',        title: 'Поиск людей',      subtitle: 'Атлеты и тренеры',       icon: 'ki-magnifier',       iconColor: '#64748B', run: go('/search') },
    { id: 'nav-settings',      title: 'Настройки',                                           icon: 'ki-setting-2',       iconColor: '#475569', run: go('/settings') },
    // Quick actions
    { id: 'act-add-workout',   title: 'Добавить тренировку', subtitle: 'Быстрый ввод',         icon: 'ki-plus',            iconColor: '#F97316', kbd: ['N'], run: fire('proform:open-add-workout') },
    { id: 'act-add-note',      title: 'Новая заметка',    subtitle: 'Голос или текст',        icon: 'ki-microphone-2',    iconColor: '#2563EB', run: go('/notes') },
  ], [go, fire])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return commands
    return commands.filter(c =>
      c.title.toLowerCase().includes(s) ||
      (c.subtitle?.toLowerCase().includes(s) ?? false)
    )
  }, [q, commands])

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const metaK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      if (metaK) {
        e.preventDefault()
        setOpen(o => !o)
        return
      }
      if (!open) return
      if (e.key === 'Escape') { e.preventDefault(); close() }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)) }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
      else if (e.key === 'Enter')     { e.preventDefault(); filtered[active]?.run() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, filtered, active, close])

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30) }, [open])
  useEffect(() => { setActive(0) }, [q])

  if (!open) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}
      onClick={close}
    >
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
      />
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-[620px] max-w-[95vw] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_32px_80px_rgba(0,0,0,0.24)]"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <i className="ki-filled ki-magnifier text-[16px] text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Искать страницу или действие…"
            className="flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded-md border border-border bg-accent px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">ESC</kbd>
        </div>

        <div className="max-h-[400px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Ничего не найдено</div>
          ) : filtered.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={c.run}
              onMouseMove={() => setActive(i)}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                i === active ? 'bg-accent' : 'hover:bg-accent/60'
              }`}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background"
                style={{ color: c.iconColor ?? '#64748B' }}
              >
                <i className={`ki-filled ${c.icon} text-[13px]`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">{c.title}</div>
                {c.subtitle && <div className="truncate text-2xs text-muted-foreground">{c.subtitle}</div>}
              </div>
              {c.kbd && (
                <div className="flex gap-1">
                  {c.kbd.map(k => (
                    <kbd key={k} className="rounded-md border border-border bg-accent px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{k}</kbd>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span><kbd className="rounded bg-accent px-1 font-bold">↑ ↓</kbd> навигация</span>
            <span><kbd className="rounded bg-accent px-1 font-bold">↵</kbd> открыть</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="rounded bg-accent px-1 font-bold">⌘</kbd>
            <kbd className="rounded bg-accent px-1 font-bold">K</kbd>
            <span className="ml-1">переключить</span>
          </div>
        </div>
      </div>
    </div>
  )
}
