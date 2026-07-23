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

/** Глобальная роль из public.users.role. */
export type GlobalRole = 'athlete' | 'coach' | 'organization' | 'admin' | 'doctor'

/** Производная org-роль из org_members.member_role для активной организации. */
export type ScopedOrgRole = 'org_owner' | 'org_admin'

// Re-import тип для use в MenuItem.requiredPlan. Локальный import, чтобы
// круговой зависимости не было — lib/plans.ts не импортирует config.
import type { Plan, PaidPlan } from '@/lib/plans'
import { meetsRequiredPlan } from '@/lib/plans'

/**
 * Резолвленная роль для целей навигации.
 *
 * Этап 2 (этот файл): тип расширен включая ScopedOrgRole. SIDEBAR_CONFIG
 * ПОКА не содержит пунктов специфичных для 'org_owner' / 'org_admin' —
 * для backward-compat scoped org-роли отображаются как 'organization' в
 * filter-функции через getRoleMatchSet(). Когда config'у понадобятся
 * специфичные пункты (этапы 6/7 — owner rebuild, org admin), они просто
 * получат `roles: ['org_owner']` / `roles: ['org_admin']` и автоматически
 * сужат показ.
 */
export type EffectiveRole = GlobalRole | ScopedOrgRole

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
  /**
   * Этап 12 — feature gate по тарифному плану. Если задано, пункт виден
   * только пользователям с эффективным планом >= requiredPlan (см.
   * `meetsRequiredPlan` в lib/plans.ts). Server-side gating всё равно
   * остаётся в API routes / RLS — это UX hint, чтобы не показывать пункт,
   * который сразу же стрельнёт 402.
   *
   * Если поле опущено, требование = free (все видят).
   */
  requiredPlan?: PaidPlan
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
  // Этап 4 sidebar-rebuild — Coach «Мой кокпит». Главное действие тренера —
  // «открыть атлета и зафиксировать тренировку». Поднимаем «Мои атлеты» в
  // первую тройку через отдельную секцию (не под «Сеть»), чтобы coach видел
  // её ещё ДО общего «Тренировки» меню. Quick Log FAB — отдельный client
  // компонент в dashboard layout, добавляется отдельным PR.
  {
    id:    'coach_focus',
    title: 'Мой кокпит',
    items: [
      { id: 'coach.athletes', href: '/athletes', icon: 'ki-abstract-26', label: 'Мои атлеты', roles: ['coach'] },
    ],
  },
  // Этап 6a sidebar-rebuild — Owner/Org Admin «Клуб». Главные задачи Owner'а
  // (ростер, тренеры, расписание, аналитика, медконтроль) выводим в первую
  // секцию сразу после «Главная». Используем roles:['organization'] —
  // getRoleMatchSet() даёт org_owner и org_admin тот же набор пунктов через
  // scoped→global mapping. Этапы 6b-d добавят страницы /org/coaches,
  // /org/medical, /org/schedule. На этапе 7 (org_admin separation) фильтр
  // станет тоньше — org_admin теряет доступ к биллингу/настройкам клуба.
  {
    id:    'club',
    title: 'Клуб',
    items: [
      { id: 'club.dashboard', href: '/org',           icon: 'ki-office-bag',    label: 'Обзор клуба', roles: ['organization'] },
      { id: 'club.athletes',  href: '/org/athletes',  icon: 'ki-abstract-26',   label: 'Спортсмены',  roles: ['organization'] },
      // Этап 6b — /org/coaches уже существует как redirect на /org/members?role=coach
      // (как и /org/athletes); поднимаем в первый ряд section вместе с ростером.
      { id: 'club.coaches',   href: '/org/coaches',   icon: 'ki-notepad-edit',  label: 'Тренеры',     roles: ['organization'] },
      { id: 'club.members',   href: '/org/members',   icon: 'ki-people',        label: 'Участники',   roles: ['organization'] },
      { id: 'club.teams',     href: '/org/teams',     icon: 'ki-abstract-32',   label: 'Группы',      roles: ['organization'] },
      { id: 'club.analytics', href: '/org/analytics', icon: 'ki-chart-line-up', label: 'Аналитика',   roles: ['organization'] },
      // Этап 6c — /org/health уже существует (org-wide health snapshot).
      // Заменяет ранее планировавшийся отдельный /org/medical surface.
      { id: 'club.health',    href: '/org/health',    icon: 'ki-shield-tick',   label: 'Здоровье клуба', roles: ['organization'] },
      // Этап 6d — /calendar уже знает org-режим (isOrg branch с OrgSessionsPanel,
      // listGroupSessions, OrgSessionDrawer). Owner до этого не имел entry в нав.
      // Stable id club.schedule отличается от training.calendar по scope —
      // analytics учитывает откуда пришёл клик, маршрут общий.
      { id: 'club.schedule',  href: '/calendar',      icon: 'ki-calendar',      label: 'Расписание клуба', roles: ['organization'] },
      { id: 'club.activity',  href: '/org/activity',  icon: 'ki-pulse',         label: 'Активность',  roles: ['organization'] },
    ],
  },
  {
    id:    'training',
    title: 'Тренировки',
    items: [
      // Этап 9 — platform admin separation. До этого admin был in-lined в
      // каждой operational роли «на всякий случай», и его сайдбар разрастался
      // до 20+ пунктов. Платформенный admin это back-office сотрудник Sporteo
      // (CRM/leads/commerce/funnel/AB-тесты в section «Управление» ниже), он
      // не coach/athlete/doctor. Для дебага конкретного user-флоу есть
      // impersonation. Поэтому admin удалён из training/medical/network/
      // smart_tools — он туда зайдёт только если действительно нужно
      // (страницы остаются доступны по URL, просто не в нав).
      //
      // Doctor не использует календарь тренировок — у него своё расписание
      // осмотров через doctor_inquiries / medical_checkups. Removed из roles.
      { id: 'training.calendar',     href: '/calendar',     icon: 'ki-calendar',     label: 'Календарь',           roles: ['athlete', 'coach'] },
      // Templates / Cycles — тренерская концепция. Athlete видит план через
      // карточку конкретной тренировки (workout.prescribed_by), отдельный
      // sidebar-пункт для построения шаблонов ему не нужен.
      { id: 'training.templates',    href: '/templates',    icon: 'ki-notepad-edit', label: 'Шаблоны',             roles: ['coach'] },
      { id: 'training.competitions', href: '/competitions', icon: 'ki-medal-star',   label: 'Соревнования',        roles: ['athlete', 'coach'] },
      // Челленджи — motivation surface; для athlete будет в /motivation (этап 3
      // консолидация ещё не выполнена в маршрутах). Coach/org админят.
      { id: 'training.challenges',   href: '/challenges',   icon: 'ki-crown',        label: 'Челленджи',           roles: ['coach', 'organization'] },
      { id: 'training.cycles',       href: '/cycles',       icon: 'ki-abstract-45',  label: 'Циклы',               roles: ['coach'] },
      // /diary — один и тот же роут с разным UI per role (детектится внутри страницы).
      // При rebuild (этап 3) athlete-вариант остаётся, но это de-facto «дневник
      // тренировок» — будущий /training pillar после consolidate /calendar+/diary.
      { id: 'training.diary_athlete', href: '/diary', icon: 'ki-book-open',     label: 'Дневник тренировок', roles: ['athlete'] },
      { id: 'training.diary_coach',   href: '/diary', icon: 'ki-notepad-edit',  label: 'Дневник тренера',     roles: ['coach'] },
      { id: 'training.diary_doctor',  href: '/diary', icon: 'ki-heart-circle',  label: 'Дневник врача',       roles: ['doctor'] },
      // Notes — рабочий инструмент тренера/врача (комментарии). Athlete не
      // ведёт публичных заметок отдельно от дневника.
      { id: 'training.notes',         href: '/notes',     icon: 'ki-notepad-edit',   label: 'Заметки', roles: ['coach', 'organization', 'doctor'] },
      // Records — motivation; для athlete доступно через будущий /goals consolidate.
      // Пока скрыто (страница /records остаётся доступна по URL). Этап 9: убрали
      // admin отсюда — это не back-office surface.
      { id: 'training.load',          href: '/load',      icon: 'ki-pulse',          label: 'Нагрузка · ACWR', roles: ['athlete', 'coach'] },
      // Streaks/Records — motivation surfaces; будут в /motivation. Admin не back-office.
      { id: 'training.messages',      href: '/messages',  icon: 'ki-message-text-2', label: 'Сообщения', roles: ['athlete', 'coach', 'organization', 'doctor'] },
    ],
  },
  // Этап 5 sidebar-rebuild — Doctor «Медицина». Допуски (светофор) — главная
  // ежедневная задача доктора («кто требует моего внимания сегодня»).
  // Размещена выше «Сеть»/«Управление» — приоритет действий, не категория.
  {
    id:    'medical',
    title: 'Медицина',
    items: [
      // Этап 9 — admin удалён: медицинские surface'ы не для back-office.
      { id: 'medical.clearances', href: '/doctor/clearances', icon: 'ki-shield-tick',    label: 'Допуски',  roles: ['doctor'] },
      { id: 'medical.injuries',   href: '/injuries',          icon: 'ki-information-3',  label: 'Травмы',    roles: ['doctor'] },
    ],
  },
  {
    id:    'network',
    title: 'Сеть',
    items: [
      // Этап 9 — admin удалён из network/analytics; backoffice использует
      // /admin/crm и /admin/orgs для просмотра, не client-surface'ы.
      // P2 — клубные каналы: объявления/достижения/тренерская + per-группа.
      // Видимость внутри страницы решает RLS (can_read_channel).
      { id: 'network.channels',  href: '/channels',  icon: 'ki-messages',       label: 'Каналы клуба',    roles: ['athlete', 'coach', 'organization'] },
      { id: 'network.contacts',  href: '/network',   icon: 'ki-people',         label: 'Сеть и контакты', roles: ['athlete', 'organization', 'doctor'] },
      // Coach видит «Мои атлеты» через секцию «Мой кокпит» выше, поэтому здесь
      // dropped из roles чтобы не дублировался. Doctor по-прежнему видит.
      { id: 'network.athletes',  href: '/athletes',  icon: 'ki-abstract-26',    label: 'Мои атлеты',      roles: ['doctor'] },
      // Analytics — для athlete это consumer surface, но обычно смотрят виджеты
      // в /dashboard; отдельная страница - для coach/doctor view.
      { id: 'network.analytics', href: '/analytics', icon: 'ki-chart-line-up',  label: 'Аналитика',       roles: ['coach', 'doctor'] },
    ],
  },
  {
    id:    'smart_tools',
    title: 'Умные инструменты',
    items: [
      // Этап 9 — admin удалён: Sporteo AI это client-facing tool для конечных
      // пользователей, не backoffice surface.
      // Этап 12 — requiredPlan: 'pro'. Server-side gate уже стоит в API
      // (lib/ai/plan-gate.ts → 402); UI hint скрывает пункт у free-tier
      // чтобы не давать ложного affordance. На /pricing они дойдут через
      // отдельный CTA в /dashboard, не через sidebar.
      // Ролевые AI-ассистенты: единый route, роль/тариф/лимит определяет
      // сервер (capabilities). Без requiredPlan — free-tier имеет малый
      // лимит, страница сама показывает остаток и upgrade CTA.
      { id: 'smart_tools.assistant', href: '/assistant', icon: 'ki-message-question', label: 'AI-помощник', roles: ['athlete', 'coach', 'organization', 'doctor'] },
      { id: 'smart_tools.ai', href: '/ai', icon: 'ki-message-programming', label: 'Sporteo AI', roles: ['athlete', 'coach', 'organization', 'doctor'], requiredPlan: 'pro' },
    ],
  },
  {
    id:    'management',
    title: 'Управление',
    items: [
      // management.org удалён — заменён через club.dashboard выше (этап 6a).
      // Старый href '/org' остался той же страницей, но теперь в новой section
      // «Клуб» вместе с остальными org-инструментами.
      //
      // Этап 9 — platform admin separation. Полный backoffice развёрнут в
      // sidebar (раньше был только admin + admin_crm). Все 6 страниц уже
      // существуют в app/admin/*; нужен был только entries в нав. Порядок:
      // home → CRM → orgs → leads → commerce → funnel → A/B-лендинги → A/B-тесты.
      { id: 'management.admin',          href: '/admin',                  icon: 'ki-setting-2',  label: 'Администратор',    roles: ['admin'] },
      { id: 'management.admin_crm',      href: '/admin/crm',              icon: 'ki-graph-3',    label: 'CRM',              roles: ['admin'] },
      { id: 'management.admin_orgs',     href: '/admin/orgs',             icon: 'ki-office-bag', label: 'Организации',      roles: ['admin'] },
      { id: 'management.admin_leads',    href: '/admin/leads',            icon: 'ki-magnifier',  label: 'Лиды',             roles: ['admin'] },
      { id: 'management.admin_commerce', href: '/admin/commerce',         icon: 'ki-dollar',     label: 'Коммерция',        roles: ['admin'] },
      { id: 'management.admin_funnel',   href: '/admin/onboarding-funnel',icon: 'ki-filter',     label: 'Воронка онбординга', roles: ['admin'] },
      { id: 'management.admin_ab',       href: '/admin/landing-ab',       icon: 'ki-flash-circle',      label: 'A/B лендингов',    roles: ['admin'] },
      { id: 'management.admin_ab_tests', href: '/admin/ab-tests',         icon: 'ki-abstract-32',label: 'A/B тесты',        roles: ['admin'] },
    ],
  },
]

