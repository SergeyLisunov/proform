/**
 * <HeroSection /> — W16 Day 79 REWRITE.
 *
 * Iteration over Day 78 build. Day 78 ship was good infrastructure но copy
 * abstract («без хаоса») and missing soft conversion path. Day 79 ships:
 *
 *   - Anti-positioning H1 («не должна жить в чатах») — provocative hook
 *   - Outcome-driven sub (control / transparency / safety triad)
 *   - 3 CTAs: primary register + secondary demo + tertiary audit modal
 *   - 3 value chips below CTAs (replaces less specific trust strip)
 *   - All mobile-first padding preserved (py-16 → sm:py-20 → lg:py-28)
 *
 * Soft conversion: «Получить аудит» CTA opens <HeroAuditModal />
 * (client component) embedded inline. Lead form posts к
 * /api/leads/audit. Lead saved → admin reviews → manual email response
 * (Day 80 wires Resend auto-send).
 */
import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import TrackedCtaLink from '@/components/analytics/TrackedCtaLink'
import HeroAuditModal from './HeroAuditModal'

interface ValueChipProps {
  icon:  typeof CheckCircle2
  label: string
}

function ValueChip({ icon: Icon, label }: ValueChipProps) {
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
      <div className="mx-auto flex max-w-4xl flex-col items-center px-5 py-16 text-center sm:px-8 sm:py-22 lg:px-10 lg:py-28">
        {/* Eyebrow chip — shorter copy fits one line на narrow mobile (375px) */}
        <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-2xs font-bold uppercase tracking-[0.22em] text-orange-700">
          <Building2 aria-hidden="true" size={13} />
          Спортивная платформа для клубов
        </span>

        {/* H1 — short punchy copy wraps к 2 lines max на mobile (was 4 lines) */}
        <h1 className="pf-num mt-7 text-balance text-[clamp(2rem,7vw,4.25rem)] font-bold leading-[1.04] tracking-tight text-navy-500 sm:mt-8">
          Управляйте клубом,
          <br className="sm:hidden" />{' '}
          <span className="text-orange-500">а не чатами.</span>
        </h1>

        {/* Subhead — outcome triad: control / transparency / safety */}
        <p className="mt-6 max-w-xl text-base leading-[1.65] text-muted-foreground sm:mt-7 sm:max-w-2xl sm:text-lg lg:text-xl">
          Тренеры, врачи и атлеты — в одной системе.
          Руководитель видит всё. Каждый видит то, что положено.
          Медданные защищены по&nbsp;152-ФЗ.
        </p>

        {/* CTAs — primary register + secondary demo. min-h-11 = 44px touch target */}
        <div className="mt-9 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
          <TrackedCtaLink
            href="/auth/register"
            event={{ name: 'landing.hero_cta_primary_click' }}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-orange-500 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition-all hover:bg-orange-600 hover:shadow-xl active:scale-[0.98] sm:text-lg no-underline"
          >
            Подключить клуб бесплатно
            <ArrowRight size={20} aria-hidden="true" />
          </TrackedCtaLink>
          <Link
            href="/auth/login?demo=coach"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border-2 border-orange-200 bg-white px-8 py-3.5 text-base font-bold text-orange-700 transition-all hover:border-orange-300 hover:bg-orange-50 active:scale-[0.98] sm:text-lg no-underline"
          >
            Посмотреть демо
          </Link>
        </div>

        {/* Sub-CTA hint — login для returning users */}
        <p className="mt-4 text-sm text-muted-foreground">
          Без банковской карты ·{' '}
          <Link href="/auth/login" className="font-semibold text-orange-600 hover:underline">
            войти в существующий аккаунт
          </Link>
        </p>

        {/* Audit modal trigger — soft conversion для не-готовых register */}
        <div className="mt-10 w-full max-w-lg rounded-3xl border-2 border-dashed border-orange-200 bg-white/60 px-5 py-5 sm:max-w-none sm:px-7 sm:py-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5 sm:text-left">
            <div
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600"
            >
              <Sparkles size={22} strokeWidth={2} />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm font-bold text-foreground">
                Не готовы регистрироваться?
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Получите 5-минутный аудит вашего клуба — пришлём health-score,
                top-3 риска и план на 30 дней на email.
              </p>
            </div>
            <HeroAuditModal
              buttonLabel="Получить аудит"
              buttonClassName="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-2xl bg-orange-100 px-5 py-3 text-sm font-bold text-orange-700 transition-colors hover:bg-orange-200"
            />
          </div>
        </div>

        {/* Value chips — single horizontal row, shorter copy fits на mobile */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <ValueChip icon={CheckCircle2} label="Контроль" />
          <ValueChip icon={CheckCircle2} label="Прозрачность" />
          <ValueChip icon={ShieldCheck} label="152-ФЗ · RLS" />
        </div>
      </div>
    </section>
  )
}
