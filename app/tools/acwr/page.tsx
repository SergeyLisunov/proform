import type { Metadata } from 'next'
import AcwrCalculator from './AcwrCalculator'

export const metadata: Metadata = {
  title: 'Калькулятор ACWR — риск травмы за 30 секунд | ProForm',
  description:
    'Введи недельную нагрузку за 4 недели — получи ACWR и цветовую зону риска травмы. Научный подход, используемый в НБА, Премьер-лиге и у элитных тренеров.',
  openGraph: {
    title: 'Калькулятор риска травмы (ACWR)',
    description: 'Узнай, в какой зоне твоя нагрузка: зелёная, жёлтая или красная. Бесплатно, за 30 секунд.',
    url: 'https://proform-delta.vercel.app/tools/acwr',
    siteName: 'ProForm',
    type: 'website',
  },
  alternates: { canonical: 'https://proform-delta.vercel.app/tools/acwr' },
}

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Калькулятор ACWR — ProForm',
  description: 'Бесплатный онлайн-калькулятор риска травмы по соотношению острой и хронической нагрузки (ACWR).',
  applicationCategory: 'HealthApplication',
  operatingSystem: 'Any',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'RUB' },
}

export default function AcwrToolPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <AcwrCalculator />
    </>
  )
}
