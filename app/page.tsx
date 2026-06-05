/**
 * / — Public marketing landing. Sprint W14 Day 71.
 *
 * Always reachable — for everyone, signed in or not. Signed-in visitors are
 * NOT bounced to /dashboard (that previously made the landing impossible to
 * reach while logged in); the nav instead shows an "Открыть кабинет" CTA so
 * they can browse the marketing page and jump back into the app at will.
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
import { createClient } from '@/lib/supabase/server'
import SkipToContent from '@/components/layout/SkipToContent'
import SiteFooter from '@/components/layout/SiteFooter'
import StickyNav from '@/components/landing/StickyNav'
import HeroSection from '@/components/landing/HeroSection'
import PainSection from '@/components/landing/PainSection'
import AntiPositioningSection from '@/components/landing/AntiPositioningSection'
import LeadMagnetSection from '@/components/landing/LeadMagnetSection'
import RoleSection from '@/components/landing/RoleSection'
import WorkflowSection from '@/components/landing/WorkflowSection'
import BeforeAfterSection from '@/components/landing/BeforeAfterSection'
import SocialProofSection from '@/components/landing/SocialProofSection'
import BenefitsSection from '@/components/landing/BenefitsSection'
import UseCasesSection from '@/components/landing/UseCasesSection'
import WearablesSection from '@/components/landing/WearablesSection'
import PricingTeaserSection from '@/components/landing/PricingTeaserSection'
import SecuritySection from '@/components/landing/SecuritySection'
import FaqSection from '@/components/landing/FaqSection'
import FinalCtaSection from '@/components/landing/FinalCtaSection'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <>
      <SkipToContent />
      <StickyNav isAuthed={!!user} />
      <main id="main-content" className="min-h-screen w-full bg-white">
        {/* W16 Day 79 — funnel re-sequence:
            Hero → Pain → AntiPositioning → Workflow → Roles → LeadMagnets
            → Benefits → UseCases → Wearables → Security → FAQ → FinalCTA.
            Pain + AntiPositioning surfaced early — bridge от Hero hook
            к solution explanation. LeadMagnets moved AFTER role + workflow
            context — visitor понимает product до пробовать AI tools. */}
        <HeroSection />
        <PainSection />
        <AntiPositioningSection />
        <WorkflowSection />
        <RoleSection />
        <BeforeAfterSection />
        <LeadMagnetSection />
        <SocialProofSection />
        <BenefitsSection />
        <UseCasesSection />
        <WearablesSection />
        <PricingTeaserSection />
        <SecuritySection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <SiteFooter />
    </>
  )
}
