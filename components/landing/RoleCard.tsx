/**
 * <RoleCard /> — Sprint W14 Day 69.
 *
 * Single role explanation card. Used 5x в <RoleSection /> для athlete /
 * coach / organization / doctor / parent. Each card emphasizes:
 *   - role icon + name
 *   - one-line value proposition (что role «получает»)
 *   - 3 bullet features
 *   - one-click demo link (preserves existing demo-account flow)
 *
 * Visual: white card, subtle role-tinted top border, hover lift.
 */
import Link from 'next/link'
import { ArrowRight, Building2, Heart, Stethoscope, Target, User } from 'lucide-react'

export type Role = 'athlete' | 'coach' | 'organization' | 'doctor' | 'parent'

interface RoleCardProps {
  role:        Role
  title:       string
  tagline:     string
  features:    string[]
  /** Email of demo account, OR null if no demo (e.g. parent demo deferred) */
  demoEmail:   string | null
  /** Tailwind/HEX role colors */
  accent:      string
  accentBg:    string
  accentBorder: string
}

const ROLE_ICONS: Record<Role, typeof User> = {
  athlete:      User,
  coach:        Target,
  organization: Building2,
  doctor:       Stethoscope,
  parent:       Heart,
}

export default function RoleCard({
  role, title, tagline, features, demoEmail,
  accent, accentBg, accentBorder,
}: RoleCardProps) {
  const Icon = ROLE_ICONS[role]
  const demoHref = demoEmail
    ? `/auth/login?demo=${role}`
    : null

  return (
    <article
      className="group flex flex-col rounded-3xl border bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: accentBorder, borderTopWidth: 3 }}
    >
      {/* Icon + role name */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: accentBg, color: accent }}
        >
          <Icon size={20} strokeWidth={2} />
        </div>
        <h3 className="text-lg font-bold tracking-tight text-navy-500">{title}</h3>
      </div>

      {/* Tagline */}
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{tagline}</p>

      {/* Features */}
      <ul className="mt-5 space-y-2 flex-1">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
            <span
              className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: accent }}
              aria-hidden
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* Demo CTA */}
      {demoHref && (
        <Link
          href={demoHref}
          className="mt-6 inline-flex items-center justify-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-sm font-semibold no-underline transition-all group-hover:shadow-sm"
          style={{ color: accent, borderColor: accentBorder }}
        >
          Открыть demo
          <ArrowRight size={14} />
        </Link>
      )}
      {!demoHref && (
        <div className="mt-6 inline-flex items-center justify-center rounded-xl border border-dashed border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          Demo появится в beta-доступе
        </div>
      )}
    </article>
  )
}
