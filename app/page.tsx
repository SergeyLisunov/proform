/**
 * / — Public marketing landing. Sprint W14 Day 71.
 *
 * Authenticated users → /dashboard. Unauthenticated → full landing.
 * Replaces previous 15-line redirect-only behaviour AND retires the
 * /landing-preview scratch route (now deleted).
 *
 * Section order (rationale documented inline в landing-preview за W14
 * Day 70):
 *   1. Hero      — что это / для кого / 2 CTA
 *   2. Roles     — кто целевая аудитория
 *   3. Workflow  — как они работают вместе
 *   4. Benefits  — что получает prospect
 *   5. UseCases  — для кого это работает прямо сейчас
 *   6. Wearables — что подключается (без vendor lock-in)
 *   7. Security  — почему это можно доверить
 *   8. FAQ       — закрыть остающиеся вопросы
 *   9. FinalCTA  — последний conversion push
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StickyNav from '@/components/landing/StickyNav'
import HeroSection from '@/components/landing/HeroSection'
import RoleSection from '@/components/landing/RoleSection'
import WorkflowSection from '@/components/landing/WorkflowSection'
import BenefitsSection from '@/components/landing/BenefitsSection'
import UseCasesSection from '@/components/landing/UseCasesSection'
import WearablesSection from '@/components/landing/WearablesSection'
import SecuritySection from '@/components/landing/SecuritySection'
import FaqSection from '@/components/landing/FaqSection'
import FinalCtaSection from '@/components/landing/FinalCtaSection'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen w-full bg-white">
      <StickyNav />
      <HeroSection />
      <RoleSection />
      <WorkflowSection />
      <BenefitsSection />
      <UseCasesSection />
      <WearablesSection />
      <SecuritySection />
      <FaqSection />
      <FinalCtaSection />

      {/* Footer */}
      <footer className="border-t border-border bg-slate-900 px-4 py-10 text-slate-400 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="pf-num text-xl text-white">ProForm</div>
            <div className="mt-1 text-xs">Спортивная платформа для клубов, академий и команд</div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
            <a href="/auth/login" className="text-slate-400 no-underline hover:text-white">Войти</a>
            <a href="/auth/register" className="text-slate-400 no-underline hover:text-white">Создать аккаунт</a>
            <a href="/legal/terms" className="text-slate-400 no-underline hover:text-white">Условия</a>
            <a href="mailto:support@proform-delta.vercel.app" className="text-slate-400 no-underline hover:text-white">support@proform-delta.vercel.app</a>
          </div>
        </div>
        <div className="mx-auto mt-6 max-w-7xl border-t border-white/10 pt-4 text-2xs text-slate-500">
          © {new Date().getFullYear()} ProForm · Хостинг данных в Supabase EU-Central · RLS-политики на каждой таблице
        </div>
      </footer>
    </main>
  )
}
