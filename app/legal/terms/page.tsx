/**
 * /legal/terms — Sprint W9 clickability audit fix.
 *
 * Stub Terms of Service page. Created to satisfy the link from W6 Day 31
 * doctor onboarding wizard ("Принимаю Terms of Service" → `/legal/terms`).
 * Before this page existed, clicking the link 404'd.
 *
 * Content is a holding page with key TOS clauses for the platform.
 * Full legal text должен пройти reviewу юриста перед публичным launch.
 */
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Условия использования',
  description:
    'Правила использования платформы ProForm — обработка данных (152-ФЗ), права пользователей, ограничение ответственности.',
  alternates: { canonical: '/legal/terms' },
  openGraph: {
    title: 'Условия использования · ProForm',
    description:
      'Holding-страница TOS платформы ProForm. Полный документ проходит правовую экспертизу.',
    url: '/legal/terms',
  },
  robots: {
    // Legal stubs не индексируем пока финальный TOS не зарелизен.
    index: false,
    follow: true,
  },
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 pf-enter">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground no-underline transition"
        >
          <i className="ki-filled ki-arrow-left text-sm" />
          На главную
        </Link>
      </div>

      <article className="rounded-3xl border border-border bg-card p-6 md:p-8">
        <p className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground mb-2">
          Правовая информация
        </p>
        <h1 className="pf-num text-3xl md:text-4xl font-bold text-foreground leading-tight">
          Условия использования
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Версия от мая 2026 г. · Действует с момента публикации
        </p>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>⚠ Holding-страница.</strong> Полный документ Terms of Service проходит правовую
          экспертизу. Используйте платформу с пониманием изложенных ниже базовых правил. Финальная
          редакция будет опубликована до выхода из закрытого бета-тестирования.
        </div>

        <section className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
          <div>
            <h2 className="text-xl font-bold mb-3">1. Принятие условий</h2>
            <p className="text-muted-foreground">
              Регистрируясь в ProForm, вы соглашаетесь с правилами обработки персональных данных
              (152-ФЗ), политикой конфиденциальности и условиями использования сервиса. Если вы не
              согласны — не используйте платформу.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-3">2. Роли и данные</h2>
            <p className="text-muted-foreground">
              ProForm — платформа для спортивных организаций. Поддерживаются роли:{' '}
              <strong className="text-foreground">athlete</strong>,{' '}
              <strong className="text-foreground">coach</strong>,{' '}
              <strong className="text-foreground">doctor</strong>,{' '}
              <strong className="text-foreground">organization</strong>,{' '}
              <strong className="text-foreground">admin</strong>. Каждая роль видит только те
              данные, к которым у неё есть доступ согласно политике приватности и иерархии
              организации.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-3">3. Медицинская информация (для врачей)</h2>
            <p className="text-muted-foreground">
              Врачи, использующие платформу для написания заключений и рекомендаций:
            </p>
            <ul className="mt-2 list-disc pl-6 space-y-1.5 text-muted-foreground">
              <li>Ответы являются <strong>рекомендациями</strong>, не заменяют clinical examination.</li>
              <li>Обработка медицинских данных соответствует <strong>152-ФЗ</strong> (РФ).</li>
              <li>
                Данные хранятся в <strong>EU-Central-1 (Frankfurt)</strong> у Supabase. Доступ
                ограничен RLS-политиками на уровне базы данных.
              </li>
              <li>
                Видимость рекомендации управляется через <strong>visibility_level</strong>:
                <em>athlete_only</em>, <em>coach_only</em>, <em>coach_and_athlete</em>, <em>org_full</em>.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-3">4. Платежи</h2>
            <p className="text-muted-foreground">
              Подписки и разовые покупки обрабатываются через{' '}
              <strong className="text-foreground">ЮKassa</strong>. Чеки 54-ФЗ выпускаются
              автоматически. Возвраты — по запросу через службу поддержки в течение 14 дней с даты
              покупки.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-3">5. Ограничение ответственности</h2>
            <p className="text-muted-foreground">
              ProForm предоставляет инструменты для тренировочного процесса, но не несёт
              ответственности за травмы, медицинские состояния или результаты тренировок.
              Пользователи действуют под собственную ответственность и под наблюдением
              квалифицированных тренеров и врачей.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-3">6. Удаление аккаунта</h2>
            <p className="text-muted-foreground">
              Вы можете запросить удаление аккаунта в любой момент через{' '}
              <Link href="/settings" className="text-orange-600 hover:underline">
                /settings
              </Link>{' '}
              или написав в поддержку. Данные удаляются в течение 30 дней. Часть анонимизированных
              метрик может сохраняться для аналитических целей.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-3">7. Контакты</h2>
            <p className="text-muted-foreground">
              По любым вопросам, связанным с условиями использования или обработкой данных,
              пишите на{' '}
              <a
                href="mailto:support@proform-delta.vercel.app"
                className="text-orange-600 hover:underline"
              >
                support@proform-delta.vercel.app
              </a>
              .
            </p>
          </div>
        </section>

        <footer className="mt-8 pt-6 border-t border-border text-xs text-muted-foreground">
          <p>
            См. также:{' '}
            <Link href="/" className="text-orange-600 hover:underline">
              Главная
            </Link>{' '}
            ·{' '}
            <Link href="/auth/register" className="text-orange-600 hover:underline">
              Регистрация
            </Link>{' '}
            ·{' '}
            <Link href="/settings/notifications" className="text-orange-600 hover:underline">
              Настройки уведомлений
            </Link>
          </p>
        </footer>
      </article>
    </div>
  )
}
