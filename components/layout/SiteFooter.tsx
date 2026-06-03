/**
 * <SiteFooter /> — W15 Day 75.
 *
 * Reusable site footer extracted from `app/page.tsx`. Used by landing
 * (`/`) и static pages (`/about`, `/contacts`, `/legal/*`).
 *
 * Single source of truth для footer link list — добавляешь link здесь
 * один раз, появляется везде. Pattern parallels `<TopBar />` для auth'd
 * surfaces.
 *
 * Visual: dark navy background, slate-400 text, brand wordmark left,
 * link cluster right. Mobile: stack vertical.
 */
import Link from 'next/link'
import { SporteoLogo } from "@/components/ui/SporteoLogo"

interface FooterLink {
  href:  string
  label: string
  /** External mailto / external = вернёт `<a>` instead of next/link */
  external?: boolean
}

const PRIMARY_LINKS: FooterLink[] = [
  { href: '/about',          label: 'О платформе' },
  { href: '/contacts',       label: 'Контакты' },
  { href: '/auth/login',     label: 'Войти' },
  { href: '/auth/register',  label: 'Создать аккаунт' },
]

const LEGAL_LINKS: FooterLink[] = [
  { href: '/legal/terms',    label: 'Условия' },
  { href: '/legal/privacy',  label: 'Конфиденциальность' },
  {
    href: 'mailto:support@proform-delta.vercel.app',
    label: 'support@proform-delta.vercel.app',
    external: true,
  },
]

function renderLink({ href, label, external }: FooterLink) {
  const cls = 'text-slate-400 no-underline hover:text-white'
  if (external) {
    return (
      <a key={label} href={href} className={cls}>
        {label}
      </a>
    )
  }
  return (
    <Link key={label} href={href} className={cls}>
      {label}
    </Link>
  )
}

export default function SiteFooter() {
  return (
    <footer className="border-t border-border bg-slate-900 px-4 py-10 text-slate-400 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <SporteoLogo size="md" onDark />
          <div className="mt-1 text-xs">
            Спортивная платформа для клубов, академий и команд
          </div>
        </div>

        {/* Two-column link cluster: primary + legal */}
        <div className="flex flex-col gap-3 text-xs sm:items-end">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {PRIMARY_LINKS.map(renderLink)}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-slate-500">
            {LEGAL_LINKS.map(renderLink)}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-7xl border-t border-white/10 pt-4 text-2xs text-slate-500">
        © {new Date().getFullYear()} Sporteo · Хостинг данных в Supabase
        EU-Central · RLS-политики на каждой таблице
      </div>
    </footer>
  )
}
