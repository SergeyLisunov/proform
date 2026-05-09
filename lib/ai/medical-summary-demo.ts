/**
 * Medical Summary Demo — Sprint W4 Day 21 (PR #37).
 *
 * Public lead-magnet AI logic для doctor / sports physician acquisition.
 * Doctor вводит athlete case data (демография + complaint + training load +
 * medical history + examination findings) → AI генерирует structured
 * medical assessment template:
 *   - Triage classification (red_flag / urgent_referral / restricted /
 *     monitor / return_to_play)
 *   - Red flags identified
 *   - Differential considerations (3-5)
 *   - Recommended next steps (imaging / referral / activity mods / follow-up)
 *   - Patient education points
 *   - Confidence level
 *
 * ⚠️ КРИТИЧНО: вывод explicitly помечен как "AI-generated draft for
 * clinical reference; NOT a diagnosis; requires clinical review by a
 * licensed practitioner". Это указано в:
 *   - System prompt (instructs AI to never hedge, but always remind о limits)
 *   - UI: persistent disclaimer at top + footer of result
 *   - Email template: prominent disclaimer block
 *
 * Параллельные lead-magnets W4:
 *   Day 18 lib/ai/team-risk.ts
 *   Day 19 lib/ai/adaptive-plan-preview.ts
 *   Day 20 lib/ai/club-audit.ts
 *   Day 21 (this) — doctor target
 *
 * Heuristic stub fallback:
 *   - Pain >= 8 OR ключевые neurological symptoms → red_flag
 *   - Constitutional symptoms (fever, weight loss) или red-flag keywords
 *     (chest pain, syncope) → urgent_referral
 *   - Triple-positive exam (swelling + ROM + tenderness) AND pain >= 6 →
 *     restricted_activity
 *   - Acute onset + рост нагрузки > 30% → restricted_activity
 *   - Иначе → monitor / return_to_play
 */
import { z } from 'zod'
import { aiObject, isAiConfigured, AI_MODEL_SMART } from '@/lib/ai/claude'

// ── Public input shape ─────────────────────────────────────────────────

export const SexSchema = z.enum(['male', 'female', 'other', 'unspecified'])
export const LevelSchema = z.enum(['recreational', 'club', 'national', 'elite'])
export const OnsetSchema = z.enum(['acute', 'sub_acute', 'chronic'])
export const LoadChangeSchema = z.enum(['none', 'increased', 'decreased'])

export const MedicalCaseInputSchema = z.object({
  // Patient
  age:            z.number().int().min(8).max(99),
  sex:            SexSchema.default('unspecified'),
  sport:          z.string().min(1).max(60),
  level:          LevelSchema.default('recreational'),

  // Presenting complaint
  primary_symptom: z.string().min(1).max(400).describe('Основной симптом (free text)'),
  onset:           OnsetSchema,
  duration_days:   z.number().int().min(0).max(3650),  // up to 10 years
  pain_scale:      z.number().int().min(0).max(10),     // 0-10 VAS
  location:        z.string().min(1).max(120),          // body region

  // Recent training load (опц.)
  hours_current_week:  z.number().min(0).max(60).optional(),
  hours_avg_4w:        z.number().min(0).max(60).optional(),
  recent_load_change:  LoadChangeSchema.optional(),
  activity_type:       z.string().max(60).optional(),

  // Medical history (опц.)
  previous_similar:    z.boolean().optional(),
  chronic_conditions:  z.string().max(400).optional(),
  medications:         z.string().max(400).optional(),

  // Examination findings (опц.)
  visible_swelling:    z.boolean().optional(),
  rom_limited:         z.boolean().optional(),
  tenderness:          z.boolean().optional(),
  exam_notes:          z.string().max(400).optional(),
})

export type MedicalCaseInput = z.infer<typeof MedicalCaseInputSchema>

// ── AI output schema ───────────────────────────────────────────────────

export const TriageSchema = z.enum([
  'red_flag',           // 🚨 Emergency / immediate attention
  'urgent_referral',    // ⚠️ Refer within 24-72h
  'restricted_activity',// 🟠 Modified activity, follow-up 1-2 weeks
  'monitor',            // 🟡 Watch + reassess in 2-4 weeks
  'return_to_play',     // 🟢 Cleared (with caveats)
])

const DifferentialItemSchema = z.object({
  condition:  z.string().max(80).describe('Diagnostic consideration name'),
  likelihood: z.enum(['low', 'medium', 'high']),
  notes:      z.string().max(180).describe('Why this is on the differential'),
})

