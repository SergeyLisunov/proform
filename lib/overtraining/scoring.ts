/**
 * Pure scoring для теста «Признаки перетренированности».
 * 10 вопросов, каждый 0–4 балла (4 = худший/тревожный ответ).
 * Итог: 0–100 (weighted).
 */

export interface OvertrainingQuestion {
  id: string
  question: string
  options: string[]   // 5 вариантов, индекс 0 = лучший, 4 = худший
  weight: number      // сумма весов = 10 (для 100-балльной шкалы × 2.5)
}

export const OT_QUESTIONS: OvertrainingQuestion[] = [
  {
    id: 'sleep',
    question: 'Как вы спали в последние 7 ночей?',
    options: [
      'Отлично, просыпаюсь отдохнувшим',
      'Хорошо, но иногда сложно заснуть',
      'Средне, сон поверхностный',
      'Плохо, часто просыпаюсь ночью',
      'Очень плохо, <6 часов большинство ночей',
    ],
    weight: 1.3,
  },
  {
    id: 'rhr',
    question: 'Как изменился утренний пульс покоя за последние 2 недели?',
    options: [
      'Стабилен или снизился',
      'Колеблется на ±2 уд/мин',
      'Периодически выше базы на 3–5 уд',
      'Стабильно выше базы на 5–10 уд',
      'Выше базы на 10+ уд или не знаю свою базу',
    ],
    weight: 1.0,
  },
  {
    id: 'mood',
    question: 'Общий настрой и мотивация к тренировкам',
    options: [
      'Отличный, хочется тренироваться',
      'Хороший, обычная мотивация',
      'Средний, надо заставлять себя',
      'Сниженный, тяжело собраться',
      'Апатия, не хочу видеть спортзал',
    ],
    weight: 1.1,
  },
  {
    id: 'soreness',
    question: 'Мышечная боль / "забитость" в последние 7 дней',
    options: [
      'Нет',
      'Лёгкая, в норме после тренировок',
      'Заметная после каждой тренировки',
      'Сильная, не проходит за 48 часов',
      'Постоянная, даже в дни отдыха',
    ],
    weight: 1.0,
  },
  {
    id: 'hrv',
    question: 'Ваш HRV (если отслеживаете)',
    options: [
      'Стабилен или растёт',
      'Лёгкие колебания',
      'Периодически падает ниже базы',
      'Стабильно ниже базы',
      'Резко упал или не отслеживаю',
    ],
    weight: 1.0,
  },
  {
    id: 'performance',
    question: 'Результаты на привычной тренировке',
    options: [
      'Стали лучше',
      'Такие же',
      'Чуть хуже, но списываю на обстоятельства',
      'Заметно хуже, тяжелее даётся привычная работа',
      'Падение результатов 2+ недели подряд',
    ],
    weight: 1.2,
  },
  {
    id: 'appetite',
    question: 'Аппетит и жажда',
    options: [
      'В норме, тянет на здоровую еду',
      'Почти в норме',
      'Иногда не хочется есть после тренировки',
      'Сниженный или, наоборот, тянет на сладкое/солёное',
      'Постоянно что-то не так, ем по расписанию',
    ],
    weight: 0.7,
  },
  {
    id: 'illness',
    question: 'Болели ли ОРВИ / герпес / аллергия в последние 4 недели?',
    options: [
      'Нет',
      'Лёгкий насморк 1 раз',
      'Да, 1 эпизод с температурой',
      'Да, более 1 раза',
      'Болею сейчас или не проходит',
    ],
    weight: 1.0,
  },
  {
    id: 'concentration',
    question: 'Концентрация и раздражительность',
    options: [
      'В норме',
      'Иногда рассеянность',
      'Чаще обычного срываюсь',
      'Постоянная раздражительность, тяжело сосредоточиться',
      'Туман в голове и апатия',
    ],
    weight: 0.9,
  },
  {
    id: 'joy',
    question: 'Удовольствие от тренировок',
    options: [
      'Получаю кайф',
      'Нормально, как обычно',
      'Иногда тренируюсь "на зубах"',
      'Чаще через силу',
      'Тренировки стали обузой',
    ],
    weight: 0.8,
  },
]

export type OvertrainingLevel = 'green' | 'yellow' | 'orange' | 'red'

