/**
 * MobileBottomNav — sticky bottom tabs для мобильных (sidebar этап 11).
 *
 * Desktop sidebar collapsed into a hamburger-drawer на mobile, что
 * хорошо для глубокой навигации, но плохо для частых переключений
 * (главная → календарь → дневник). Этот компонент даёт постоянный
 * нижний bar с топ-N пунктами для текущей роли.
 *
 * Источник правды — тот же `filterSidebarForRole` из `lib/sidebar/config`,
 * чтобы избежать расъезда между sidebar и bottom-tab. Берём первый item
 * каждой section (это де-факто «главное действие в категории»), max 5.
 *
 * Видим только на mobile (`lg:hidden`). Desktop рендер — старый sidebar.
 */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'
import { useEffectiveRole } from '@/lib/hooks/useEffectiveRole'
import { filterSidebarForRole, type MenuItem } from '@/lib/sidebar/config'

const MAX_TABS = 5

function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export default function MobileBottomNav() {
  const pathname = usePathname()
  const { user } = useUser()
  const { effectiveRole, loading: roleLoading } = useEffectiveRole()
  const [childCount, setChildCount] = useState(0)

  // parent_links count — для решения, инжектится ли section «Семья».
  // Лёгкий count-only запрос; RLS на parent_links фильтрует к me.
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(getSB() as any)
      .from('parent_links')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', user.id)
      .eq('status', 'active')
      .then(({ count }: { count: number | null }) => {
        if (!cancelled) setChildCount(count ?? 0)
      })
    return () => { cancelled = true }
  }, [user?.id])

  if (roleLoading || !user || !effectiveRole) return null

  const sections = filterSidebarForRole({ role: effectiveRole, childCount })

  // По одному топ-item на section, в порядке config. Если sections >= MAX_TABS,
  // получим ровно 5 разных категорий — caption хорошее покрытие топ-flow.
  const tabs: MenuItem[] = sections
    .flatMap(s => (s.items[0] ? [s.items[0]] : []))
    .slice(0, MAX_TABS)

  if (tabs.length === 0) return null

  return (
    <nav
      aria-label="Мобильная навигация"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur shadow-[0_-2px_12px_rgba(15,23,42,0.06)] lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul
        className="grid w-full"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map(t => {
          // active when pathname === href OR starts-with for nested routes
          // (например /org/members подсвечивает club.athletes /org/athletes? нет —
          // только точное совпадение, иначе ложные подсветки сразу нескольких tabs).
          const isActive = pathname === t.href
          return (
            <li key={t.id} className="min-w-0">
              <Link
                href={t.href}
                aria-current={isActive ? 'page' : undefined}
                className="flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-semibold transition-colors"
                style={{ color: isActive ? '#F35703' : 'var(--muted-foreground)' }}
              >
                <i
                  className={`ki-filled ${t.icon} text-[18px]`}
                  style={{ color: isActive ? '#F35703' : 'var(--muted-foreground)' }}
                />
                <span className="block max-w-full truncate px-1">{t.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