/**
 * Динамически инжектируемая секция «Семья» для пользователей с активными
 * parent_links (relationship, не глобальная роль). Используется отдельно от
 * SIDEBAR_CONFIG потому что зависит от runtime-данных, а не от роли в JWT.
 * Этап 8 roadmap — постепенно добавляем кросс-детские агрегаты: схedule
 * (8a), notes/passes (later). Каждый item остаётся виден всем — gating
 * происходит на уровне самой секции (childCount > 0).
 */
export const PARENT_FAMILY_SECTION: SidebarSection = {
  id:    'family',
  title: 'Семья',
  items: [
    { id: 'family.children', href: '/parent/dashboard', icon: 'ki-people',        label: 'Дети',       roles: null },
    // Этап 8a — кросс-детский календарь. Dashboard показывает события по
    // ребёнку (карточка → 3 ближайших); эта страница — обратный axis,
    // события по дате с меткой ребёнка. 4-недельное окно.
    { id: 'family.schedule', href: '/parent/schedule',  icon: 'ki-calendar',      label: 'Расписание', roles: null },
    // Этап 8b — кросс-детский фид заметок тренера. Те же 3 свежих коммента
    // что показывает dashboard под каждым ребёнком, но в едином feed: новые
    // сверху, risk_level / category цветные чипы, лимит 50 записей.
    { id: 'family.notes',    href: '/parent/notes',     icon: 'ki-notepad-edit',  label: 'Заметки',    roles: null },
    // P2 — родитель видит каналы клубов своих детей (RLS-деривация через
    // parent_links; team_parents_chat — главный сценарий).
    { id: 'family.channels', href: '/channels',         icon: 'ki-messages',      label: 'Каналы клуба', roles: null },
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
/**
 * Список ролей, под которыми «считается» текущий effectiveRole для целей
 * фильтрации SIDEBAR_CONFIG. Backward-compat: scoped org-роль наследует
 * видимость глобальной 'organization' пока в конфиге нет специфичных пунктов.
 *
 * Пример: пункт с `roles: ['organization']` будет виден org_owner и org_admin.
 * Когда добавятся пункты с `roles: ['org_owner']` — они будут видны
 * **только** org_owner, не org_admin (точное соответствие).
 *
 * Этап 6/7: когда SIDEBAR_CONFIG получит пункты для org_owner/org_admin,
 * можно убрать mapping и оставить только `[role]` — фильтр станет строгим.
 */
function getRoleMatchSet(role: EffectiveRole | undefined): EffectiveRole[] {
  if (!role) return []
  if (role === 'org_owner' || role === 'org_admin') return [role, 'organization']
  return [role]
}

export function filterSidebarForRole(opts: {
  role:       EffectiveRole | undefined
  childCount: number
  /**
   * Этап 12 — текущий effective plan пользователя. Если undefined (план
   * ещё не загрузился), пункты с requiredPlan НЕ скрываются — это безопасный
   * default чтобы избежать flickering на первой отрисовке. Когда план
   * резолвится, фильтр пересчитывается.
   */
  plan?:      Plan
}): SidebarSection[] {
  const matchSet = getRoleMatchSet(opts.role)
  const planKnown = opts.plan !== undefined
  const sections = SIDEBAR_CONFIG
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        // role gate
        if (item.roles !== null) {
          if (matchSet.length === 0) return false
          if (!item.roles.some((r) => matchSet.includes(r))) return false
        }
        // plan gate (только когда план уже известен)
        if (planKnown && item.requiredPlan) {
          return meetsRequiredPlan(opts.plan!, item.requiredPlan)
        }
        return true
      }),
    }))
    .filter((section) => section.items.length > 0)

  if (opts.childCount > 0) sections.push(PARENT_FAMILY_SECTION)

  return sections
}