export const MedicalSummarySchema = z.object({
  triage:                TriageSchema,
  triage_explanation:    z.string().max(280).describe('1-2 фразы объяснения triage decision'),

  red_flags:             z.array(z.string().max(120)).max(5).describe('Red flag findings (если есть)'),
  differential:          z.array(DifferentialItemSchema).max(5).describe('3-5 differential considerations, ordered by likelihood'),

  recommended_next_steps: z.object({
    imaging_suggested:      z.string().max(140).nullable().describe('Image type if needed (e.g. "MRI knee"), null if not'),
    specialist_referral:    z.string().max(140).nullable().describe('Specialist field if referral indicated, null if not'),
    activity_modifications: z.string().max(220).describe('What activity restrictions/modifications to recommend'),
    follow_up_timeline:     z.string().max(140).describe('When to reassess (e.g. "2 weeks", "if symptoms worsen")'),
  }),

  patient_education:     z.array(z.string().max(140)).max(5).describe('Bullet points для информирования атлета'),
  confidence:            z.enum(['low', 'medium', 'high']).describe('Уверенность модели в assessment с учётом доступной info'),
})

export type MedicalSummary  = z.infer<typeof MedicalSummarySchema>
export type Triage          = z.infer<typeof TriageSchema>

// ── Heuristic helpers ─────────────────────────────────────────────────

const RED_FLAG_KEYWORDS = [
  'обморок', 'syncope', 'обморо',
  'грудн', 'chest pain', 'давящ',
  'температур', 'fever', 'лихорадк',
  'потер', 'weight loss', 'снижен веса',
  'онеме', 'numbness', 'паралич', 'paralysis',
  'недержани', 'incontinence',
  'кровь', 'blood', 'кровотеч',
  'ночные пот', 'night sweat',
  'сильная боль голов', 'severe headache',
  'непрох', 'persistent',
]

function hasRedFlagKeyword(text: string): string | null {
  const lower = text.toLowerCase()
  for (const kw of RED_FLAG_KEYWORDS) {
    if (lower.includes(kw)) return kw
  }
  return null
}

function loadIncreasePercent(input: MedicalCaseInput): number | null {
  if (!input.hours_current_week || !input.hours_avg_4w || input.hours_avg_4w === 0) return null
  return Math.round(((input.hours_current_week - input.hours_avg_4w) / input.hours_avg_4w) * 100)
}

// ── Rule-based stub (when AI not configured) ──────────────────────────

