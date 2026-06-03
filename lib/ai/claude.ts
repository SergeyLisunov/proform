/**
 * Claude (Anthropic) helpers for Sporteo AI features.
 * Gracefully degrades when ANTHROPIC_API_KEY is not configured.
 */
import { anthropic } from '@ai-sdk/anthropic'
import { generateObject, generateText } from 'ai'
import type { z } from 'zod'

export const AI_MODEL_FAST   = 'claude-haiku-4-5'
export const AI_MODEL_SMART  = 'claude-sonnet-4-5'

export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

export async function aiObject<T>(opts: {
  schema: z.ZodType<T>
  prompt: string
  system?: string
  model?: string
  maxTokens?: number
}): Promise<T> {
  if (!isAiConfigured()) throw new Error('AI_NOT_CONFIGURED')
  const { object } = await generateObject({
    model: anthropic(opts.model ?? AI_MODEL_FAST),
    schema: opts.schema,
    system: opts.system,
    prompt: opts.prompt,
    maxOutputTokens: opts.maxTokens ?? 800,
  })
  return object
}

export async function aiText(opts: {
  prompt: string
  system?: string
  model?: string
  maxTokens?: number
}): Promise<string> {
  if (!isAiConfigured()) throw new Error('AI_NOT_CONFIGURED')
  const { text } = await generateText({
    model: anthropic(opts.model ?? AI_MODEL_FAST),
    system: opts.system,
    prompt: opts.prompt,
    maxOutputTokens: opts.maxTokens ?? 600,
  })
  return text
}
