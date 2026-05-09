import type { Metadata } from 'next'
import TeamRiskCalculator from './TeamRiskCalculator'

export const metadata: Metadata = {
  title: 'Team Risk Snapshot — определите атлетов в зоне риска за 60 секунд · ProForm',
  description:
    'Бесплатный AI-инструмент для тренеров и клубов. Введите данные команды (3-12 атлетов) — получите цветовой светофор риска по каждому, причины и конкретные действия на ближайшие 7-14 дней.',
  openGraph: {
    title: 'Team Risk Snapshot — кто из команды в зоне риска',
    description: 'AI-анализ команды по weekly hours + recovery + mood. Без регистрации, 60 секунд.',
  },
}

export default function TeamRiskPage() {
  return <TeamRiskCalculator />
}
