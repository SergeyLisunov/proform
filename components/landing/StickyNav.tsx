/**
 * <StickyNav /> — Sprint W14 Day 71.
 *
 * Top navigation bar для public landing. Logo + 2 CTA buttons. Sticky
 * (stays visible на scroll). Mobile: collapse секции links, keep auth
 * CTAs visible.
 *
 * Design: ultra-light bg-white/80 backdrop-blur для floating-over-content
 * effect — matches modern marketing landing convention.
 */
import Link from 'next/link'
import TrackedCtaLink from '@/components/analytics/TrackedCtaLink'
import { SporteoLogo } from "@/components/ui/SporteoLogo"

interface StickyNavProps {
  /** When the visitor is signed in, show a single "Открыть кабинет" CTA
   *  instead of the prospect Войти / Создать аккаунт pair. */
  isAuthed?: boolean
}

export default function StickyNav({ isAuthed = false }: StickyNavProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-white/80 backdrop-blur-lg">
      <nav
        aria-label="Главная навигация"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-10"
      >
        {/* Logo — на mobile только icon, нужен accessible name */}
        <Link
          href="/"
          aria-label="Sporteo — на главную"
          className="flex items-center gap-2.5 no-underline"
        >
          <SporteoLogo size="md" iconOnly className="sm:hidden" />
          <SporteoLogo size="md" className="hidden sm:inline-flex" />
        </Link>

        {/* CTAs — tracked via TrackedCtaLink for conversion analytics */}
        <div className="flex items-center gap-2">
          {isAuthed ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-orange-600"
            >
              Открыть кабинет
              <i className="ki-filled ki-arrow-right text-xs" />
            </Link>
          ) : (
            <>
              <TrackedCtaLink
                href="/auth/login"
                event={{ name: 'landing.sticky_login_click' }}
                className="inline-flex items-center rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground no-underline transition-colors hover:text-foreground"
              >
                Войти
              </TrackedCtaLink>
              <TrackedCtaLink
                href="/auth/register"
                event={{ name: 'landing.sticky_register_click' }}
                className="inline-flex items-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-orange-600"
              >
                Создать аккаунт
              </TrackedCtaLink>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
