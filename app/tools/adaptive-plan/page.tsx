import type { Metadata } from 'next'
import AdaptivePlanForm from './AdaptivePlanForm'

export const metadata: Metadata = {
  title: 'Free 7-day Adaptive Plan — персональный план тренировок за 60 секунд · Sporteo',
  description:
    'Бесплатный AI-инструмент для атлетов. Опишите цель + последние 4 недели тренировок — получите персонализированный план на 7 дней с учётом ваших recovery + nagрузки.',
  openGraph: {
    title: 'Free 7-day Adaptive Plan — Sporteo',
    description: 'AI генерирует план на 7 дней по вашей истории тренировок. Без регистрации, 60 секунд.',
  },
}

export default function AdaptivePlanPage() {
  return <AdaptivePlanForm />
}
