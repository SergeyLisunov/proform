/**
 * <HeroSection /> — W16 Day 78 REBUILD.
 *
 * Previous version (W14 Day 71 + W15 Day 77) был variant-aware grid с
 * right-col mockup composition. Feedback: «всё криво» — dark blocks
 * right of Hero, CTAs не видны, cramped на mobile, variant B copy не
 * sells. Rebuilt к single-voice centered hero, massive contrast CTAs,
 * trust-strip с 3 micro-facts, no decorative mockup.
 *
 * A/B harness retired (W15 Day 77 work — variant cookie middleware
 * removed, variants.ts deleted, single H1 ships). When second test
 * нужен — wire через `app/admin/landing-ab` (calculator kept).
 *
 * Layout principles:
 *   - Single column, centered, max-w-4xl — no left/right asymmetry
 *   - Mobile-first padding: py-16 → sm:py-20 → lg:py-28
 *   - H1 scales с clamp() для smooth viewport adaptation
 *   - 2 CTAs: primary register + secondary anchor к /#tools (LeadMagnetSection)
 *   - Trust-strip chips: 3 micro-facts (5 ролей / 10-min onboarding / 152-ФЗ)
 *   - Zero overlapping absolute elements
 */
import { ArrowRight, Building2, Clock, ShieldCheck, Users } from 'lucide-react'
import TrackedCtaLink from '@/components/analytics/TrackedCtaLink'

interface TrustChipProps {
  icon:  typeof Users
  label: string
}

function TrustChip({ icon: Icon, label }: TrustChipProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-4 py-2 text-sm font-semibold text-foreground shadow-sm">
      <Icon
        aria-hidden="true"
        size={15}
        strokeWidth={2.2}
        className="text-orange-600"
      />
      {label}
    </div>
  )
}

export default function HeroSection() {
  return (
    <section
      className="relative w-full overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.12),_transparent_55%),linear-gradient(180deg,_#FFFFFF_0%,_#FFF7ED_100%)]"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-10 lg:py-28">
        {/* Eyebrow chip */}
        <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3.5 py-1.5 text-2xs font-bold uppercase tracking-[0.22em] text-orange-700">
          <Building2 aria-hidden="true" size={13} />
          Спортивная платформа для клубов и команд
        </span>

        {/* H1 — value prop в одной фразе */}
        <h1 className="pf-num mt-6 text-[clamp(2.2rem,6vw,4.5rem)] font-bold leading-[1.02] tracking-tight text-foreground">
          Тренировочный процесс клуба
          <br />
          <span className="text-orange-500">без хаоса</span> в чатах и таблицах
        </h1>

        {/* Subhead — для кого + что получают */}
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:text-xl">
          Тренер, спортсмен, врач, организация и родитель — в одной системе.
          Прогресс виден всем, кому положено — и только им. Подключение клуба
          за 10 минут.
        </p>

        {/* CTAs — large, high-contrast, full-width на mobile */}
        <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
          <TrackedCtaLink
            href="/auth/register"
            event={{ name: 'landing.hero_cta_primary_click' }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-7 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition-all hover:bg-orange-600 hover:shadow-xl sm:text-lg no-underline"
          >
            Создать клуб бесплатно
            <ArrowRight size={20} />
          </TrackedCtaLink>
          <a
            href="#tools"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-orange-200 bg-white px-7 py-4 text-base font-bold text-orange-700 transition-all hover:border-orange-300 hover:bg-orange-50 sm:text-lg no-underline"
          >
            Попробовать AI-инструменты
          </a>
        </div>

        {/* Sub-CTA hint */}
        <p className="mt-4 text-sm text-muted-foreground">
          Без банковской карты · Бесплатно во время закрытой беты ·{' '}
          <a
            href="/auth/login?demo=coach"
            className="font-semibold text-orange-600 hover:underline"
          >
            войти в demo
          </a>{' '}
          одной из 5 ролей
        </p>

        {/* Trust strip — 3 micro-facts */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <TrustChip icon={Users} label="5 ролей в одной системе" />
          <TrustChip icon={Clock} label="Подключение за 10 минут" />
          <TrustChip icon={ShieldCheck} label="152-ФЗ · RLS · EU-Central хостинг" />
        </div>
      </div>
    </section>
  )
}
