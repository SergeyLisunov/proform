/**
 * <AthleteDiscoverCTA /> — Sprint W9 Day 47.
 *
 * Server-rendered «empty-state» banner shown on athlete dashboard
 * ONLY when the athlete has zero coach connections. Drives them
 * directly into the verified-only marketplace flow (W9 Day 46).
 *
 * The component takes a boolean — caller passes `hasNoConnections`.
 * When false, returns null (avoids polluting dashboards of
 * established athletes).
 */
import Link from 'next/link'

interface AthleteDiscoverCTAProps {
  hasNoConnections: boolean
}

export default function AthleteDiscoverCTA({ hasNoConnections }: AthleteDiscoverCTAProps) {
  if (!hasNoConnections) return null
  return (
    <section className="rounded-3xl border-2 border-dashed border-orange-200 bg-gradient-to-br from-orange-50 to-white p-5 md:p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-orange-700 mb-1">Старт</p>
          <h2 className="text-lg font-bold text-navy-500">Найдите тренера для прогресса</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl leading-relaxed">
            У вас пока нет связей с тренерами. Откройте marketplace и выберите специалиста —
            начните с подтверждённых платформой.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
          <Link
            href="/marketplace?verified=1&sort=rating_desc"
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-bold shadow-sm no-underline"
          >
            <i className="ki-filled ki-verify text-sm" />
            Verified тренеры
          </Link>
          <Link
            href="/marketplace?sort=rating_desc"
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-orange-200 bg-card hover:bg-orange-50 text-orange-700 px-4 py-2.5 text-sm font-bold no-underline"
          >
            <i className="ki-filled ki-shop text-sm" />
            Открыть marketplace
          </Link>
        </div>
      </div>
    </section>
  )
}
