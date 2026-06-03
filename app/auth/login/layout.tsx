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
    'Войдите в Sporteo — спортивную платформу для тренеров, спортсменов, врачей и клубов.',
  alternates: { canonical: '/auth/login' },
  openGraph: {
    title: 'Войти · Sporteo',
    description: 'Войдите в Sporteo — рабочее пространство тренера, спортсмена и клуба.',
    url: '/auth/login',
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
