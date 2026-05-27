/**
 * /about — W15 Day 75.
 *
 * Public «О платформе» page. Server component, ships own metadata.
 * Content — honest, no fluff, no fake metrics («100K записей», «286
 * атлетов» — все удалены в W14 Day 68). Replaces previous absence (link
 * was promised в footer but page = 404).
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import StaticPageShell from '@/components/layout/StaticPageShell'

export const metadata: Metadata = {
  title: 'О платформе',
  description:
    'ProForm — единая система для тренера, спортсмена, врача и клуба. Замена Excel, чатов и бумажных карточек одной системой. Для клубов и академий в России и СНГ.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'О ProForm — единая система спортивной подготовки',
    description:
      'Почему мы строим ProForm и для кого. Closed-beta status, технологическая основа, что обещаем и что не обещаем.',
    url: '/about',
  },
}

export default function AboutPage() {
  return (
    <StaticPageShell eyebrow="О платформе" title="ProForm — единая система спортивной подготовки">
      <section>
        <h2 className="text-xl font-bold text-foreground">Зачем мы строим ProForm</h2>
        <p className="mt-3 text-muted-foreground">
          Спортивная подготовка в клубах и академиях фрагментирована. Тренер ведёт
          планы в Excel, общается с родителями в Telegram, переписывается с врачом
          в почте, а карточка атлета лежит в бумажной папке. Половина рабочего дня
          уходит на пересылку данных — не на тренерскую работу.
        </p>
        <p className="mt-3 text-muted-foreground">
          ProForm — это одна система, в которой все участники процесса видят
          одинаковую картину прогресса спортсмена. Каждый видит только то, что ему
          нужно, и только тех данных, к которым у него есть доступ.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-foreground">Для кого ProForm</h2>
        <ul className="mt-3 space-y-2 text-muted-foreground">
          <li>
            <strong className="text-foreground">Спортивные клубы</strong> — единое
            расписание, общение с родителями, прозрачность нагрузки.
          </li>
          <li>
            <strong className="text-foreground">Академии и школы</strong> — групповая
            работа с десятками атлетов, методическая преемственность между тренерами.
          </li>
          <li>
            <strong className="text-foreground">Performance-центры</strong> — глубокая
            аналитика нагрузки, восстановления, медицинских показателей.
          </li>
          <li>
            <strong className="text-foreground">Индивидуальные тренеры</strong> — если
            работаете с 5+ атлетами через persistent отношения, а не разовые сессии.
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          ProForm не предназначен для разовых клиентов «фитнес на час» — это
          инфраструктурный инструмент для долгосрочной подготовки.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-foreground">Что мы делаем</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-6 text-muted-foreground">
          <li>Карточки атлетов — тренировки, самочувствие, медицинские заметки</li>
          <li>Планы тренировок и шаблоны для повторяющихся циклов</li>
          <li>Отзывы тренеров на каждую тренировку и долгосрочная адаптация</li>
          <li>Маркетплейс услуг и пакетов тренировок (где это применимо)</li>
          <li>Уведомления — in-app + email — про важные события</li>
          <li>Аналитика готовности, нагрузки, восстановления</li>
          <li>Экспорт PDF-снимков для пересылки родителю / врачу / руководству</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-foreground">Что мы не обещаем</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-6 text-muted-foreground">
          <li>
            <strong className="text-foreground">Не «AI-тренер»</strong> — мы не заменяем
            человеческого тренера. AI-инструменты на платформе помогают тренеру, а не
            работают вместо него.
          </li>
          <li>
            <strong className="text-foreground">Не привязка к одному вендору носимых
            устройств</strong> — поддержка трекеров зависит от тарифа клуба и
            доступности vendor API. Конкретные модели мы не обещаем заранее.
          </li>
          <li>
            <strong className="text-foreground">Не медицинская диагностика</strong> —
            заметки врача в системе это рабочие записи, не клиническое заключение.
            Решения о здоровье принимаются вне платформы, квалифицированными
            специалистами.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-foreground">Технологическая основа</h2>
        <p className="mt-3 text-muted-foreground">
          ProForm построен на современном стеке: Next.js (React), Supabase
          (PostgreSQL), хостинг — Vercel и Supabase EU-Central-1 (Франкфурт).
          Каждая таблица в базе защищена RLS-политиками — каждый запрос проверяется
          на уровне базы данных, не только в коде приложения.
        </p>
        <p className="mt-3 text-muted-foreground">
          Обработка данных соответствует <strong className="text-foreground">152-ФЗ</strong>
          {' '}(РФ). Платежи проходят через ЮKassa с автофискализацией по 54-ФЗ.
          Подробности — в{' '}
          <Link href="/legal/privacy" className="text-orange-600 hover:underline">
            Политике конфиденциальности
          </Link>{' '}
          и{' '}
          <Link href="/legal/terms" className="text-orange-600 hover:underline">
            Условиях использования
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-foreground">Текущий статус</h2>
        <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm">
          <strong className="text-orange-900">Закрытая бета.</strong>
          <p className="mt-1 text-orange-900/80">
            Доступ к платформе — бесплатный во время закрытой беты. Тарифы для
            клубов финализируются. Если хотите подключить клуб или академию —{' '}
            <Link href="/contacts" className="font-semibold text-orange-700 underline">
              напишите нам
            </Link>
            , обсудим условия индивидуально.
          </p>
        </div>
      </section>

      <footer className="border-t border-border pt-6 text-xs text-muted-foreground">
        <p>
          См. также:{' '}
          <Link href="/contacts" className="text-orange-600 hover:underline">
            Контакты
          </Link>{' '}
          ·{' '}
          <Link href="/pricing" className="text-orange-600 hover:underline">
            Тарифы
          </Link>{' '}
          ·{' '}
          <Link href="/legal/terms" className="text-orange-600 hover:underline">
            Условия
          </Link>{' '}
          ·{' '}
          <Link href="/legal/privacy" className="text-orange-600 hover:underline">
            Конфиденциальность
          </Link>
        </p>
      </footer>
    </StaticPageShell>
  )
}
