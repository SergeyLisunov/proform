/**
 * /legal/privacy — W15 Day 75.
 *
 * Public privacy policy. Server component с metadata. Сoexists с
 * /legal/terms (same pattern, holding-banner warning while final legal
 * review pending).
 *
 * Content — 152-ФЗ-aligned stub. Достаточно для прозрачности перед
 * prospect'ами, но не финальный документ. До public launch (после
 * закрытой беты) проходит правовую экспертизу.
 *
 * robots: index: false — same logic как terms (stub doc, не индексируем
 * до final TOS).
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import StaticPageShell from '@/components/layout/StaticPageShell'

export const metadata: Metadata = {
  title: 'Политика конфиденциальности',
  description:
    'Какие данные мы собираем, как обрабатываем, кому передаём. 152-ФЗ-aligned. Holding-документ до финальной правовой экспертизы.',
  alternates: { canonical: '/legal/privacy' },
  openGraph: {
    title: 'Политика конфиденциальности · Sporteo',
    description:
      'Обработка персональных данных в Sporteo. 152-ФЗ. Holding-документ.',
    url: '/legal/privacy',
  },
  robots: {
    // Stub doc — не индексируем до final policy review.
    index: false,
    follow: true,
  },
}

export default function PrivacyPage() {
  return (
    <StaticPageShell
      eyebrow="Правовая информация"
      title="Политика конфиденциальности"
      lastUpdated="Версия от мая 2026 г. · Действует с момента публикации"
    >
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong className="inline-flex items-center gap-1.5"><i className="ki-filled ki-information-4 text-sm" /> Holding-страница.</strong> Полный документ Политики
        конфиденциальности проходит правовую экспертизу. Базовые принципы
        обработки данных изложены ниже; финальная редакция будет опубликована до
        выхода Sporteo из закрытого бета-тестирования.
      </div>

      <section>
        <h2 className="text-xl font-bold text-navy-500">1. Какие данные мы собираем</h2>
        <p className="mt-3 text-muted-foreground">
          Sporteo собирает только те данные, которые необходимы для работы
          платформы:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6 text-muted-foreground">
          <li>
            <strong className="text-foreground">Учётные данные</strong> — email,
            пароль (в хешированном виде), имя, роль, аватар (опционально)
          </li>
          <li>
            <strong className="text-foreground">Профиль атлета</strong> — спорт, дата
            рождения, групповая принадлежность, история тренировок
          </li>
          <li>
            <strong className="text-foreground">Тренировочные данные</strong> —
            планы, выполненные тренировки, отзывы тренера, метрики готовности и
            нагрузки
          </li>
          <li>
            <strong className="text-foreground">Медицинская информация</strong>{' '}
            (опционально, при роли doctor) — заметки врача, рекомендации, история
            травм. Защищается дополнительным уровнем доступа.
          </li>
          <li>
            <strong className="text-foreground">Платёжные данные</strong> — статус
            подписки, тариф, история платежей. Реквизиты банковских карт{' '}
            <strong className="text-foreground">не сохраняются</strong> на нашей
            стороне — обрабатываются ЮKassa.
          </li>
          <li>
            <strong className="text-foreground">Технические данные</strong> — IP-адрес,
            User-Agent, временные метки действий. Для аналитики безопасности и
            предотвращения злоупотреблений.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-navy-500">2. Цели обработки</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-6 text-muted-foreground">
          <li>Предоставление функциональности платформы (основная цель)</li>
          <li>Уведомления о действиях других пользователей в вашей организации</li>
          <li>Биллинг и фискализация платежей (54-ФЗ)</li>
          <li>Аналитика использования продукта (агрегированно, без PII)</li>
          <li>Безопасность — обнаружение и предотвращение злоупотреблений</li>
          <li>Поддержка пользователей — переписка с командой по запросу</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-navy-500">3. Передача третьим сторонам</h2>
        <p className="mt-3 text-muted-foreground">
          Часть данных передаётся процессорам, без которых платформа не может
          работать:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6 text-muted-foreground">
          <li>
            <strong className="text-foreground">Supabase</strong> — хостинг базы
            данных и аутентификации. Регион EU-Central-1 (Франкфурт, Германия).
          </li>
          <li>
            <strong className="text-foreground">Vercel</strong> — хостинг
            веб-приложения. Глобальный CDN, основные регионы — Европа и США.
          </li>
          <li>
            <strong className="text-foreground">Resend</strong> — отправка
            транзакционных email-писем (уведомления, восстановление пароля).
          </li>
          <li>
            <strong className="text-foreground">ЮKassa (Яндекс)</strong> — обработка
            платежей, реквизиты карт. Россия.
          </li>
          <li>
            <strong className="text-foreground">Ollama Cloud</strong> — обработка
            запросов к AI-инструментам платформы (только если вы используете
            соответствующую функциональность). Передаются только данные конкретного
            запроса, без аккаунтной идентификации.
          </li>
          <li>
            <strong className="text-foreground">Vercel Analytics & Speed Insights</strong>{' '}
            — продуктовая аналитика и измерение производительности. Cookieless,
            без PII. Регистрируются обезличенные просмотры страниц, события
            интерфейса (например, клик по CTA) и метрики скорости загрузки.
            Идентификация конкретного пользователя по этим данным невозможна.
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Никакая передача данных в рекламные сети или сторонним аналитическим
          сервисам с PII не производится.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-navy-500">4. Срок хранения</h2>
        <p className="mt-3 text-muted-foreground">
          Данные хранятся в течение всего срока активности аккаунта. После запроса
          на удаление аккаунта данные удаляются в течение 30 календарных дней. Часть
          обезличенных метрик может сохраняться для аналитических целей; они не
          позволяют идентифицировать конкретного пользователя.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-navy-500">5. Права пользователя (152-ФЗ)</h2>
        <p className="mt-3 text-muted-foreground">
          В соответствии с Федеральным законом «О персональных данных» вы имеете
          право:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6 text-muted-foreground">
          <li>Получить информацию об обработке своих персональных данных</li>
          <li>Уточнить, изменить или дополнить свои данные</li>
          <li>Отозвать согласие на обработку (приведёт к удалению аккаунта)</li>
          <li>Запросить удаление аккаунта и связанных данных</li>
          <li>Обжаловать действия оператора в Роскомнадзоре</li>
        </ul>
        <p className="mt-3 text-muted-foreground">
          Для реализации этих прав пишите на{' '}
          <a
            href="mailto:support@proform-delta.vercel.app"
            className="text-orange-600 hover:underline"
          >
            support@proform-delta.vercel.app
          </a>{' '}
          или используйте инструменты в{' '}
          <Link href="/settings" className="text-orange-600 hover:underline">
            настройках аккаунта
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-navy-500">6. Безопасность данных</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-6 text-muted-foreground">
          <li>Шифрование данных при передаче (TLS 1.2+) и хранении (at-rest)</li>
          <li>
            Row-Level Security (RLS) — каждый запрос проверяется на уровне базы
            данных, не только приложения
          </li>
          <li>Регулярный аудит доступа к чувствительным данным</li>
          <li>Сегрегация ролей — каждая роль видит только разрешённые данные</li>
          <li>
            Дополнительный уровень изоляции для медицинских данных (роль doctor)
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-navy-500">7. Cookies и хранение в браузере</h2>
        <p className="mt-3 text-muted-foreground">
          Платформа использует только необходимые и функциональные хранилища:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6 text-muted-foreground">
          <li>
            <strong className="text-foreground">Сессионные cookies</strong> — для
            поддержания авторизованной сессии (Supabase Auth)
          </li>
          <li>
            <strong className="text-foreground">localStorage</strong> — для запоминания
            предпочтений интерфейса (последний email при логине, выбранный режим
            просмотра)
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Cookies для рекламы и сторонней аналитики на платформе не используются.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-navy-500">8. Изменения в политике</h2>
        <p className="mt-3 text-muted-foreground">
          Существенные изменения в Политике публикуются на этой странице. Вы
          получите email-уведомление за 14 дней до вступления изменений в силу. До
          того, как вы продолжите пользоваться платформой после изменений,
          считается, что вы их приняли.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-navy-500">9. Контакты по вопросам обработки данных</h2>
        <p className="mt-3 text-muted-foreground">
          По любым вопросам, связанным с обработкой ваших персональных данных,
          пишите на{' '}
          <a
            href="mailto:support@proform-delta.vercel.app"
            className="text-orange-600 hover:underline"
          >
            support@proform-delta.vercel.app
          </a>
          .
        </p>
      </section>

      <footer className="border-t border-border pt-6 text-xs text-muted-foreground">
        <p>
          См. также:{' '}
          <Link href="/legal/terms" className="text-orange-600 hover:underline">
            Условия использования
          </Link>{' '}
          ·{' '}
          <Link href="/about" className="text-orange-600 hover:underline">
            О платформе
          </Link>{' '}
          ·{' '}
          <Link href="/contacts" className="text-orange-600 hover:underline">
            Контакты
          </Link>
        </p>
      </footer>
    </StaticPageShell>
  )
}
