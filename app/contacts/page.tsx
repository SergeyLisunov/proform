/**
 * /contacts — W15 Day 75.
 *
 * Public contacts page. Server component, ships own metadata. Replaces
 * previous «mailto only» footer link с proper directory.
 *
 * Honest scope: support email + working hours + responsibility split.
 * No fake contact form widget yet — Day 76+ candidate если sales traffic
 * justifies.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, Building2, ShieldCheck, Clock } from 'lucide-react'
import StaticPageShell from '@/components/layout/StaticPageShell'

export const metadata: Metadata = {
  title: 'Контакты',
  description:
    'Связаться с командой Sporteo: поддержка пользователей, подключение клуба, юридические и security вопросы. Email + рабочие часы.',
  alternates: { canonical: '/contacts' },
  openGraph: {
    title: 'Контакты Sporteo',
    description:
      'Email и рабочие часы поддержки. Подключение клуба, юридические и security вопросы.',
    url: '/contacts',
  },
}

interface ContactBlockProps {
  icon: typeof Mail
  title: string
  email: string
  description: string
}

function ContactBlock({ icon: Icon, title, email, description }: ContactBlockProps) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 transition-colors hover:border-orange-200">
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"
        >
          <Icon size={18} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-navy-500">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          <a
            href={`mailto:${email}`}
            className="mt-3 inline-block break-all font-mono text-sm font-semibold text-orange-600 no-underline hover:underline"
          >
            {email}
          </a>
        </div>
      </div>
    </div>
  )
}

export default function ContactsPage() {
  return (
    <StaticPageShell
      eyebrow="Контакты"
      title="Связаться с командой"
      lastUpdated="Обновлено: мая 2026"
    >
      <section>
        <p className="text-muted-foreground">
          Команда Sporteo работает удалённо. Самый быстрый способ связаться — email.
          Все письма читаем в течение рабочего дня. Для срочных вопросов о работе
          существующего клуба пишите на основной адрес поддержки.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <ContactBlock
          icon={Mail}
          title="Поддержка пользователей"
          email="support@proform-delta.vercel.app"
          description="Технические вопросы, ошибки, восстановление доступа, обучение тренеров."
        />
        <ContactBlock
          icon={Building2}
          title="Подключение клуба"
          email="support@proform-delta.vercel.app"
          description="Подключение организации, демо для руководства, обсуждение тарифа клуба."
        />
        <ContactBlock
          icon={ShieldCheck}
          title="Безопасность"
          email="support@proform-delta.vercel.app"
          description="Responsible disclosure уязвимостей. Постарайтесь не публиковать детали до нашего ответа."
        />
        <ContactBlock
          icon={Mail}
          title="Юридические вопросы"
          email="support@proform-delta.vercel.app"
          description="Запросы об обработке персональных данных (152-ФЗ), удаление аккаунта, договорная работа."
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-navy-500">Рабочие часы</h2>
        <div className="mt-3 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <Clock
            aria-hidden="true"
            size={18}
            className="mt-0.5 shrink-0 text-blue-600"
          />
          <div className="text-sm text-blue-900">
            <strong>Пн–Пт · 09:00–18:00 МСК.</strong>
            <p className="mt-1 text-blue-900/80">
              Письма, полученные в выходные или после 18:00, обрабатываются с утра
              следующего рабочего дня. Для срочных production-инцидентов
              существующих клубов — гарантированный ответ в течение 4 часов в
              рабочие дни.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-navy-500">Что прислать в письме</h2>
        <p className="mt-3 text-muted-foreground">
          Чтобы мы могли помочь быстрее, укажите в письме:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6 text-muted-foreground">
          <li>Имя клуба / организации (если уже подключена)</li>
          <li>Ваша роль на платформе (тренер, организация, врач, …)</li>
          <li>Описание ситуации — что произошло, что ожидали, что увидели</li>
          <li>Скриншот, если это про конкретный экран</li>
          <li>Время и часовой пояс события (если про ошибку)</li>
        </ul>
      </section>

      <footer className="border-t border-border pt-6 text-xs text-muted-foreground">
        <p>
          См. также:{' '}
          <Link href="/about" className="text-orange-600 hover:underline">
            О платформе
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
