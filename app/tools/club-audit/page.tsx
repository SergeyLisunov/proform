import type { Metadata } from 'next'
import ClubAuditForm from './ClubAuditForm'

export const metadata: Metadata = {
  title: 'Free Club Audit — где теряете управляемость · Sporteo',
  description:
    'Бесплатный AI-аудит спортивного клуба. Опишите структуру + текущие процессы — получите health score, top-3 области риска и конкретный план действий на 30 дней.',
  openGraph: {
    title: 'Free Club Audit — где теряете управляемость',
    description: 'AI-снимок состояния клуба. Без регистрации, 60 секунд.',
  },
}

export default function ClubAuditPage() {
  return <ClubAuditForm />
}
