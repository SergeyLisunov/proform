/**
 * <AthleteAdherenceCard /> — Sprint W11 Day 56.
 *
 * Server-rendered retention widget на athlete dashboard. Использует
 * существующие данные из W8 Day 40 (workout_nudges) — не требует новой
 * таблицы или service.
 *
 * Audience: athletes who have been nudged by the W8 cron (≥1 nudge in
 * last 30 days). Shows soft, supportive copy — НЕ обвиняет за пропуски,
 * а предлагает gentle на-ramp обратно.
 *
 * Hides entirely if zero recent nudges (avoids bullying low-volume или
 * новых athletes у которых ещё нет паттерна).
 *
 * Soft-framing principle: «Хотите вернуться постепенно?» вместо
 * «Вы пропустили N тренировок». Sales-side benefit — caregiver vibe
 * vs accountability-stick vibe.
 */
import Link from 'next/link'

export interface AdherenceNudgeRow {
  id:         string
  nudge_type: 'missed_workouts' | 'expiring_pass' | 'at_risk_acwr' | 'recovery_low'
  sent_at:    string
  payload:    Record<string, unknown> | null
}

interface AthleteAdherenceCardProps {
  nudges: AdherenceNudgeRow[]
}

function fmtRelativeDate(iso: string): string {
  try {
    const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000)
    if (days <= 0) return 'сегодня'
    if (days === 1) return 'вчера'
    if (days < 7)   return `${days} дн. назад`
    if (days < 14)  return 'на прошлой неделе'
    return `${Math.floor(days / 7)} нед. назад`
  } catch { return iso }
}

function getMessage(latest: AdherenceNudgeRow): { headline: string; subtitle: string } {
  if (latest.nudge_type === 'missed_workouts') {
    const missed = (latest.payload?.missed as number | undefined) ?? null
    const scheduled = (latest.payload?.scheduled as number | undefined) ?? null
    if (missed && scheduled) {
      return {
        headline: 'Вернёмся постепенно?',
        subtitle: `${missed} из ${scheduled} запланированных тренировок остались позади. Сейчас лучше выйти на лёгкую неделю и постепенно вернуться к ритму.`,
      }
    }
    return {
      headline: 'Вернёмся постепенно?',
      subtitle: 'Был пропуск нескольких тренировок. Подберём лёгкий план, чтобы вернуться без стресса.',
    }
  }
  if (latest.nudge_type === 'expiring_pass') {
    return {
      headline: 'Абонемент скоро истечёт',
      subtitle: 'Активный абонемент заканчивается на этой неделе. Свяжитесь с тренером заранее, чтобы продлить план.',
    }
  }
  if (latest.nudge_type === 'recovery_low') {
    return {
      headline: 'Восстановление просело',
      subtitle: 'HRV и сон за последние дни сигналят об усталости. Дайте телу отдохнуть — лёгкая активность вместо интенсива.',
    }
  }
  // at_risk_acwr
  return {
    headline: 'Нагрузка вышла за безопасный диапазон',
    subtitle: 'Сейчас лучше снизить интенсивность на 1-2 недели — это профилактика травм.',
  }
}

export default function AthleteAdherenceCard({ nudges }: AthleteAdherenceCardProps) {
  if (!nudges || nudges.length === 0) return null
  const latest = nudges[0]
  const { headline, subtitle } = getMessage(latest)

  return (
    <section className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 md:p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-amber-700 mb-1">Возвращение к ритму</p>
          <h2 className="text-lg font-bold text-navy-500">{headline}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-xl">
            {subtitle}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Последний сигнал: {fmtRelativeDate(latest.sent_at)}
            {nudges.length > 1 && ` · всего за 30 дней: ${nudges.length}`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
          {/* P1 — было href="/workouts": маршрута с таким именем в app/ нет,
              CTA «Открыть план» вела на 404. План атлета (prescribed workouts
              на неделю вперёд) живёт на /athlete/dashboard. */}
          <Link
            href="/athlete/dashboard"
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 text-sm font-bold shadow-sm no-underline"
          >
            <i className="ki-filled ki-abstract-26 text-sm" />
            Открыть план
          </Link>
          <Link
            href="/templates"
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-amber-200 bg-card hover:bg-amber-50 text-amber-800 px-4 py-2.5 text-sm font-bold no-underline"
          >
            <i className="ki-filled ki-feather text-sm" />
            Лёгкая неделя
          </Link>
        </div>
      </div>
    </section>
  )
}
