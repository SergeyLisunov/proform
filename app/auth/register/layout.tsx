/**
 * app/auth/register/layout.tsx — W15 Day 73.
 *
 * Server layout wrapper so /auth/register (client component) can ship
 * route-specific metadata.
 */
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Создать аккаунт',
  description:
    'Создайте аккаунт в ProForm — для тренеров, спортсменов, врачей и спортивных клубов. Бесплатно во время закрытой беты.',
  alternates: { canonical: '/auth/register' },
  openGraph: {
    title: 'Создать аккаунт · ProForm',
    description:
      'Регистрация в ProForm. Подключение клуба за 10 минут. Бесплатно во время закрытой беты.',
    url: '/auth/register',
  },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
