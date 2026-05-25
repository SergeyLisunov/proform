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

export default function StickyNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-500 shadow-md shadow-orange-500/20">
            <i className="ki-filled ki-abstract-26 text-sm text-white" />
          </div>
          <div className="hidden sm:block">
            <div className="pf-num text-xl text-foreground">ProForm</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground -mt-0.5">
              Спортивная платформа
            </div>
          </div>
        </Link>

        {/* CTAs */}
        <div className="flex items-center gap-2">
          <Link
            href="/auth/login"
            className="inline-flex items-center rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground no-underline transition-colors hover:text-foreground"
          >
            Войти
          </Link>
          <Link
            href="/auth/register"
            className="inline-flex items-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-orange-600"
          >
            Создать аккаунт
          </Link>
        </div>
      </div>
    </header>
  )
}
