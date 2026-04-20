/**
 * Form (technique) analysis via Claude Vision.
 * Input: ordered list of base64-encoded JPEG keyframes from a short athlete video.
 * Output: structured feedback — strengths, issues, recommendations.
 */
import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { z } from 'zod'
import { isAiConfigured, AI_MODEL_SMART } from './claude'

export const FormFeedbackSchema = z.object({
  summary: z.string().describe('2–3 sentence overall assessment in Russian'),
  overall_score: z.number().min(0).max(10).describe('Overall technique score 0..10'),
  strengths: z.array(z.string()).max(5).describe('Up to 5 strong points'),
  issues: z.array(z.object({
    frame: z.number().int().min(1).describe('1-based keyframe index where visible'),
    title: z.string(),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
  })).max(8),
  recommendations: z.array(z.string()).max(6).describe('Actionable drills / cues'),
})

export type FormFeedback = z.infer<typeof FormFeedbackSchema>

const SYSTEM_PROMPT =
`Ты — опытный тренер по спортивной технике. На вход тебе дают последовательность кадров (ключевые фреймы) из короткого видео упражнения.
Проанализируй технику атлета:
- Оцени позицию тела, траекторию, ритм, симметрию.
- Укажи сильные стороны (до 5).
- Укажи проблемы (до 8): в какой номер кадра видно, краткое название, описание, severity.
- Дай практические рекомендации и упражнения (до 6).
- Верни summary и общую оценку 0..10.
Пиши строго по-русски. Будь конкретен — избегай общих фраз.`

export async function analyzeFormFrames(input: {
  frames: string[] // base64 JPEG without data: prefix
  sport?: string
  exercise?: string
  title?: string
}): Promise<FormFeedback> {
  if (!isAiConfigured()) throw new Error('AI_NOT_CONFIGURED')
  if (!input.frames.length) throw new Error('NO_FRAMES')

  const context = [
    input.title ? `Название разбора: ${input.title}` : null,
    input.sport ? `Вид спорта: ${input.sport}` : null,
    input.exercise ? `Упражнение: ${input.exercise}` : null,
    `Количество кадров: ${input.frames.length} (в хронологическом порядке).`,
  ].filter(Boolean).join('\n')

  const imageParts = input.frames.map((b64, i) => ([
    { type: 'text' as const, text: `Кадр #${i + 1}:` },
    { type: 'image' as const, image: `data:image/jpeg;base64,${b64}` },
  ])).flat()

  const { object } = await generateObject({
    model: anthropic(AI_MODEL_SMART),
    schema: FormFeedbackSchema,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: context },
        ...imageParts,
        { type: 'text', text: 'Проанализируй технику и верни JSON по схеме.' },
      ],
    }],
    maxOutputTokens: 1400,
  })

  return object
}
