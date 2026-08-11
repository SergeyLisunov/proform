/**
 * Form (technique) analysis — разбор техники по ключевым кадрам видео.
 *
 * СТАТУС: ФУНКЦИЯ НЕДОСТУПНА. Это единственный AI-инструмент платформы,
 * которому нужен мультимодальный вход: на вход шла последовательность
 * base64-JPEG кадров, и разбор строился по картинкам.
 *
 * Почему не переносится на Gemma:
 *   - канал изображений в lib/ai/ollama отсутствует физически —
 *     OllamaChatMessage это { role, content: string }, картинке в теле
 *     запроса просто негде поехать;
 *   - добавить его вслепую нельзя: неизвестно, принимает ли закреплённая
 *     модель gemma4:31b изображения через Ollama Cloud вообще. Пока это
 *     не проверено вживую (как проверялись стриминг и watchdog-таймеры),
 *     любой код здесь был бы догадкой.
 *
 * Поэтому здесь НЕТ подделки: текстовый «разбор техники» без единого
 * кадра — это выдуманный отзыв о движении, которого модель не видела.
 * Для разбора техники такой ответ хуже отказа: тренер и атлет получили
 * бы уверенные рекомендации, ни на чём не основанные. Вызов честно
 * падает типизированной ошибкой, маршрут отвечает 501.
 *
 * Что нужно, чтобы включить обратно: подтвердить приём изображений
 * моделью, добавить в клиент поле `images` у сообщения (нативный
 * /api/chat Ollama его поддерживает) и вернуть сюда вызов.
 *
 * Схема FormFeedbackSchema сохранена: по ней лежат данные в
 * public.form_analyses.ai_feedback и её читает UI истории разборов.
 */
import { z } from 'zod'

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

/** Машиночитаемый код отказа — его же маршрут отдаёт клиенту. */
export const FORM_ANALYSIS_UNAVAILABLE = 'FORM_ANALYSIS_UNAVAILABLE' as const

/**
 * Доступен ли разбор техники. Сейчас всегда false — см. шапку файла.
 * Маршруты обязаны спрашивать ДО создания строки в form_analyses,
 * иначе каждая попытка оставляет мусорную запись analyzing → error.
 */
export function isFormAnalysisAvailable(): boolean {
  return false
}

export class FormAnalysisUnavailableError extends Error {
  readonly code = FORM_ANALYSIS_UNAVAILABLE
  constructor() {
    super(FORM_ANALYSIS_UNAVAILABLE)
    this.name = 'FormAnalysisUnavailableError'
  }
}

// Аргумент не читается, но сигнатуру сохраняем намеренно: это контракт
// функции на момент, когда мультимодальный вызов вернётся, и он же держит
// типы на стороне вызывающего маршрута.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function analyzeFormFrames(_input: {
  frames: string[] // base64 JPEG without data: prefix
  sport?: string
  exercise?: string
  title?: string
}): Promise<FormFeedback> {
  throw new FormAnalysisUnavailableError()
}