export const OT_LEVEL_META: Record<OvertrainingLevel, {
  label: string
  tagline: string
  color: string
  bg: string
  border: string
}> = {
  green:  { label: 'Всё в норме',            tagline: 'Признаков перетренированности нет',     color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  yellow: { label: 'Лёгкая усталость',       tagline: 'Нужна разгрузочная неделя в ближайшее время', color: '#CA8A04', bg: '#FEFCE8', border: '#FDE68A' },
  orange: { label: 'Высокое напряжение',     tagline: 'Риск перетренированности — снизьте объём на 30–40%', color: '#B03D04', bg: '#FEF0E7', border: '#FBC1A0' },
  red:    { label: 'Перетренированность',    tagline: 'Обязательна разгрузка 7+ дней и очная консультация', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
}

export interface OvertrainingResult {
  /** 0–100 */
  score: number
  level: OvertrainingLevel
  breakdown: Array<{ id: string; label: string; contribution: number }>
  recommendations: string[]
}

export function scoreOvertraining(answers: Record<string, number>): OvertrainingResult {
  // Каждый ответ 0..4, weight суммируется. max = sum(weights)*4 = 10 * 4 = 40.
  // Нормализуем в 0..100.
  let raw = 0
  const breakdown: OvertrainingResult['breakdown'] = []
  for (const q of OT_QUESTIONS) {
    const a = Math.max(0, Math.min(4, Number(answers[q.id] ?? 0)))
    const contribution = a * q.weight
    raw += contribution
    breakdown.push({ id: q.id, label: q.question, contribution: Number(contribution.toFixed(1)) })
  }
  const totalWeight = OT_QUESTIONS.reduce((s, q) => s + q.weight, 0)  // = 10
  const maxRaw      = totalWeight * 4                                  // = 40
  const score       = Math.round((raw / maxRaw) * 100)

  let level: OvertrainingLevel = 'green'
  if (score >= 70)      level = 'red'
  else if (score >= 50) level = 'orange'
  else if (score >= 30) level = 'yellow'

  return { score, level, breakdown, recommendations: recommend(level, breakdown) }
}

function recommend(level: OvertrainingLevel, breakdown: OvertrainingResult['breakdown']): string[] {
  const top = [...breakdown].sort((a, b) => b.contribution - a.contribution).slice(0, 3)
  const topIds = top.map(t => t.id)
  const hints: string[] = []

  if (topIds.includes('sleep'))
    hints.push('Сон — ваша главная точка восстановления. Цель: 7–9 часов, ложиться до 23:00 в течение 10 дней подряд.')
  if (topIds.includes('rhr') || topIds.includes('hrv'))
    hints.push('Измеряйте пульс покоя и HRV каждое утро. Рост пульса на 5+ уд/мин от базы — знак не тренироваться в этот день.')
  if (topIds.includes('mood') || topIds.includes('joy'))
    hints.push('Психологическая истощённость опережает физическую. Добавьте 1–2 нетренировочные активности в неделю: прогулка, плавание, йога.')
  if (topIds.includes('soreness') || topIds.includes('performance'))
    hints.push('Болезненность и падение результатов 2+ недели — прямой сигнал к разгрузке. Снизьте интенсивность и объём на 30–40% на 5–7 дней.')
  if (topIds.includes('appetite') || topIds.includes('illness'))
    hints.push('Иммунитет и аппетит снижаются при высоком стрессе. Увеличьте калории (+10–15%), особенно углеводы в день тренировок.')
  if (topIds.includes('concentration'))
    hints.push('Когнитивная усталость — это усталость ЦНС. Помогает медитация 10 мин/день и снижение интенсивности силовой на 2 недели.')

  const base = {
    green:  [
      'Продолжайте в том же ритме. Раз в 4 недели — профилактическая разгрузочная неделя.',
      'Фиксируйте показатели ежедневно (сон, HRV, пульс покоя) — увидите свои индивидуальные пороги.',
    ],
    yellow: [
      'В ближайшие 7 дней плавно снизьте объём на 15–20% и уберите 1 высокоинтенсивную сессию.',
      'Повторите тест через 10 дней: если скор остался или вырос — переходите к жёлто-оранжевому протоколу.',
    ],
    orange: [
      'Разгрузочная неделя обязательна: объём −30–40%, только Z1–Z2, без силовой работы.',
      'Если в течение 10 дней нет улучшения — запишитесь на осмотр у спортивного врача (кровь, щитовидная железа, железо, витамин D).',
    ],
    red: [
      '7–10 дней полного отдыха от структурных тренировок. Допускаются только прогулки и лёгкое плавание.',
      'Обязательно: кровь (ОАК, биохимия, ферритин, ТТГ), консультация спортивного врача.',
      'Не возвращайтесь к нагрузке, пока не пройдут 3 дня подряд с пульсом покоя и настроением на базовом уровне.',
    ],
  }

  return [...hints, ...base[level]]
}
