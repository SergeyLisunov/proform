import type { Metadata } from 'next'
import MedicalSummaryForm from './MedicalSummaryForm'

export const metadata: Metadata = {
  title: 'Free Medical Summary Demo — структурированный AI-ассессмент спортивных кейсов · ProForm',
  description:
    'Бесплатный AI-инструмент для спортивных врачей и физиотерапевтов. Введите athlete case data — получите структурированный assessment template (triage, red flags, differential, next steps). НЕ диагноз, draft для clinical review.',
  openGraph: {
    title: 'Free Medical Summary Demo — ProForm',
    description: 'AI-структурированный assessment template для sport medicine. Без регистрации, ~5 минут.',
  },
}

export default function MedicalSummaryPage() {
  return <MedicalSummaryForm />
}
