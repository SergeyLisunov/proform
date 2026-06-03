import type { Metadata } from 'next'
import OvertrainingQuiz from './OvertrainingQuiz'

export const metadata: Metadata = {
  title: 'Тест на перетренированность — 10 вопросов | Sporteo',
  description:
    'Бесплатный научный тест на признаки перетренированности. 10 вопросов, результат с рекомендациями за 2 минуты. Чек-лист на основе критериев Overtraining Syndrome.',
  openGraph: {
    title: 'Тест на перетренированность — 10 вопросов',
    description: 'Узнайте за 2 минуты, не перегружаете ли вы себя тренировками. Бесплатно.',
    url: 'https://proform-delta.vercel.app/tools/overtraining',
    siteName: 'Sporteo',
    type: 'website',
  },
  alternates: { canonical: 'https://proform-delta.vercel.app/tools/overtraining' },
}

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Quiz',
  name: 'Тест на перетренированность (Sporteo)',
  about: 'Overtraining Syndrome self-assessment',
  educationalUse: 'Self-assessment',
}

export default function OvertrainingToolPage() {
  return (
    <>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <OvertrainingQuiz />
    </>
  )
}
