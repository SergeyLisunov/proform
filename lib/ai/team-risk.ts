/**
 * Team Risk Snapshot — AI logic. Sprint W4 Day 18 (PR #34).
 *
 * Public lead-magnet: coach вводит данные команды (3-12 атлетов, по
 * каждому — current week training hours + average over 4 weeks +
 * optional recovery score / mood / coach note), получает AI-сгенерированный
 * snapshot:
 *   - 1-2 предложения общего состояния команды
 *   - per-athlete: status (ok/watch/risk) + причина + действие
 *   - top-3 priorities на ближайшие 7-14 дней
 *
 * Зачем отдельный модуль (а не reuse /api/ai/coach-briefing напрямую):
 *   - coach-briefing требует auth + pro plan + связку с workouts table
 *   - team-risk = public funnel: данные приходят от анона в request body
 *   - Prompt адаптирован под "snapshot 14 дней вперёд" (briefing = "что
 *     делать сегодня"); тон чуть менее operational, больше strategic
 *   - Schema идентична BriefingSchema чтобы UI можно было унифицировать
 *
 * AI fallback: если OLLAMA_API_KEY не настроен — возвращаем
 * детерминистический stub из rule-based heuristic. Lead capture не
 * блокируется отсутствием AI ключа.
 */
import { z } from 'zod'
import { aiObject, isAiConfigured, AI_MODEL_SMART } from '@/lib/ai/gemma'

// ── Public input shape ─────────────────────────────────────────────────

export const AthleteInputSchema = z.object({
  name:                         z.string().min(1).max(80),
  age:                          z.number().int().min(8).max(80).optional(),
  training_hours_current_week:  z.number().min(0).max(60),
  training_hours_avg_4w:        z.number().min(0).max(60),
  recovery_score:               z.number().int().min(0).max(100).optional(),
  mood:                         z.enum(['great','ok','tired','exhausted']).optional(),
  coach_note:                   z.string().max(280).optional(),
})

export const TeamRiskInputSchema = z.object({
  sport:        z.string().min(1).max(60),
  team_name:    z.string().max(80).optional(),
  athletes:     z.array(AthleteInputSchema).min(1).max(20),
})

export type TeamRiskInput   = z.infer<typeof TeamRiskInputSchema>
export type AthleteInput    = z.infer<typeof AthleteInputSchema>

// ── AI output schema ───────────────────────────────────────────────────

const AthleteCardSchema = z.object({
  name:    z.string(),
  status:  z.enum(['ok','watch','risk']).describe('Зелёный/жёлтый/красный светофор'),
  reason:  z.string().max(160).describe('Одна фраза — почему такой статус (что в данных)'),
  action:  z.string().max(160).describe('Что тренеру сделать в ближайшие 7 дней'),
})

export const TeamRiskSnapshotSchema = z.object({
  overall:    z.string().max(320).describe('1-2 предложения о состоянии команды в целом'),
  athletes:   z.array(AthleteCardSchema).max(20),
  priorities: z.array(z.string().max(140)).max(3).describe('До 3 главных действий тренера на 7-14 дней'),
})

export type TeamRiskSnapshot = z.infer<typeof TeamRiskSnapshotSchema>

// ── Heuristic enrichment ───────────────────────────────────────────────

interface EnrichedAthlete extends AthleteInput {
  acwr: number | null
  acwr_zone: 'detraining' | 'optimal' | 'monitor' | 'danger' | null
}

