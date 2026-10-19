'use client'

/**
 * Боковая панель кабинета на shadcn Sidebar (композиция ReUI app-shell-1).
 *
 * Что даёт переход по сравнению с прежней самописной панелью:
 *   - сворачивание в полосу иконок с подсказками на десктопе (Ctrl/⌘+B);
 *   - на мобильном — выезжающая панель с захватом фокуса и закрытием по
 *     Escape вместо самодельного затемнения;
 *   - стили каркаса больше не зависят от Metronic (kt-sidebar, kt-menu и
 *     kt-scrollable уходят вместе с этой заменой).
 *
 * Что сохранено без изменений: состав меню — тот же filterSidebarForRole с
 * учётом глобальной и клубной роли и тарифа, бейджи сообщений и уведомлений,
 * раздел «Семья», выход, ссылка на главную.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { useEffectiveRole } from '@/lib/hooks/useEffectiveRole'
import { usePlan } from '@/lib/hooks/usePlan'
import { useUnreadCounts, badgeLabel } from '@/lib/hooks/useUnreadCounts'
import { filterSidebarForRole } from '@/lib/sidebar/config'
import { roleMeta, rolePanelTitle } from '@/lib/roles'
import { SporteoLogo } from '@/components/ui/SporteoLogo'
import { Icon } from '@/components/ui/Icon'
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/reui/sidebar'

/** Активен ли пункт: точное совпадение или вложенная страница раздела. */
function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true
  // /dashboard — корень кабинета; «вложенными» в него считать нечего.
  return href !== '/dashboard' && pathname.startsWith(href + '/')
}

export default function Sidebar() {
  const pathname = usePathname()
  const { user } = useUser()
  const { effectiveRole, globalRole } = useEffectiveRole()
  // Пока тариф не загрузился — undefined: фильтр тогда не прячет платные
  // пункты, иначе они мигали бы при каждой загрузке.
  const { plan, loading: planLoading } = usePlan()
  const unread = useUnreadCounts()
  const { isMobile, setOpenMobile } = useSidebar()
  const [signingOut, setSigningOut] = useState(false)

  const sections = filterSidebarForRole({
    role:       effectiveRole,
    globalRole,
    childCount: user?.childCount ?? 0,
    plan:       planLoading ? undefined : plan,
  })
  const meta = roleMeta(user?.role)

  // На мобильном панель — выезжающий лист поверх страницы: после перехода
  // его нужно закрыть, иначе новая страница откроется под ним.
  const closeOnMobile = () => { if (isMobile) setOpenMobile(false) }

  // Закрывать лист и на любую смену адреса, а не только по клику в меню:
  // жест «назад», переход из уведомления или ссылки на странице. И при смене
  // режима: открыли меню на планшете в портретной ориентации, повернули в
  // альбомную (появилась постоянная панель) и обратно — без этого лист
  // выезжал сам, хотя его никто не открывал. Прежний самописный провайдер
  // закрывал меню по смене адреса; здесь это поведение сохранено.
  useEffect(() => { setOpenMobile(false) }, [pathname, isMobile, setOpenMobile])

  async function signOut() {
    // Проп disabled у SidebarMenuButton с подсказкой поглощается триггером
    // подсказки и до кнопки не доходит, поэтому защита от повторного клика —
    // здесь, а состояние сообщается через aria-disabled.
    if (signingOut) return
    setSigningOut(true)
    try {
      await createClient().auth.signOut()
      window.location.href = '/auth/login'
    } catch (err) {
      console.error('signOut error:', err)
      setSigningOut(false)
    }
  }

  return (
    <SidebarRoot collapsible="icon" id="sidebar">
      <SidebarHeader className="relative gap-3 px-3 pt-4">
        {/* Мобильный лист: собственная кнопка закрытия. Стандартная кнопка
            листа в реестровом компоненте скрыта и подписана по-английски, а
            без кнопки пользователь скринридера на телефоне не может выйти из
            меню — Escape там недоступен. */}
        {isMobile && (
          <button
            type="button"
            onClick={() => setOpenMobile(false)}
            aria-label="Закрыть меню"
            className="absolute right-3 top-3 z-10 inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Icon name="ki-cross" className="text-base" />
          </button>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Главная"
              onClick={closeOnMobile}
              render={<Link href="/dashboard" />}
              className="h-auto py-2"
            >
              <span className="flex min-w-0 flex-col gap-1 group-data-[collapsible=icon]:hidden">
                <SporteoLogo size="md" />
                <span className="truncate text-xs text-muted-foreground">
                  {rolePanelTitle(user?.role)}
                </span>
              </span>
              {/* В свёрнутом виде вместо логотипа — знак бренда. */}
              <span className="hidden group-data-[collapsible=icon]:block">
                <SporteoLogo size="sm" iconOnly />
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {user && (
          <span
            className="inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold group-data-[collapsible=icon]:hidden"
            style={{ backgroundColor: meta.bg, borderColor: `${meta.text}22`, color: meta.text }}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
            {meta.label}
          </span>
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* Ориентир «навигация» для скринридера: раньше меню приходилось искать
            линейным чтением — ни старая, ни новая панель его не размечали. */}
        <nav aria-label="Основная навигация" className="flex flex-col">
          {sections.map(section => (
            <SidebarGroup key={section.title}>
              <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map(item => {
                    const active = isActive(pathname, item.href)
                    // Пункт уведомлений добавляется в меню динамически, и его href
                    // нет в литеральном типе конфига — отсюда сравнение строкой.
                    const count =
                      item.href === '/messages' ? unread.messages
                      : (item.href as string) === '/notifications' ? unread.notifications
                      : 0
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={active}
                          tooltip={count > 0 ? `${item.label}: ${badgeLabel(count)}` : item.label}
                          onClick={closeOnMobile}
                          render={<Link href={item.href} aria-current={active ? 'page' : undefined} />}
                        >
                          <Icon name={item.icon} />
                          <span>{item.label}</span>
                          {/* Число — в доступном имени ссылки: бейдж лежит вне неё,
                              и скринридер на фокусе пункта его не произносил. */}
                          {count > 0 && <span className="sr-only">, непрочитанных: {count}</span>}
                        </SidebarMenuButton>
                        {count > 0 && (
                          <>
                            <SidebarMenuBadge
                              aria-hidden="true"
                              // Базовые классы бейджа красят текст в цвет акцента при
                              // наведении и на активном пункте — а фон у нас тоже
                              // оранжевый, и цифра пропадала. Перекрываем оба состояния.
                              className="bg-primary text-primary-foreground peer-hover/menu-button:text-primary-foreground peer-data-active/menu-button:text-primary-foreground"
                            >
                              {badgeLabel(count)}
                            </SidebarMenuBadge>
                            {/* В свёрнутой панели бейдж скрыт — оставляем точку на
                                иконке, иначе о новых сообщениях не сообщало ничто. */}
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute right-1 top-1 hidden size-2 rounded-full bg-primary ring-2 ring-sidebar group-data-[collapsible=icon]:block"
                            />
                          </>
                        )}
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>

      <SidebarFooter className="pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="На сайт" onClick={closeOnMobile} render={<Link href="/" />}>
              <Icon name="ki-home-2" />
              <span>На сайт</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Выйти"
              onClick={signOut}
              aria-disabled={signingOut || undefined}
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <Icon name={signingOut ? 'ki-loading' : 'ki-exit-right'} className={signingOut ? 'animate-spin' : undefined} />
              <span>{signingOut ? 'Выход…' : 'Выйти'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </SidebarRoot>
  )
}
