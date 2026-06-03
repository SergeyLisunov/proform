import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getAthletePassport } from '@/services/athlete-public.service'
import PassportShareBar from './PassportShareBar'

export const revalidate = 300 // 5 минут

export async function generateMetadata(
  { params }: { params: Promise<{ nickname: string }> },
): Promise<Metadata> {
  const { nickname } = await params
  const p = await getAthletePassport(nickname)
  if (!p) {
    return {
      title: 'Атлет не найден — Sporteo',
      description: 'Этот профиль закрыт или не существует.',
    }
  }
  const title = `${p.display_name} · Паспорт атлета`
  const desc  = [
    p.sport ? `Спорт: ${p.sport}` : null,
    p.city  ? p.city : null,
    p.stats ? `${p.stats.total_workouts_90d} тренировок за 90 дней` : null,
  ].filter(Boolean).join(' · ') || 'Публичный профиль на Sporteo'
  const url = `https://proform-delta.vercel.app/p/${p.nickname}`
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title, description: desc, url, siteName: 'Sporteo',
      type: 'profile',
      images: p.avatar_url ? [{ url: p.avatar_url, width: 512, height: 512 }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title, description: desc,
      images: p.avatar_url ? [p.avatar_url] : undefined,
    },
  }
}

function fmtPRValue(r: {
  value: number | null; unit: string | null; metric: string | null; lower_is_better: boolean | null
}): string {
  if (r.value == null) return '—'
  if (r.metric === 'time_sec' || r.unit === 'sec' || r.unit === 'с') {
    const s = Number(r.value)
    const mm = Math.floor(s / 60)
    const ss = Math.round(s % 60)
    return `${mm}:${String(ss).padStart(2, '0')}`
  }
  return `${r.value}${r.unit ? ' ' + r.unit : ''}`
}

function fmtMinutes(m: number): string {
  if (m < 60) return `${m} мин`
  const h = Math.floor(m / 60)
  const mm = m % 60
  return mm ? `${h} ч ${mm} м` : `${h} ч`
}

