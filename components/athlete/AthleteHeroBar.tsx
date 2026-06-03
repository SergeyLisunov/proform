'use client'

import { RecoveryRing } from '@/components/ui/RecoveryRing'
import { Card } from '@/components/ui/metronic'
import { strainColor, strainLabel } from '@/lib/utils/recovery'

interface HeroMetrics {
  recovery_score: number | null
  hrv: number | null
  resting_heart_rate: number | null
  day_strain: number | null
  sleep_hours: number | null
}

interface AthleteHeroBarProps {
  firstName: string
  metrics: HeroMetrics | null
}

function pickGreeting(hours: number): string {
  if (hours < 6)  return 'Доброй ночи'
  if (hours < 12) return 'Доброе утро'
  if (hours < 18) return 'Добрый день'
  return 'Добрый вечер'
}

function recoveryEmoji(score: number): string {
  if (score >= 67) return '🟢'
  if (score >= 34) return '🟡'
  return '🔴'
}

function recoveryAdvice(score: number): string {
  if (score >= 67) return 'Можно качественную тренировку'
  if (score >= 34) return 'Лёгкая или средняя нагрузка'
  return 'Восстановительный день'
}

/**
 * Главный hero-бар атлета: персонализированное приветствие, кольцо
 * восстановления и ключевые метрики на одной полосе. Если метрик нет —
 * показывает onboarding-CTA с подсказкой подключить устройство.
 */
export default function AthleteHeroBar({ firstName, metrics }: AthleteHeroBarProps) {
  const hour = new Date().getHours()
  const greeting = pickGreeting(hour)
  const today = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const recovery = metrics?.recovery_score ?? null
  const hasData = metrics && (recovery != null || metrics.hrv != null || metrics.day_strain != null)

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#FBC1A0] bg-gradient-to-br from-[#FEF0E7] via-white to-[#EFF6FF] p-5 md:p-7">
      <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-orange-200/40 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-5 lg:gap-8">
        {/* Greeting */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-600 mb-1">
            {today}
          </p>
          <h1 className="pf-num text-3xl md:text-4xl text-navy-500 leading-tight">
            {greeting}, <span className="text-orange-600">{firstName}</span>!
          </h1>
          {hasData && recovery != null ? (
            <p className="mt-2 text-sm md:text-base text-muted-foreground">
              {recoveryEmoji(recovery)} {recoveryAdvice(recovery)} — восстановление <strong className="text-foreground">{Math.round(recovery)}%</strong>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Подключите носимое устройство в настройках — восстановление, HRV и нагрузка будут считаться сами.
            </p>
          )}
        </div>

        {/* Metrics card */}
        {hasData && metrics ? (
          <Card className="w-full lg:w-auto px-5 py-4 flex items-center gap-5">
            {recovery != null && <RecoveryRing score={Math.round(recovery)} size={88} />}
            <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-sm flex-1 min-w-0">
              {metrics.hrv != null && (
                <Metric label="ВСР" value={`${metrics.hrv.toFixed(1)} мс`} />
              )}
              {metrics.resting_heart_rate != null && (
                <Metric label="Пульс покоя" value={`${Math.round(metrics.resting_heart_rate)}`} />
              )}
              {metrics.day_strain != null && (
                <Metric
                  label="Нагрузка"
                  value={metrics.day_strain.toFixed(1)}
                  color={strainColor(metrics.day_strain)}
                  hint={strainLabel(metrics.day_strain)}
                />
              )}
              {metrics.sleep_hours != null && (
                <Metric label="Сон" value={`${metrics.sleep_hours.toFixed(1)} ч`} />
              )}
            </div>
          </Card>
        ) : null}
      </div>
    </section>
  )
}

function Metric({
  label, value, color, hint,
}: { label: string; value: string; color?: string; hint?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-bold text-foreground" style={{ color }}>
        {value}
        {hint && <span className="ml-1 text-[10px] font-normal text-muted-foreground">{hint}</span>}
      </span>
    </div>
  )
}
