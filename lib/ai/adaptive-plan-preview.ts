/**
 * Adaptive Plan Preview — Sprint W4 Day 19 (PR #35).
 *
 * Public lead-magnet AI logic. Athlete без auth даёт sport + goal +
 * 4-week training history → AI генерирует персонализированный 7-day plan
 * preview (1 неделя вперёд):
 *   - Overview: 1-2 фразы про текущую форму и стратегию
 *   - 7 дней с activity_type / duration / intensity / notes
 *   - Weekly load assessment (low/moderate/high/overtraining)
 *   - Rationale: краткое объяснение логики
 *   - Red flags: до 3 предупреждений
 *
 * Зачем отдельный модуль (а не reuse /api/ai/adaptive-plan/[athleteId]):
 *   - existing endpoint требует auth + Pro plan + связку с workouts table
 *   - public funnel: данные приходят от анона в request body
 *   - prompt адаптирован под "no athlete context" (нет ACWR из БД,
 *     только то что предоставил user)
 *
 * AI fallback: если ANTHROPIC_API_KEY отсутствует или AI call падает —
 * возвращаем deterministic stub из rule-based heuristic (deload если
 * weekly_minutes > 600 OR avg_recovery < 50; ramp-up если < 90 мин;
 * иначе balanced 4-tier pattern).
 */
import { z } from 'zod'
import { aiObject, isAiConfigured, AI_MODEL_FAST } from '@/lib/ai/claude'

// ── Public input shape ─────────────────────────────────────────────────

export const PreviewWorkoutSchema = z.object({
  /** ISO date YYYY-MM-DD */
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  activity_type:  z.string().min(1).max(40),
  duration_min:   z.number().min(0).max(600),
  /** RPE 0-10, optional */
  perceived_load: z.number().int().min(0).max(10).optional(),
  recovery_score: z.number().int().min(0).max(100).optional(),
  felt:           z.enum(['great','ok','tired','exhausted']).optional(),
})

export const AdaptivePlanInputSchema = z.object({
  sport:          z.string().min(1).max(60),
  goal:           z.string().max(400).optional(),
  level:          z.enum(['beginner','intermediate','advanced','pro','recreational']).default('intermediate'),
  weeks_history:  z.array(PreviewWorkoutSchema).max(40),
})

export type AdaptivePlanInput = z.infer<typeof AdaptivePlanInputSchema>
export type PreviewWorkout    = z.infer<typeof PreviewWorkoutSchema>

// ── AI output schema (7-day plan) ──────────────────────────────────────

const PlanDaySchema = z.object({
  day:           z.number().int().min(1).max(7).describe('Порядковый день 1-7'),
  weekday:       z.string().max(15).describe('Понедельник, Вторник, и т.д.'),
  activity_type: z.string().max(40).describe('Тип тренировки или "Отдых"'),
  duration_min:  z.number().int().min(0).max(240).describe('Длительность в минутах (0 для дня отдыха)'),
  intensity:     z.enum(['easy','moderate','hard','rest']),
  notes:         z.string().max(200).describe('Конкретное действие на день'),
})

export const AdaptivePlanPreviewSchema = z.object({
  overview:                z.string().max(320).describe('1-2 предложения о текущей форме и стратегии недели'),
  weekly_load_assessment:  z.enum(['low','moderate','high','overtraining']),
  days:                    z.array(PlanDaySchema).length(7).describe('Ровно 7 дней (Пн-Вс)'),
  rationale:               z.string().max(400).describe('Краткое объяснение логики плана'),
  red_flags:               z.array(z.string().max(140)).max(3).describe('До 3 предупреждений (overtraining, быстрый ramp, etc.)'),
})

export type AdaptivePlanPreview = z.infer<typeof AdaptivePlanPreviewSchema>
export type PlanDay              = z.infer<typeof PlanDaySchema>

// ── Stats enrichment ───────────────────────────────────────────────────

interface HistoryStats {
  weekly_minutes: number
  avg_recovery:   number | null
  workout_count:  number
}

function computeStats(history: PreviewWorkout[]): HistoryStats {
  if (history.length === 0) return { weekly_minutes: 0, avg_recovery: null, workout_count: 0 }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  const last7 = history.filter(w => new Date(w.date) >= cutoff)
  const weekly_minutes = last7.reduce((s, w) => s + w.duration_min, 0)

  const recoveryScores = history
    .map(w => w.recovery_score)
    .filter((s): s is number => typeof s === 'number')
  const avg_recovery = recoveryScores.length > 0
    ? Math.round(recoveryScores.reduce((s, n) => s + n, 0) / recoveryScores.length)
    : null

  return { weekly_minutes, avg_recovery, workout_count: history.length }
}

// ── Rule-based stub (when AI not configured) ──────────────────────────

const WEEKDAYS = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье']