function ruleBased(input: MedicalCaseInput): MedicalSummary {
  const symptom = input.primary_symptom.toLowerCase()
  const exam = (input.exam_notes ?? '').toLowerCase()
  const fullText = `${symptom} ${exam}`

  // Red flag detection
  const red_flags: string[] = []
  if (input.pain_scale >= 9) red_flags.push(`Pain scale ${input.pain_scale}/10 — severe pain requires immediate evaluation`)
  const kw = hasRedFlagKeyword(fullText)
  if (kw) red_flags.push(`Symptom mentions concerning keyword: "${kw}" — review for serious pathology`)
  if (input.visible_swelling && input.rom_limited && input.tenderness && input.pain_scale >= 7) {
    red_flags.push('Triple-positive exam (swelling + ROM limited + tenderness) with severe pain — possible significant injury')
  }
  if (input.duration_days < 1 && input.pain_scale >= 8) {
    red_flags.push('Acute onset with severe pain — exclude fracture/dislocation/major soft tissue injury')
  }

  // Triage decision (cascading rules)
  let triage: Triage
  let triage_explanation: string
  if (red_flags.length > 0 && (input.pain_scale >= 9 || kw)) {
    triage = 'red_flag'
    triage_explanation = 'Severity и/или red-flag keywords указывают на возможную серьёзную патологию — direct emergency evaluation.'
  } else if (kw || (input.visible_swelling && input.rom_limited && input.tenderness)) {
    triage = 'urgent_referral'
    triage_explanation = 'Combination of findings suggests need for specialist referral within 24-72h.'
  } else if (
    (input.visible_swelling && input.tenderness) ||
    (input.pain_scale >= 6 && input.onset === 'acute') ||
    ((loadIncreasePercent(input) ?? 0) > 30 && input.onset === 'acute')
  ) {
    triage = 'restricted_activity'
    triage_explanation = 'Acute symptoms или significant load increase — recommend activity modification и follow-up через 1-2 недели.'
  } else if (input.previous_similar || input.duration_days > 14) {
    triage = 'monitor'
    triage_explanation = 'Sub-acute или recurrent symptoms — observe + reassess через 2-4 недели; consider workup if no improvement.'
  } else {
    triage = 'return_to_play'
    triage_explanation = 'No red flags identified, exam unremarkable, симптомы низкой intensity — cleared with monitoring.'
  }

  // Generic differentials based on location + onset
  const differential: z.infer<typeof DifferentialItemSchema>[] = []
  if (input.onset === 'acute') {
    differential.push({ condition: 'Острое мышечное растяжение (strain)',  likelihood: 'high',   notes: 'Acute onset + activity context — most common cause' })
    differential.push({ condition: 'Связочное растяжение (sprain)',        likelihood: 'medium', notes: 'Если есть отёк/нестабильность — рассмотреть' })
    if (input.pain_scale >= 7) differential.push({ condition: 'Перелом/частичный перелом', likelihood: 'medium', notes: 'High pain + acute mechanism — exclude via imaging' })
  } else if (input.onset === 'sub_acute') {
    differential.push({ condition: 'Тендинит / тендинопатия',     likelihood: 'high',   notes: 'Sub-acute onset typical for overuse' })
    differential.push({ condition: 'Стресс-перелом',               likelihood: 'medium', notes: 'Если нагрузка резко возросла — рассмотреть' })
    differential.push({ condition: 'Бурсит / синовит',             likelihood: 'medium', notes: 'Если есть локальный отёк' })
  } else {
    differential.push({ condition: 'Хроническая overuse-травма',  likelihood: 'high',   notes: 'Chronic course typical for repetitive load' })
    differential.push({ condition: 'Postural/biomechanical issue', likelihood: 'medium', notes: 'Consider movement assessment' })
    if (input.previous_similar) differential.push({ condition: 'Reinjury / unresolved prior issue', likelihood: 'high', notes: 'Previous similar episode — likely same pathology' })
  }

  // Next steps
  const imaging_suggested =
    triage === 'red_flag' || triage === 'urgent_referral'
      ? `Imaging by clinical assessment (X-ray ± MRI ${input.location})`
      : (input.pain_scale >= 7 || (input.visible_swelling && input.rom_limited))
        ? `Consider X-ray ${input.location} to exclude fracture`
        : null

  const specialist_referral =
    triage === 'red_flag'                      ? 'Emergency department / on-call specialist'
    : triage === 'urgent_referral'             ? `Sports medicine specialist ± ${input.location.includes('голов') ? 'neurologist' : 'orthopedic surgeon'}`
    : triage === 'restricted_activity'         ? 'Sports medicine / physiotherapist (within 1-2 weeks)'
    : null

  const activity_modifications =
    triage === 'red_flag'                      ? 'STOP all training. Rest until evaluation.'
    : triage === 'urgent_referral'             ? 'Significantly reduced activity / avoid loading affected area until specialist review.'
    : triage === 'restricted_activity'         ? 'Modified training: avoid pain-provoking movements; cross-training (cycling/swimming) при возможности.'
    : triage === 'monitor'                     ? 'Continue training с мониторингом боли (PEAK ≤4/10); снизить нагрузку на 20-30% если боль усиливается.'
    : 'Можно продолжать обычные тренировки; следить за recovery + сообщить если симптомы вернутся.'

  const follow_up_timeline =
    triage === 'red_flag'                      ? 'Немедленно (today)'
    : triage === 'urgent_referral'             ? '24-72 часа'
    : triage === 'restricted_activity'         ? '1-2 недели'
    : triage === 'monitor'                     ? '2-4 недели'
    : '4 недели или при возвращении симптомов'

  // Patient education
  const patient_education: string[] = []
  if (triage === 'red_flag' || triage === 'urgent_referral') {
    patient_education.push('Не игнорируйте усиление симптомов — возвращайтесь раньше, если станет хуже')
    patient_education.push('Любая новая red-flag-симптоматика (онемение, потеря функции, лихорадка) → немедленно к врачу')
  } else {
    patient_education.push(`Pain scale ≤ 4/10 во время тренировки = безопасно; > 4/10 = снизить нагрузку`)
    patient_education.push('Ice 15 мин 3-4 раза в день в первые 48-72 часа при отёке')
    patient_education.push('Прогрессивное возвращение к нагрузке: +10% объёма в неделю, не больше')
  }
  if (loadIncreasePercent(input) && loadIncreasePercent(input)! > 20) {
    patient_education.push(`Нагрузка выросла на ${loadIncreasePercent(input)}% за неделю — это >> safe rate (10%) и фактор риска`)
  }
  patient_education.push('Этот summary НЕ заменяет clinical review — обсудите с лечащим врачом')

  const confidence: 'low' | 'medium' | 'high' =
    (input.exam_notes && input.exam_notes.length > 30 && (input.visible_swelling !== undefined || input.tenderness !== undefined))
      ? 'medium'
      : 'low'

  return {
    triage,
    triage_explanation,
    red_flags,
    differential: differential.slice(0, 5),
    recommended_next_steps: { imaging_suggested, specialist_referral, activity_modifications, follow_up_timeline },
    patient_education: patient_education.slice(0, 5),
    confidence,
  }
}

