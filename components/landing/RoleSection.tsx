/**
 * <RoleSection /> — Sprint W14 Day 69.
 *
 * Самая важная новая landing-секция. ProForm — мульти-ролевая платформа,
 * и это её главная differentiation. Этот блок отвечает на «для кого
 * это» в визуальном формате.
 *
 * 5 ролей: athlete / coach / organization / doctor / parent.
 * 4 имеют активные demo-аккаунты (link в /auth/login?demo=role).
 * Parent demo deferred — в текущем seed нет parent demo account.
 *
 * Visual: section-level eyebrow + H2 + subline, then 5-card grid:
 *   - <md: 1 column
 *   - md-lg: 2 columns
 *   - lg+: 5 columns (or 3-2 split if 5 не помещаются)
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
    title:   'Организация',
    tagline: 'Структура клуба, группы, тренеры и доступы — в одном экране управления.',
    features: [
      'Группы спортсменов и команд',
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
    tagline: 'Карточки своих спортсменов, журнал тренировок, отзывы — без переключений между чатами.',
    features: [
      'Группы и индивидуальные карточки',
      'Дневник и тренерская обратная связь',
      'Контроль готовности и риска',
    ],
    demoEmail:    'coach@proform.test',
    accent:       '#16A34A',
    accentBg:     '#F0FDF4',
    accentBorder: '#BBF7D0',
  },
  {
    role:    'athlete',
    title:   'Спортсмен',
    tagline: 'Свой прогресс, план на сегодня, рекомендации врача и обратная связь от тренера.',
    features: [
      'План тренировок и самочувствие',
      'Прогресс и личные метрики',
      'Сообщения от тренера и врача',
    ],
    demoEmail:    'athlete@proform.test',
    accent:       '#F97316',
    accentBg:     '#FFF7ED',
    accentBorder: '#FED7AA',
  },
  {
    role:    'doctor',
    title:   'Врач',
    tagline: 'Медицинские заметки, ограничения и рекомендации — в изолированном медицинском контуре.',
    features: [
      'Медкарта спортсмена с историей',
      'Ограничения по тренировкам',
      'Запросы тренеров и ответы',
    ],
    demoEmail:    'doctor@proform.test',
    accent:       '#DC2626',
    accentBg:     '#FEF2F2',
    accentBorder: '#FECACA',
  },
  {
    role:    'parent',
    title:   'Родитель',
    tagline: 'Прозрачность по своему ребёнку: расписание, прогресс, медицинские ограничения.',
    features: [
      'Прогресс только своего ребёнка',
      'Расписание занятий и сборов',
      'Связь с тренером и клубом',
    ],
    demoEmail:    null,   // not seeded in demo yet — beta access only
    accent:       '#7C3AED',
    accentBg:     '#F5F3FF',
    accentBorder: '#DDD6FE',
  },
]

export default function RoleSection() {
  return (
    <section className="w-full bg-white py-20 px-4 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="max-w-3xl">
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700">
            5 ролей — одна карта спортсмена
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Каждый видит только то, что нужно ему
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            ProForm построен на идее, что разные люди вокруг спортсмена решают разные задачи.
            Платформа даёт каждому свой инструмент — но соединяет их вокруг общей карточки спортсмена.
          </p>
        </div>

        {/* 5-card grid */}
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
