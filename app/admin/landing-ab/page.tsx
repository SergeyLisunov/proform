/**
 * /admin/landing-ab — W15 Day 77; updated W16 Day 78.
 *
 * Admin dashboard для landing A/B tests. Calculator widget + methodology
 * + Vercel Analytics paste workflow.
 *
 * W16 Day 78: первый test (W15 Day 77 hero copy A/B) retired — variant B
 * не sold, landing rebuilt к single voice. Page преобразован к generic
 * A/B harness reference: methodology + calculator stay, variant-specific
 * display retired. When next test wires — re-add variant config display.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Calculator from './Calculator'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Landing A/B',
}

export default async function LandingAbPage() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login?redirectTo=/admin/landing-ab')

  const { data: meRow } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', authUser.id)
    .maybeSingle()
  const me = meRow as { role: string | null } | null
  if (!me || me.role !== 'admin') redirect('/dashboard')

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pf-enter">
      {/* Top nav */}
      <div className="mb-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-semibold text-muted-foreground no-underline transition hover:text-foreground"
        >
          <i className="ki-filled ki-arrow-left text-sm" />
          Admin
        </Link>
      </div>

      {/* Header */}
      <header className="mb-8">
        <p className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
          Landing analytics · A/B harness
        </p>
        <h1 className="pf-num mt-2 text-3xl text-foreground md:text-4xl">
          Hero copy A/B
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Generic harness для landing A/B tests. Calculator + Z-test verdict +
          methodology + Vercel Analytics paste workflow. Когда новый тест
          запущен — re-wire variant assignment в middleware и добавь variant
          display сюда.
        </p>
      </header>

      {/* Test status banner */}
      <section className="mb-8 rounded-3xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-amber-800">
          Текущий статус: тест приостановлен
        </h2>
        <p className="mt-2 text-sm text-amber-900/90">
          W15 Day 77 hero copy A/B (variant A persona-driven vs B
          tool-replacement) — retired W16 Day 78 на основе UX feedback.
          Landing rebuilt к single voice. Calculator widget + методология
          сохранены — used для будущих tests.
        </p>
      </section>

      {/* Methodology */}
      <section className="mb-8 rounded-3xl border border-border bg-card p-6">
        <h2 className="text-xl font-bold text-foreground">Методология</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Аудитория:</strong> все visitors
            на `/` (anonymized).
          </li>
          <li>
            <strong className="text-foreground">Сплит:</strong> 50/50, random per
            cookie ID. Persistence — 30 дней.
          </li>
          <li>
            <strong className="text-foreground">Метрика:</strong> CTR =
            conversions / visitors. Primary conversion event =
            `landing.hero_cta_primary_click`. Demo CTA tracked отдельно как
            secondary.
          </li>
          <li>
            <strong className="text-foreground">Sample size:</strong> минимум 100
            visitors на каждом варианте до первого review. Идеально — 300+.
          </li>
          <li>
            <strong className="text-foreground">Test:</strong> two-proportion
            pooled Z-test, 95% confidence. Подробнее —{' '}
            <Link
              href="/admin/ab-tests"
              className="text-orange-600 hover:underline"
            >
              /admin/ab-tests
            </Link>{' '}
            (drip-email A/B, same math).
          </li>
          <li>
            <strong className="text-foreground">Decision rule:</strong> p {'<'}{' '}
            0.05 + winner CTR difference {'≥'} 1 percentage point →
            promote winner, retire loser. Иначе → continue collecting OR archive
            inconclusive.
          </li>
        </ul>
      </section>

      {/* Calculator widget */}
      <Calculator />

      {/* Vercel link */}
      <section className="mt-8 rounded-3xl border border-border bg-orange-50/50 p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-orange-700">
          Откуда брать данные
        </h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            Открой{' '}
            <a
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="text-orange-600 hover:underline"
            >
              Vercel Dashboard → ProForm → Analytics
            </a>
          </li>
          <li>
            Tab <strong className="text-foreground">Custom Events</strong> → найди
            `landing.hero_cta_primary_click`
          </li>
          <li>
            Filter по property <code>variant</code> = A или B → выпиши count
          </li>
          <li>
            Для visitors per variant — пока (Hobby plan) approximate как (50% от
            unique `/` visits). Когда Pro plan активен → variant tag будет на
            каждом page view event.
          </li>
        </ol>
      </section>
    </div>
  )
}