// ── Public API ─────────────────────────────────────────────────────────

export interface AnalyzeOptions {
  stub?: boolean
}

export async function analyzeMedicalCase(
  input: MedicalCaseInput,
  opts: AnalyzeOptions = {},
): Promise<MedicalSummary> {
  if (opts.stub || !isAiConfigured()) {
    return ruleBased(input)
  }

  const loadDeltaPct = loadIncreasePercent(input)

  try {
    const summary = await aiObject({
      schema: MedicalSummarySchema,
      model:  AI_MODEL_SMART,
      system: [
        'Ты опытный sport physician (sports medicine doctor) с подготовкой в orthopedics и rehabilitation.',
        'Делаешь структурированный summary конкретного athlete case — НЕ диагноз, а draft для clinical review.',
        'Отвечай на русском, кратко, по делу. Используй конкретные клинические термины.',
        'ВАЖНО: ВСЕГДА явно отметь limited info constraints, не делай overconfident statements.',
        'Если симптом потенциально серьёзный — выбери triage=red_flag или urgent_referral, не downplay.',
      ].join(' '),
      prompt: [
        '## Athlete case',
        `Возраст: ${input.age} (${input.sex})`,
        `Спорт: ${input.sport} (${input.level} level)`,
        '',
        '## Presenting complaint',
        `Primary symptom: ${input.primary_symptom}`,
        `Location: ${input.location}`,
        `Onset: ${input.onset} (длительность: ${input.duration_days} дней)`,
        `Pain scale: ${input.pain_scale}/10`,
        '',
        '## Training load',
        input.hours_current_week !== undefined ? `Current week: ${input.hours_current_week} hr` : 'Current week: не указано',
        input.hours_avg_4w !== undefined ? `Avg 4w: ${input.hours_avg_4w} hr` : 'Avg 4w: не указано',
        loadDeltaPct !== null ? `Load delta: ${loadDeltaPct >= 0 ? '+' : ''}${loadDeltaPct}%` : '',
        input.recent_load_change ? `Recent change: ${input.recent_load_change}` : '',
        input.activity_type ? `Activity type: ${input.activity_type}` : '',
        '',
        '## Medical history',
        input.previous_similar !== undefined ? `Previous similar issue: ${input.previous_similar ? 'да' : 'нет'}` : '',
        input.chronic_conditions ? `Chronic conditions: ${input.chronic_conditions}` : '',
        input.medications ? `Current medications: ${input.medications}` : '',
        '',
        '## Examination findings',
        input.visible_swelling !== undefined ? `Visible swelling: ${input.visible_swelling ? 'да' : 'нет'}` : '',
        input.rom_limited !== undefined ? `ROM limited: ${input.rom_limited ? 'да' : 'нет'}` : '',
        input.tenderness !== undefined ? `Tenderness on palpation: ${input.tenderness ? 'да' : 'нет'}` : '',
        input.exam_notes ? `Notes: ${input.exam_notes}` : '',
        '',
        '## Required output',
        'Используй структуру:',
        '1. triage — выбор из 5 категорий по severity',
        '2. triage_explanation — 1-2 фразы почему этот triage',
        '3. red_flags — список конкретных red flag findings (пусто если нет)',
        '4. differential — 3-5 considerations с likelihood и notes',
        '5. recommended_next_steps:',
        '   - imaging_suggested: какое imaging нужно (или null)',
        '   - specialist_referral: какой специалист (или null)',
        '   - activity_modifications: чёткие restrictions',
        '   - follow_up_timeline: когда переоценить',
        '6. patient_education — 3-5 bullets для атлета',
        '7. confidence — уверенность assessment с учётом limited info',
        '',
        'Помни: это AI draft для clinical reference. Не делай definitive diagnosis. Если info недостаточно для confident call — говори об этом и запрашивай дополнительные findings.',
      ].filter(Boolean).join('\n'),
      maxTokens: 2200,
    })
    return summary
  } catch (e) {
    console.warn('[medical-summary] AI call failed, falling back to rule-based:', e instanceof Error ? e.message : e)
    return ruleBased(input)
  }
}
