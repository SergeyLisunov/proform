'use client'

/**
 * LanguageToggle — переключатель локали RU/EN (Этап 0, cookie-based).
 *
 * Пишет cookie NEXT_LOCALE и вызывает router.refresh() — серверные компоненты
 * перерисовываются под новую локаль (i18n/request.ts читает тот же cookie).
 * Требует <NextIntlClientProvider> выше по дереву (сейчас — app/auth/layout.tsx).
 */
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { LOCALES, LOCALE_COOKIE, LOCALE_LABEL, type Locale } from '@/i18n/config'

export function LanguageToggle({ className = '' }: { className?: string }) {
  const active = useLocale() as Locale
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function choose(next: Locale) {
    if (next === active || pending) return
    // 1 год, path=/, lax — читается сервером на следующем запросе
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    startTransition(() => router.refresh())
  }

  return (
    <div
      role="group"
      aria-label="Язык / Language"
      className={`inline-flex items-center rounded-full border border-border bg-background p-0.5 ${className}`}
    >
      {LOCALES.map((loc) => {
        const isActive = loc === active
        return (
          <button
            key={loc}
            type="button"
            onClick={() => choose(loc)}
            aria-pressed={isActive}
            disabled={pending}
            className={`rounded-full px-2.5 py-1 text-2xs font-bold uppercase tracking-wide transition-colors disabled:opacity-60 ${
              isActive
                ? 'bg-orange-500 text-white'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {LOCALE_LABEL[loc]}
          </button>
        )
      })}
    </div>
  )
}