export default async function AthletePassportPage(
  { params }: { params: Promise<{ nickname: string }> },
) {
  const { nickname } = await params
  const p = await getAthletePassport(nickname)
  if (!p) notFound()

  const url = `https://proform-delta.vercel.app/p/${p.nickname}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: p.display_name,
    alternateName: `@${p.nickname}`,
    description: p.bio ?? undefined,
    image: p.avatar_url ?? undefined,
    nationality: p.country ?? undefined,
    address: p.city ? { '@type': 'PostalAddress', addressLocality: p.city, addressCountry: p.country ?? undefined } : undefined,
    url,
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={p.background_url
          ? { backgroundImage: `linear-gradient(rgba(15,23,42,0.4), rgba(15,23,42,0.8)), url(${p.background_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: 'linear-gradient(135deg, #F35703 0%, #D44A02 60%, #9A3412 100%)' }}>
        <div className="mx-auto max-w-5xl px-5 py-12 md:py-16 text-white">
          <div className="flex items-start gap-5 flex-wrap">
            <div className="shrink-0">
              {p.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={p.avatar_url} alt={p.display_name}
                  className="w-24 h-24 md:w-32 md:h-32 rounded-2xl object-cover border-4 border-white/20 shadow-xl" />
              ) : (
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-white/20 text-white flex items-center justify-center text-4xl font-bold border-4 border-white/20">
                  {p.display_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] bg-white/15 backdrop-blur rounded-full px-2.5 py-1">
                  Паспорт атлета
                </span>
                {p.sport && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-500 rounded-full px-2.5 py-1">
                    {p.sport}
                  </span>
                )}
              </div>
              <h1 className="text-3xl md:text-5xl font-bold leading-tight mt-3">{p.display_name}</h1>
              <div className="mt-1 text-sm md:text-base opacity-90">
                @{p.nickname}
                {p.city ? ` · ${p.city}` : ''}
                {p.country ? `, ${p.country}` : ''}
                {p.club ? ` · ${p.club}` : ''}
              </div>
              {p.bio && (
                <p className="mt-4 text-sm md:text-base opacity-90 max-w-2xl leading-relaxed">{p.bio}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Share bar */}
      <PassportShareBar url={url} displayName={p.display_name} />

      {/* Stats */}
      {p.stats && (
        <section className="mx-auto max-w-5xl px-5 py-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500 mb-3">
            За последние 90 дней
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatTile label="Тренировок" value={String(p.stats.total_workouts_90d)} accent="#F35703" />
            <StatTile label="Всего времени" value={fmtMinutes(p.stats.total_minutes_90d)} accent="#2563EB" />
            <StatTile label="Текущая серия" value={`${p.stats.current_streak_days} дн`} accent="#16A34A" />
            <StatTile label="Ср. восстановление"
              value={p.stats.avg_recovery_30d != null ? `${p.stats.avg_recovery_30d}%` : '—'}
              accent="#7C3AED" />
          </div>
        </section>
      )}

      {/* Personal records */}
      {p.personal_records.length > 0 && (
        <section className="mx-auto max-w-5xl px-5 pb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500 mb-3">
            🏆 Личные рекорды
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {p.personal_records.map(r => (
              <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
                    {r.category ?? 'PR'}
                  </span>
                </div>
                <div className="text-lg font-bold text-slate-900">{r.exercise ?? r.metric ?? '—'}</div>
                <div className="pf-num text-2xl font-bold text-orange-600 mt-1">{fmtPRValue(r)}</div>
                {r.achieved_at && (
                  <div className="text-[11px] text-slate-500 mt-1">
                    {new Date(r.achieved_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent workouts */}
      {p.workouts_public && p.recent_workouts.length > 0 && (
        <section className="mx-auto max-w-5xl px-5 pb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500 mb-3">
            Последние тренировки
          </p>
          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {p.recent_workouts.map(w => (
              <div key={w.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">
                  {new Date(w.event_date + 'T00:00:00').toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {w.name ?? w.activity_type ?? 'Тренировка'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {w.duration_min ? `${w.duration_min} мин` : ''}
                    {w.duration_min && w.strain ? ' · ' : ''}
                    {w.strain ? `strain ${w.strain}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Social links */}
      {(p.social.instagram || p.social.telegram || p.social.youtube || p.social.tiktok || p.social.website) && (
        <section className="mx-auto max-w-5xl px-5 pb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500 mb-3">
            Найти в сети
          </p>
          <div className="flex flex-wrap gap-2">
            {p.social.instagram && <SocialChip label="Instagram" host={p.social.instagram} />}
            {p.social.telegram  && <SocialChip label="Telegram"  host={p.social.telegram} />}
            {p.social.youtube   && <SocialChip label="YouTube"   host={p.social.youtube} />}
            {p.social.tiktok    && <SocialChip label="TikTok"    host={p.social.tiktok} />}
            {p.social.website   && <SocialChip label="Сайт"      host={p.social.website} />}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-5 pb-14">
        <div className="rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 md:p-8">
          <h3 className="text-xl md:text-2xl font-bold">Создай свой «Паспорт атлета»</h3>
          <p className="mt-1 text-sm md:text-base opacity-90 max-w-2xl">
            Шарабельная ссылка, публичные PR&apos;ы, статистика за 90 дней, подключение
            тренера и врача. Бесплатно, без wearables тоже работает.
          </p>
          <Link href="/auth/register?utm_source=passport&utm_medium=public&utm_campaign=cta"
            className="mt-4 inline-block rounded-xl bg-white text-orange-600 px-5 py-2.5 text-sm font-bold hover:bg-orange-50">
            Начать бесплатно →
          </Link>
        </div>
      </section>
    </>
  )
}

function StatTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="pf-num text-2xl font-bold mt-1" style={{ color: accent }}>{value}</div>
    </div>
  )
}

function SocialChip({ label, host }: { label: string; host: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
      <strong className="text-slate-900">{label}</strong>
      <span className="text-slate-400">·</span>
      {host}
    </span>
  )
}
