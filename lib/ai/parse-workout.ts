/**
 * Parse a free-form athlete description ("сегодня 5км бег пульс 150 ...")
 * into a structured workout record using Claude with a Zod schema.
 */
import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { z } from 'zod'
import { AI_MODEL_FAST, isAiConfigured } from './claude'

export const WorkoutDraftSchema = z.object({
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('ISO date YYYY-MM-DD; if user did not say, leave empty string'),
  activity_type: z.string().describe('Run, bike, swim, strength, yoga, etc. lowercase english'),
  name: z.string().describe('Short title in Russian (e.g. "Лёгкий 5к")'),
  description: z.string().describe('Free-form description capturing details the user said'),
  activity_duration_min: z.number().nullable(),
  activity_strain: z.number().nullable().describe('0..21 scale if stated; null if unknown'),
  avg_heart_rate: z.number().nullable(),
  max_heart_rate: z.number().nullable(),
  activity_calories: z.number().nullable(),
  mood: z.number().int().min(1).max(5).nullable(),
  workout_time_of_day: z.enum(['morning', 'day', 'evening', 'night']).nullable(),
})

export type WorkoutDraft = z.infer<typeof WorkoutDraftSchema>

const SYSTEM =
`Ты парсер спортивных описаний. Получаешь текст атлета на русском и возвращаешь
структурированный черновик тренировки. Извлекай только факты, которые явно
упомянуты. Не выдумывай. Null — если значение не указано.
event_date: если сегодня/вчера/позавчера — переведи в YYYY-MM-DD относительно даты из подсказки.`

export async function parseWorkoutText(opts: { text: string; todayISO: string }): Promise<WorkoutDraft> {
  if (!isAiConfigured()) throw new Error('AI_NOT_CONFIGURED')
  const prompt =
`Сегодня: ${opts.todayISO}.
Текст атлета:
"""${opts.text}"""

Верни JSON по схеме. Для event_date: если упомянуто "сегодня" → ${opts.todayISO};
"вчера" → день назад; "позавчера" → два дня назад. Если даты нет — ставь сегодняшнюю.`

  const { object } = await generateObject({
    model: anthropic(AI_MODEL_FAST),
    schema: WorkoutDraftSchema,
    system: SYSTEM,
    prompt,
    maxOutputTokens: 600,
  })
  return object
}
