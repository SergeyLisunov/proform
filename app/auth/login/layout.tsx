/**
 * app/auth/login/layout.tsx — W15 Day 73.
 *
 * Server layout wrapper so /auth/login (which is `'use client'`) can ship
 * route-specific metadata. App Router rule: client components cannot export
 * `metadata`, but a parent server layout can.
 */
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Войти',
  description:
    'Войдите в ProForm — спортивную платформу для тренеров, спортсменов и клубов. Демо-доступ для 5 ролей одним кликом.',
  alternates: { canonical: '/auth/login' },
  openGraph: {
    title: 'Войти · ProForm',
    description:
      'Войдите в ProForm. Демо-доступ для роли тренера, атлета, организации, врача или администратора.',
    url: '/auth/login',
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
