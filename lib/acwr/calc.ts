/**
 * Pure ACWR calculator — используется на публичной странице /tools/acwr
 * и в клиентском UI. Не зависит от БД/сети.
 *
 * Acute = загрузка за последнюю неделю.
 * Chronic = среднее за последние 4 недели.
 * ACWR = acute / chronic.
 *
 * Sweet spot (наименьший риск травмы по мета-анализам Gabbett/Bourdon):
 *   0.8 – 1.3
 * > 1.5 — повышенный риск травмы.
 * < 0.8 — недотренированность, форма падает.
 */

export type AcwrZone = 'detraining' | 'optimal' | 'monitor' | 'danger' | 'no_data'

export const ACWR_ZONE_META: Record<AcwrZone, {
  label: string
  tagline: string
  color: string
  bg: string
  border: string
}> = {
  detraining: {
    label: 'Недотренированность',
    tagline: 'Нагрузка падает — форма уйдёт через 1–2 недели',
    color: '#CA8A04', bg: '#FEFCE8', border: '#FDE68A',
  },
  optimal: {
    label: 'Оптимальная зона',
    tagline: 'Риск травмы минимальный, прогресс устойчивый',
    color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0',
  },
  monitor: {
    label: 'Следить внимательнее',
    tagline: 'Рост нагрузки слишком быстрый — снизьте темп',
    color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA',
  },
  danger: {
    label: 'Зона травмы',
    tagline: 'Высокий риск травмы — разгрузочная неделя обязательна',
    color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA',
  },
  no_data: {
    label: 'Недостаточно данных',
    tagline: 'Введите нагрузку хотя бы за 2 недели',
    color: '#475569', bg: '#F8FAFC', border: '#E2E8F0',
  },
}

export function zoneOf(acwr: number | null): AcwrZone {
  if (acwr === null || Number.isNaN(acwr)) return 'no_data'
  if (acwr < 0.8) return 'detraining'
  if (acwr <= 1.3) return 'optimal'
  if (acwr <= 1.5) return 'monitor'
  return 'danger'
}

export interface AcwrInput {
  /** Недели от самой ранней к самой поздней: [W-3, W-2, W-1, W-0]. Каждое число — суммарная нагрузка за неделю (минуты × средний RPE, или просто минуты, или Whoop strain). */
  weeks: [number, number, number, number]
}

export interface AcwrResult {
  acute: number
  chronic: number
  acwr: number | null
  zone: AcwrZone
  advice: string[]
}

export function computeAcwr(input: AcwrInput): AcwrResult {
  const [w3, w2, w1, w0] = input.weeks
  const filled = input.weeks.filter(v => v > 0).length
  if (filled < 2) {
    return { acute: 0, chronic: 0, acwr: null, zone: 'no_data', advice: [] }
  }
  const acute   = w0
  const chronic = (w3 + w2 + w1 + w0) / 4
  const acwr    = chronic > 0 ? Number((acute / chronic).toFixed(2)) : null
  const zone    = zoneOf(acwr)
  return {
    acute: Number(acute.toFixed(1)),
    chronic: Number(chronic.toFixed(1)),
    acwr,
    zone,
    advice: adviceFor(zone, acwr, { w3, w2, w1, w0 }),
  }
}

function adviceFor(
  zone: AcwrZone,
  acwr: number | null,
  weeks: { w3: number; w2: number; w1: number; w0: number },
): string[] {
  switch (zone) {
    case 'danger':
      return [
        `ACWR ${acwr?.toFixed(2)} — красная зона. На текущей неделе резкий скачок объёма.`,
        'Ближайшие 5–7 дней сократите объём на 30–40% и добавьте 2 дня полного восстановления.',
        'Следите за сном (цель 7+ часов), HRV (не должен падать) и резким ростом пульса покоя.',
        'Если появляются "нытья" в связках/сухожилиях — это первый сигнал. Берите выходной без колебаний.',
      ]
    case 'monitor':
      return [
        `ACWR ${acwr?.toFixed(2)} — жёлтая зона. Рост нагрузки слишком быстрый.`,
        'Следующую неделю не увеличивайте объём более чем на 10%. Правило "10%" — проверенный safety-net.',
        'Раз в неделю вставьте лёгкую восстановительную тренировку (Z1–Z2 не более 45 мин).',
        'Фиксируйте субъективную усталость по шкале 1–10 каждый вечер: если 3 дня подряд ≥ 7 — разгрузка.',
      ]
    case 'optimal':
      return [
        `ACWR ${acwr?.toFixed(2)} — зелёная зона. Держите текущий паттерн.`,
        'Плавный рост: следующую неделю можно на 5–10% больше, если самочувствие позволяет.',
        'Раз в 3–4 недели планируйте разгрузочную неделю (−20–30% объёма).',
        'Ведите короткий дневник — за месяц увидите свою индивидуальную норму ACWR.',
      ]
    case 'detraining':
      return [
        `ACWR ${acwr?.toFixed(2)} — нагрузка ниже базы. Форма начнёт падать через 10–14 дней.`,
        'Верните хотя бы 2 качественные тренировки в неделю (например, интервал + длительная).',
        'Если это спланированная разгрузка после соревнования — всё в порядке; фиксируйте в дневнике.',
        'Иначе — вернитесь к недельному объёму ~' + Math.max(weeks.w3, weeks.w2, weeks.w1).toFixed(0) + ' в ближайшие 2 недели.',
      ]
    case 'no_data':
      return ['Введите нагрузку хотя бы за 2 недели, чтобы получить содержательный ACWR.']
  }
}