function ruleBased(input: AdaptivePlanInput): AdaptivePlanPreview {
  const stats = computeStats(input.weeks_history)
  const isHigh       = stats.weekly_minutes > 600
  const isLow        = stats.weekly_minutes < 90
  const lowRecovery  = stats.avg_recovery !== null && stats.avg_recovery < 50

  // Pattern selection
  let pattern: Array<'easy' | 'moderate' | 'hard' | 'rest'>
  if (isHigh || lowRecovery) {
    pattern = ['easy','rest','easy','rest','easy','rest','rest']
  } else if (isLow) {
    pattern = ['easy','rest','easy','rest','moderate','rest','easy']
  } else {
    pattern = ['moderate','easy','hard','rest','moderate','easy','rest']
  }

  const days: PlanDay[] = WEEKDAYS.map((weekday, i) => {
    const intensity = pattern[i]
    let activity_type: string, duration_min: number, notes: string
    if (intensity === 'rest') {
      activity_type = 'Отдых'
      duration_min  = 0
      notes         = 'Полное восстановление, лёгкая прогулка по желанию'
    } else if (intensity === 'easy') {
      activity_type = input.sport
      duration_min  = 30
      notes         = 'Низкая интенсивность, разговорный темп'
    } else if (intensity === 'moderate') {
      activity_type = input.sport
      duration_min  = 50
      notes         = 'Базовая нагрузка, контроль ЧСС в zone 2-3'
    } else {
      activity_type = input.sport
      duration_min  = 70
      notes         = 'Высокая интенсивность — интервалы или темповая работа'
    }
    return { day: i + 1, weekday, activity_type, duration_min, intensity, notes }
  })

  const overview = isHigh
    ? `Нагрузка ${stats.weekly_minutes} мин/неделю — высокая. План на ближайшую неделю — deload (-30-40%).`
    : lowRecovery
      ? `Среднее восстановление ${stats.avg_recovery}/100 — низкое. Рекомендуем мягкую неделю с акцентом на сон и mobility.`
      : isLow
        ? `Нагрузка ${stats.weekly_minutes} мин/неделю — мало для роста. План для постепенного наращивания (+10-15%).`
        : `Нагрузка сбалансирована (${stats.weekly_minutes} мин/неделю). Базовая структура: 4 тренировки + 3 дня восстановления.`

  const weekly_load_assessment: AdaptivePlanPreview['weekly_load_assessment'] =
    isHigh        ? 'high'
    : lowRecovery ? 'overtraining'
    : isLow       ? 'low'
    : 'moderate'

  const rationale = `Цель: ${input.goal || 'общая форма'}. Уровень: ${input.level}. План построен на основе ${stats.workout_count} тренировок за последние 4 недели.`

  const red_flags: string[] = []
  if (lowRecovery)        red_flags.push('Низкое среднее восстановление — следите за признаками перетренированности (бессонница, раздражительность)')
  if (isHigh)             red_flags.push('Резкое увеличение нагрузки повышает риск травмы — наращивайте не более 10% в неделю')
  if (stats.workout_count < 5) red_flags.push('Мало данных — план базовый, для точности добавьте больше истории')

  return { overview, weekly_load_assessment, days, rationale, red_flags }
}

// ── Public API ─────────────────────────────────────────────────────────

export interface AnalyzeOptions {
  /** Forces stub even if AI is configured (tests / dev). */
  stub?: boolean
}

export async function generateAdaptivePlan(
  input: AdaptivePlanInput,
  opts: AnalyzeOptions = {},
): Promise<AdaptivePlanPreview> {
  if (opts.stub || !isAiConfigured()) {
    return ruleBased(input)
  }

  const stats = computeStats(input.weeks_history)

  try {
    const plan = await aiObject({
      schema: AdaptivePlanPreviewSchema,
      model:  AI_MODEL_FAST,
      system: 'Ты опытный персональный тренер. Отвечаешь на русском, кратко, по делу. Делаешь персонализированный 7-дневный план на основе истории тренировок атлета — без общих фраз, конкретные действия по дням.',
      prompt: [
        `Спорт: ${input.sport}.`,
        `Цель: ${input.goal || 'общая физическая форма'}.`,
        `Уровень: ${input.level}.`,
        `Статистика последней недели: ${stats.weekly_minutes} мин тренировок.`,
        `Среднее recovery: ${stats.avg_recovery ?? 'нет данных'}/100.`,
        `История тренировок (${stats.workout_count} записей за ~4 недели):`,
        JSON.stringify(input.weeks_history.slice(0, 30), null, 2).slice(0, 4500),
        '',
        'Правила построения плана:',
        '- Если weekly_minutes > 600 ИЛИ avg_recovery < 50 → deload (4 easy + 3 rest, без hard sessions)',
        '- Если weekly_minutes < 90 → ramp-up (постепенный набор, +10-15% к текущему объёму)',
        '- Иначе sweet-spot структура: 1-2 hard + 2-3 moderate + 1-2 easy + 1-2 rest',
        '- Минимум 1 день полного отдыха в неделю обязательно',
        '- Активности должны соответствовать sport (если бег → бег + кросс-тренинг; силовые → силовые + cardio)',
        '',
        'Для каждого дня: weekday (Понедельник-Воскресенье), activity_type, duration_min, intensity (easy/moderate/hard/rest), notes (КОНКРЕТНОЕ действие — не общие слова).',
        'Overview: 1-2 фразы о форме и стратегии недели.',
        'Weekly load assessment: low/moderate/high/overtraining.',
        'Rationale: 1-2 предложения о логике плана.',
        'Red flags: до 3 предупреждений если есть риски (overtraining, быстрый ramp, недостаток данных).',
      ].join('\n'),
      maxTokens: 1800,
    })
    return plan
  } catch (e) {
    console.warn('[adaptive-plan-preview] AI call failed, falling back to rule-based:', e instanceof Error ? e.message : e)
    return ruleBased(input)
  }
}
