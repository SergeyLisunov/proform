/**
 * <RoleSection /> — Sprint W14 Day 69; mobile carousel W17 Day 87.
 *
 * Самая важная новая landing-секция. Sporteo — мульти-ролевая платформа,
 * и это её главная differentiation. Этот блок отвечает на «для кого
 * это» в визуальном формате.
 *
 * 4 ключевые роли: athlete / coach / organization / doctor.
 * Все 4 имеют активные demo-аккаунты (link в /auth/login?demo=role).
 * Parent role removed W18 Day 96 (audit C2 — promised but 0 implementation).
 *
 * Layout:
 *   - <sm: horizontal scroll-snap carousel (W17 Day 87 mobile QA fix —
 *     cards stacked vertically was long-scroll wall)
 *   - sm-md: 2-column grid
 *   - lg+: 4-column grid (всё в один ряд)
 *
 * Mobile UX: snap-x mandatory + min-w-[85%] per card даёт «card +
 * peek next» feel — user sees that more cards exist to scroll.
 * Scrollbar visually hidden, но scroll natively works (a11y preserved).
 */
import RoleCard, { type Role } from './RoleCard'

interface RoleEntry {
  role:         Role
  title:        string
  tagline:      string
  features:     string[]
  demoEmail:    string | null
  accent:       string
  accentBg:     string
  accentBorder: string
}

const ROLES: RoleEntry[] = [
  {
    role:    'organization',
    title:   'Руководитель',
    tagline: 'Видит состояние всего клуба на одном дашборде: загрузку команд, риски по спортсменам и работу тренеров.',
    features: [
      'Health-score клуба и риск-картина',
      'Аналитика по всем тренерам и составу',
      'Управление ролями и доступами',
    ],
    demoEmail:    'org@proform.test',
    accent:       '#2563EB',
    accentBg:     '#EFF6FF',
    accentBorder: '#BFDBFE',
  },
  {
    role:    'coach',
    title:   'Тренер',
    tagline: 'Карточки спортсменов, дневник и предиктивная аналитика нагрузки — вся группа под контролем, без переключений между чатами.',
    features: [
      'Контроль нагрузки (ACWR) и риска травм',
      'Дневник и тренерская обратная связь',
      'Адаптивный план для каждого спортсмена',
    ],
    demoEmail:    'coach@proform.test',
    accent:       '#16A34A',
    accentBg:     '#F0FDF4',
    accentBorder: '#BBF7D0',
  },
  {
    role:    'athlete',
    title:   'Спортсмен',
    tagline: 'Свой план на сегодня, прогресс и рекомендации — с импортом данных с умных часов и трекеров.',
    features: [
      'План тренировок и дневник самочувствия',
      'Прогресс, личные метрики и носимые устройства',
      'Рекомендации врача и обратная связь тренера',
    ],
    demoEmail:    'athlete@proform.test',
    accent:       '#F35703',
    accentBg:     '#FEF0E7',
    accentBorder: '#FBC1A0',
  },
  {
    role:    'doctor',
    title:   'Врач',
    tagline: 'Медкарта, ограничения и рекомендации — в защищённом медицинском контуре с полной историей спортсмена.',
    features: [
      'Медкарта спортсмена с историей',
      'Ограничения и противопоказания по тренировкам',
      'Запросы тренеров и ответы врача',
    ],
    demoEmail:    'doctor@proform.test',
    accent:       '#DC2626',
    accentBg:     '#FEF2F2',
    accentBorder: '#FECACA',
  },
  // W18 Day 96 C2 — Parent role removed от UI promise.
  // Audit Day 93 finding: 0 pages, 0 DB schema, 0 onboarding. Promising
  // it на landing был misleading. Parent communication still supported
  // через PDF export + email digests (recipient flow, not logged-in role).
]

export default function RoleSection() {
  return (
    <section className="w-full bg-white py-16 px-4 sm:py-20 sm:px-6 lg:px-10 lg:py-24">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="max-w-3xl">
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700">
            4 роли — одна карточка спортсмена
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-navy-500 sm:text-4xl">
            Каждый получает свой инструмент — и общую картину
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Тренер, спортсмен, врач и руководитель решают разные задачи. Sporteo даёт каждому
            нужный интерфейс — и соединяет всех вокруг единой карточки спортсмена, где каждый
            видит только своё.
          </p>
        </div>

        {/* Mobile: horizontal carousel (W17 Day 87) — overflows max-w container */}
        <div
          className="mt-10 -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:hidden"
          aria-label="Карусель ролей — пролистайте чтобы увидеть все"
        >
          {ROLES.map((entry) => (
            <div
              key={entry.role}
              className="snap-start shrink-0 basis-[85%]"
            >
              <RoleCard {...entry} />
            </div>
          ))}
        </div>

        {/* Mobile scroll hint */}
        <p className="mt-2 text-center text-xs text-muted-foreground sm:hidden">
          → Пролистайте чтобы увидеть все роли
        </p>

        {/* Tablet+ desktop: 2-3-5 col grid (sm hidden because mobile carousel above) */}
        <div className="mt-10 hidden gap-5 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((entry) => (
            <RoleCard key={entry.role} {...entry} />
          ))}
        </div>

        {/* Footer hint */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Demo-аккаунты используют общий пароль и работают в один клик через страницу входа.
        </p>
      </div>
    </section>
  )
}