/** Compute ACWR-like ratio + zone for prompt enrichment. */
function enrichAthletes(athletes: AthleteInput[]): EnrichedAthlete[] {
  return athletes.map(a => {
    const acwr = a.training_hours_avg_4w > 0
      ? round2(a.training_hours_current_week / a.training_hours_avg_4w)
      : null
    const zone: EnrichedAthlete['acwr_zone'] =
      acwr === null      ? null
      : acwr < 0.8       ? 'detraining'
      : acwr <= 1.3      ? 'optimal'
      : acwr <= 1.5      ? 'monitor'
      : 'danger'
    return { ...a, acwr, acwr_zone: zone }
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ── Rule-based stub (when AI not configured) ───────────────────────────

/**
 * Detereministic snapshot when OLLAMA_API_KEY isn't set. Same Zod
 * shape so UI code is identical. Used in dev / preview without AI quota
 * and as fallback if AI request fails.
 */
function ruleBasedSnapshot(input: TeamRiskInput): TeamRiskSnapshot {
  const enriched = enrichAthletes(input.athletes)
  const cards = enriched.map(a => {
    const lowRecovery = typeof a.recovery_score === 'number' && a.recovery_score < 40
    const overload    = a.acwr_zone === 'danger'
    const watchMood   = a.mood === 'tired' || a.mood === 'exhausted'
    const detraining  = a.acwr_zone === 'detraining'
    const monitor     = a.acwr_zone === 'monitor'

    const status: 'ok' | 'watch' | 'risk' =
      (lowRecovery || overload)                ? 'risk'
      : (watchMood || detraining || monitor)   ? 'watch'
      : 'ok'

    const reasons: string[] = []
    if (lowRecovery)             reasons.push(`recovery ${a.recovery_score}/100`)
    if (overload && a.acwr)      reasons.push(`ACWR ${a.acwr.toFixed(2)} (опасная зона)`)
    if (monitor && a.acwr)       reasons.push(`ACWR ${a.acwr.toFixed(2)} (зона мониторинга)`)
    if (detraining && a.acwr)    reasons.push(`ACWR ${a.acwr.toFixed(2)} (детренинг)`)
    if (watchMood)               reasons.push(`настроение «${a.mood}»`)
    if (a.coach_note)            reasons.push(a.coach_note)

    const action = status === 'risk'
      ? 'Снизить интенсивность на 30-40% и разговор о самочувствии'
      : status === 'watch'
        ? 'Мониторить ещё 3-4 дня; если тенденция сохранится — снизить нагрузку'
        : 'Текущий план поддерживать, контрольные показатели в норме'

    return {
      name:   a.name,
      status,
      reason: reasons.join(' · ') || 'данные в пределах ожидаемых',
      action,
    }
  })

  const riskCount  = cards.filter(c => c.status === 'risk').length
  const watchCount = cards.filter(c => c.status === 'watch').length
  const total      = input.athletes.length
  const overall = riskCount > 0
    ? `${riskCount} атлет${plural(riskCount,'ов','','а')} в красной зоне риска, ${watchCount} требу${plural(watchCount,'ют','ет','ют')} наблюдения. Команда нуждается в коррекции нагрузки.`
    : watchCount > 0
      ? `Команда в целом стабильна, но ${watchCount} атлет${plural(watchCount,'ов','','а')} требу${plural(watchCount,'ют','ет','ют')} наблюдения в ближайшую неделю.`
      : `Все ${total} атлет${plural(total,'ов','','а')} в зелёной зоне. План работает, продолжайте текущий ритм.`

  const priorities: string[] = []
  if (riskCount > 0)  priorities.push(`Сократить нагрузку у ${riskCount} атлет${plural(riskCount,'ов','а','ов')} в группе риска на 7-10 дней`)
  if (watchCount > 0) priorities.push(`Провести индивидуальный разговор с ${watchCount} атлет${plural(watchCount,'ами','ом','ами')} в watch-статусе`)
  if (priorities.length === 0)
    priorities.push('Поддерживать текущий план; перепроверить состояние через 7 дней')
  priorities.push(`Использовать еженедельный мониторинг ACWR (отношение ${input.sport}-нагрузки последней недели к среднему за 4 недели)`)

  return {
    overall,
    athletes:   cards,
    priorities: priorities.slice(0, 3),
  }
}

function plural(n: number, many: string, one: string, few: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

// ── Public API ─────────────────────────────────────────────────────────

export interface AnalyzeOptions {
  /** Forces stub even if AI is configured. Used by tests. */
  stub?: boolean
}

export async function analyzeTeamRisk(
  input: TeamRiskInput,
  opts: AnalyzeOptions = {},
): Promise<TeamRiskSnapshot> {
  if (opts.stub || !isAiConfigured()) {
    return ruleBasedSnapshot(input)
  }

  const enriched = enrichAthletes(input.athletes)

  try {
    const snapshot = await aiObject({
      schema: TeamRiskSnapshotSchema,
      model:  AI_MODEL_SMART,
      system: 'Ты опытный главный тренер с навыком sport science. Делаешь короткий risk snapshot по команде на основе weekly training load + recovery + mood. Отвечай на русском, кратко, конкретно, по-делу. Не пиши общих фраз.',
      prompt: [
        `Спорт: ${input.sport}. ${input.team_name ? 'Команда: ' + input.team_name + '.' : ''}`,
        `Атлеты (${enriched.length}):`,
        JSON.stringify(enriched, null, 2).slice(0, 6000),
        '',
        'Правила оценки status:',
        '- risk: recovery < 40 OR ACWR > 1.5 OR mood=exhausted OR coach_note явно говорит о проблеме',
        '- watch: ACWR 1.3-1.5, или mood=tired, или ACWR < 0.8 (детренинг)',
        '- ok: всё в зелёной зоне',
        '',
        'Для каждого атлета: status + reason (что в данных) + action (что сделать тренеру в 7 дней).',
        'Overall: 1-2 предложения о команде в целом.',
        'Priorities: 2-3 главных действия тренера на 7-14 дней (по убыванию приоритета).',
      ].join('\n'),
      maxTokens: 1600,
    })
    return snapshot
  } catch (e) {
    console.warn('[team-risk] AI call failed, falling back to rule-based:', e instanceof Error ? e.message : e)
    return ruleBasedSnapshot(input)
  }
}
