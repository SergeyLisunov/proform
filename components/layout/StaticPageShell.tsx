/**
 * <StaticPageShell /> — W15 Day 75.
 *
 * Wrapper for static prospect-facing pages (About, Contacts, Privacy).
 * Consolidates: skip-link + back-to-home + brand mark + article container
 * + site footer. Each new static page = one component file, не wrapping
 * 100-line layout boilerplate каждый раз.
 *
 * `/legal/terms` deliberately NOT refactored к этому shell в Day 75 —
 * existing custom warning-banner styling выходит за shell boundaries.
 * Refactor candidate для W16+.
 *
 * Layout:
 *   1. SkipToContent (sr-only, focus pill)
 *   2. Top bar — back-to-home button + ProForm mini-logo
 *   3. Article — max-w-3xl card с consistent typography
 *   4. SiteFooter — shared с landing
 */
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import SkipToContent from './SkipToContent'
import SiteFooter from './SiteFooter'

interface StaticPageShellProps {
  /** Small uppercase eyebrow above title. Example: "О платформе". */
  eyebrow?: string
  /** Main page heading. Sets the single `<h1>`. */
  title: string
  /** Human-friendly version line. Example: "Версия от мая 2026 г." */
  lastUpdated?: string
  /** Article body. Use semantic headings (h2/h3) для section structure. */
  children: React.ReactNode
}

export default function StaticPageShell({
  eyebrow,
  title,
  lastUpdated,
  children,
}: StaticPageShellProps) {
  return (
    <>
      <SkipToContent />
      <main
        id="main-content"
        className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.10),_transparent_36%),linear-gradient(180deg,#FFFFFF_0%,#FFF7ED_100%)]"
      >
        {/* Top bar — back + mini-logo */}
        <header className="border-b border-orange-100/60 bg-white/70 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground no-underline transition-colors hover:text-foreground"
            >
              <ArrowLeft size={15} />
              На главную
            </Link>
            <Link
              href="/"
              aria-label="ProForm — на главную"
              className="flex items-center gap-2 no-underline"
            >
              <div
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500 shadow-sm"
              >
                <i className="ki-filled ki-abstract-26 text-xs text-white" />
              </div>
              <span className="pf-num text-base text-foreground">ProForm</span>
            </Link>
          </div>
        </header>

        {/* Article */}
        <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
          <article className="rounded-3xl border border-border bg-white p-6 shadow-sm md:p-10">
            {eyebrow && (
              <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700">
                {eyebrow}
              </p>
            )}
            <h1 className="pf-num mt-3 text-3xl leading-tight text-foreground md:text-4xl">
              {title}
            </h1>
            {lastUpdated && (
              <p className="mt-2 text-xs text-muted-foreground">{lastUpdated}</p>
            )}

            <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
              {children}
            </div>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
