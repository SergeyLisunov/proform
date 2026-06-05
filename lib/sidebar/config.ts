/**
 * Sidebar config — data layer для боковой навигации.
 *
 * Этап 1 roadmap'а sidebar-rebuild (см. docs/strategy/sidebar-rebuild-roadmap.md
 * когда появится; пока — анализ в чате founder'а 05.06.2026):
 *   * вынести inline-конфиг из components/layout/Sidebar.tsx
 *   * добавить stable id к каждому пункту (для analytics + telemetry)
 *   * вынести filter-логику в чистую функцию (тестируема как только внедрим
 *     vitest — пока только Playwright e2e в проекте)
 *
 * Поведение этого этапа == текущее. Никаких role-specific переделок, никаких
 * новых пунктов, никаких consolidate (это этапы 3+). Цель — refactor без
 * regression'ов, готовый фундамент для дальнейших инкрементов.
 *
 * `EffectiveRole` — пока эквивалентен `users.role` (5 глобальных). В будущем
 * (этап 7) расширится до `org_owner`/`org_admin` через резолвинг по
 * `org_members.member_role`; resolver будет жить в `useEffectiveRole` хуке,
 * config — единый источник правды по пунктам.
 */

/** Глобальная роль из public.users.role. Пока 1:1 — потом расширим. */
export type GlobalRole = 'athlete' | 'coach' | 'organization' | 'admin' | 'doctor'

/**
 * Резолвленная роль для целей навигации. На этапе 1 совпадает с GlobalRole;
 * на этапе 7 добавятся 'org_owner' / 'org_admin' (производные от
 * org_members.member_role для активной организации).
 */
export type EffectiveRole = GlobalRole

export interface MenuItem {
  /**
   * Stable id для telemetry / e2e. Формат: `<scope>.<name>`.
   * scope == 'global' для пунктов видимых всем (roles=null), иначе == role.
   * НЕ ИЗМЕНЯТЬ — на эти id могут быть завязаны analytics events и Playwright.
   */
  id:    string
  href:  string
  icon:  string
  label: string
  /**
   * Список ролей, которым видна позиция. `null` означает «всем
   * аутентифицированным» (например /messages у всех ролей).
   */
  roles: EffectiveRole[] | null
}

export interface SidebarSection {
  /** Stable id секции — для analytics группировки и future-конфиг feature-flags. */
  id:    string
  title: string
  items: MenuItem[]
}

/**
 * Текущая структура — 1:1 с тем что было inline в Sidebar.tsx до этого
 * рефакторинга (5 секций + 18 пунктов). Все 5 ролей видят набор согласно
 * `roles` (как и было).
 *
 * Следующие шаги (когда founder подтвердит каждый):
 *   - этап 3: athlete sidebar сократить до 6-7 пунктов
 *   - этап 4: coach sidebar reorder + quick-log
 *   - этап 5: doctor + /doctor/clearances
 *   - этап 6: owner sidebar полный
 *   - этап 7: org_admin как effective role
 *   - этап 9: platform admin отдельно от operational ролей
 */
