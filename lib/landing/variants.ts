/**
 * lib/landing/variants.ts — W15 Day 77.
 *
 * Single source of truth для landing A/B variant copy. Read-only export —
 * variant assignment lives в middleware (cookie), variant rendering reads
 * через `getLandingVariant()`.
 *
 * **Variant A (control)** — persona-driven, current W14 copy.
 * **Variant B (challenger)** — pain-first / tool-replacement framing.
 *
 * Both honest, both factually correct. We test which framing converts
 * better — не «who's funnier».
 *
 * Cookie convention: `pf-landing-ab` set to 'A' or 'B'. 30-day persistence
 * — returning user sees same variant (consistency > per-visit randomization).
 *
 * **Adding variant C+:** не делайте Day 77 — нужна statistical multiple-
 * comparison correction (Bonferroni). А/B is enough для initial test.
 */

export type LandingVariant = 'A' | 'B'

export const LANDING_VARIANT_COOKIE = 'pf-landing-ab'

/** Cookie max-age в секундах — 30 days. */
export const LANDING_VARIANT_MAX_AGE = 60 * 60 * 24 * 30

interface VariantCopy {
  /** Small uppercase eyebrow above H1. */
  eyebrow:     string
  /** Main headline. Может содержать JSX-friendly highlight markers. */
  h1:          string
  /** Highlight substring внутри h1 (orange color). */
  h1Highlight: string
  /** Subline под H1. */
  sub:         string
  /** Primary CTA label. */
  primaryCta:  string
  /** Demo / secondary CTA label. */
  demoCta:     string
  /** Trust line под CTAs. */
  trust:       string
}

export const LANDING_VARIANTS: Record<LandingVariant, VariantCopy> = {
  A: {
    eyebrow:     'Спортивная платформа',
    h1:          'Тренер, спортсмен, врач и клуб — работают в одной системе',
    h1Highlight: 'и клуб',
    sub:
      'Спортивная подготовка без чатов, таблиц и потерянных данных. ' +
      'Прогресс спортсмена видят все, кому это нужно — и только они.',
    primaryCta:  'Создать аккаунт',
    demoCta:     'Открыть demo как тренер',
    trust:
      'Бесплатно во время закрытой беты · Подключение клуба за 10 минут · ' +
      'Подходит для клубов, академий и performance-центров',
  },
  B: {
    eyebrow:     'Спортивная платформа',
    h1:          'Замените Excel и WhatsApp одной системой для клуба',
    h1Highlight: 'одной системой',
    sub:
      'Карточки атлетов, расписание, медданные и общение с родителями — ' +
      'в одном месте. Тренер тратит время на тренерскую работу, а не на пересылку.',
    primaryCta:  'Подключить клуб',
    demoCta:     'Посмотреть demo',
    trust:
      'Бесплатно во время закрытой беты · Подключение за 10 минут · ' +
      'Хостинг данных в Supabase EU-Central',
  },
}

/**
 * Type guard / coercion — returns 'A' если value не valid.
 *
 * Used везде где value пришла из untrusted source (cookie, header).
 */
export function coerceVariant(value: string | undefined | null): LandingVariant {
  return value === 'B' ? 'B' : 'A'
}
