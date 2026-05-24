/**
 * /landing-preview — Sprint W14 Day 69.
 *
 * Temporary preview route для рендеринга landing sections по мере их
 * создания. На Day 71 эти секции переедут в полноценный public `/`
 * landing, а этот файл будет удалён.
 *
 * Зачем preview маршрут: позволяет maintainer'у видеть immediate
 * visual feedback после каждого Day, не дожидаясь финальной сборки.
 *
 * Why not directly в /: текущий `/` either redirects authenticated
 * users в /dashboard либо рендерит другую логику. Заменять его
 * до полной готовности всех секций — преждевременно.
 *
 * Public access (no auth gate) — design preview surface.
 */
import Link from 'next/link'
import RoleSection from '@/components/landing/RoleSection'
import SecuritySection from '@/components/landing/SecuritySection'

export const dynamic = 'force-dynamic'

export default function LandingPreviewPage() {
  return (
    <div className="min-h-screen w-full">
      {/* Preview header */}
      <div className="border-b border-orange-200 bg-orange-50 px-4 py-3 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-orange-500 px-2.5 py-1 text-2xs font-bold uppercase tracking-wider text-white">
              Preview
            </span>
            <span className="text-sm font-semibold text-orange-900">
              Landing components — W14 Day 69
            </span>
          </div>
          <div className="flex gap-2 text-2xs">
            <Link
              href="/auth/login"
              className="rounded-full border border-orange-300 bg-white px-3 py-1 font-semibold text-orange-700 no-underline hover:bg-orange-100"
            >
              К текущей странице входа →
            </Link>
          </div>
        </div>
        <p className="mx-auto mt-2 max-w-7xl text-2xs text-orange-800">
          Это превью новых секций public landing. На Day 71 они переедут в полноценный
          публичный <code>/</code> + временный <code>/landing-preview</code> удалится.
        </p>
      </div>

      {/* Section: Roles */}
      <RoleSection />

      {/* Section: Security */}
      <SecuritySection />

      {/* Day 70 / 71 placeholders */}
      <section className="w-full bg-white py-20 px-4 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
            Дальше в roadmap
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            Здесь появятся Workflow, Benefits, Wearables, Use cases, FAQ
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            W14 Day 70 — workflow + benefits + wearables blocks ·
            W14 Day 71 — use cases + FAQ + final CTA + сборка в публичный <code>/</code>
          </p>
        </div>
      </section>
    </div>
  )
}