export const SIDEBAR_CONFIG: SidebarSection[] = [
  {
    id:    'overview',
    title: 'Обзор',
    items: [
      { id: 'global.dashboard', href: '/dashboard', icon: 'ki-element-11', label: 'Главная', roles: null },
    ],
  },
  {
    id:    'training',
    title: 'Тренировки',
    items: [
      { id: 'training.calendar',     href: '/calendar',     icon: 'ki-calendar',     label: 'Календарь',           roles: ['athlete', 'coach', 'admin', 'doctor'] },
      { id: 'training.templates',    href: '/templates',    icon: 'ki-notepad-edit', label: 'Шаблоны',             roles: ['athlete', 'coach', 'admin'] },
      { id: 'training.competitions', href: '/competitions', icon: 'ki-medal-star',   label: 'Соревнования',        roles: ['athlete', 'coach', 'admin'] },
      { id: 'training.challenges',   href: '/challenges',   icon: 'ki-crown',        label: 'Челленджи',           roles: ['athlete', 'coach', 'organization', 'admin'] },
      { id: 'training.cycles',       href: '/cycles',       icon: 'ki-abstract-45',  label: 'Циклы',               roles: ['athlete', 'coach', 'admin'] },
      // /diary — один и тот же роут с разным UI per role (детектится внутри страницы).
      // Поэтому три отдельных MenuItem с одним href, разными label и роли.
      // При rebuild (этапы 3-5) разделим на /coach/diary, /doctor/diary, /athlete/training.
      { id: 'training.diary_athlete', href: '/diary', icon: 'ki-book-open',     label: 'Дневник тренировок', roles: ['athlete', 'admin'] },
      { id: 'training.diary_coach',   href: '/diary', icon: 'ki-notepad-edit',  label: 'Дневник тренера',     roles: ['coach'] },
      { id: 'training.diary_doctor',  href: '/diary', icon: 'ki-heart-circle',  label: 'Дневник врача',       roles: ['doctor'] },
      { id: 'training.notes',         href: '/notes',     icon: 'ki-notepad-edit',   label: 'Заметки', roles: null },
      { id: 'training.records',       href: '/records',   icon: 'ki-medal',          label: 'Рекорды',        roles: ['athlete', 'admin'] },
      { id: 'training.load',          href: '/load',      icon: 'ki-pulse',          label: 'Нагрузка · ACWR', roles: ['athlete', 'coach', 'admin'] },
      { id: 'training.streaks',       href: '/streaks',   icon: 'ki-flash',          label: 'Серия и бейджи',  roles: ['athlete', 'admin'] },
      { id: 'training.messages',      href: '/messages',  icon: 'ki-message-text-2', label: 'Сообщения', roles: ['athlete', 'coach', 'organization', 'admin', 'doctor'] },
    ],
  },
  {
    id:    'network',
    title: 'Сеть',
    items: [
      { id: 'network.contacts',  href: '/network',   icon: 'ki-people',         label: 'Сеть и контакты', roles: ['athlete', 'coach', 'organization', 'admin', 'doctor'] },
      { id: 'network.athletes',  href: '/athletes',  icon: 'ki-abstract-26',    label: 'Мои атлеты',      roles: ['coach', 'admin', 'doctor'] },
      { id: 'network.analytics', href: '/analytics', icon: 'ki-chart-line-up',  label: 'Аналитика',       roles: ['athlete', 'coach', 'admin', 'doctor'] },
    ],
  },
  {
    id:    'smart_tools',
    title: 'Умные инструменты',
    items: [
      { id: 'smart_tools.ai', href: '/ai', icon: 'ki-sparkle', label: 'Sporteo AI', roles: ['athlete', 'coach', 'organization', 'admin', 'doctor'] },
    ],
  },
  {
    id:    'management',
    title: 'Управление',
    items: [
      { id: 'management.org',       href: '/org',       icon: 'ki-office-bag', label: 'Организация',  roles: ['organization'] },
      { id: 'management.admin',     href: '/admin',     icon: 'ki-setting-2',  label: 'Администратор', roles: ['admin'] },
      { id: 'management.admin_crm', href: '/admin/crm', icon: 'ki-graph-3',    label: 'CRM',          roles: ['admin'] },
    ],
  },
]

/**
 * Динамически инжектируемая секция «Семья» для пользователей с активными
 * parent_links (relationship, не глобальная роль). Используется отдельно от
 * SIDEBAR_CONFIG потому что зависит от runtime-данных, а не от роли в JWT.
 * Этап 8 roadmap'а — расширить (расписание/посещаемость/платежи); пока 1 пункт.
 */
export const PARENT_FAMILY_SECTION: SidebarSection = {
  id:    'family',
  title: 'Семья',
  items: [
    { id: 'family.children', href: '/parent/dashboard', icon: 'ki-people', label: 'Дети', roles: null },
  ],
}

/**
 * Чистая функция фильтрации sidebar по роли + parent-условию. Не делает
 * никаких side effects, готова к unit-тестам как только внедрим vitest.
 *
 * Поведение НЕ ИЗМЕНИЛОСЬ относительно inline-кода в Sidebar.tsx до рефактора:
 *   - item.roles === null → виден всем аутентифицированным
 *   - role === undefined (пользователь не загружен) → пункты с roles!=null
 *     не показываются (как раньше: `if (!user) return false`)
 *   - секции без пунктов после фильтра — отбрасываются
 *   - section «Семья» добавляется в конец если childCount > 0
 */
export function filterSidebarForRole(opts: {
  role:       EffectiveRole | undefined
  childCount: number
}): SidebarSection[] {
  const sections = SIDEBAR_CONFIG
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.roles === null) return true
        if (!opts.role) return false
        return item.roles.includes(opts.role)
      }),
    }))
    .filter((section) => section.items.length > 0)

  if (opts.childCount > 0) sections.push(PARENT_FAMILY_SECTION)

  return sections
}
