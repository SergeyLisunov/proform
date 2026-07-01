// Auth layout — монтирует next-intl провайдер ТОЛЬКО для /auth/* (Этап 0).
// Смонтирован здесь, а не в root layout, намеренно: тогда i18n не делает
// статичный лендинг динамическим — переводы затрагивают пока только auth.
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
