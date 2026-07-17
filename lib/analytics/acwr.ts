/**
 * Acute:Chronic Workload Ratio (ACWR) по дневному ряду нагрузки.
 *
 * Два варианта:
 *  - rolling: среднее за 7 дней / среднее за 28 дней (как в существующем
 *    services/acwr.service.ts);
 *  - ewma: экспоненциально взвешенные средние (Williams et al., 2017),
 *    lambda = 2/(N+1) — основной сигнал.
 *
 * Улучшение над существующим ACWR: гейт надёжности `reliable` = false, пока не
 * накоплено 28 реальных дней истории И хроническая нагрузка непустая. Это
 * убирает ложные «зоны риска» у новичков (у которых острая EWMA разгоняется
 * с нуля).
 */

import { daysBetween } from './dates';
import type { DailyLoadSeries } from './load';
import { mean, roundTo } from './math';

export type AcwrZone = 'low' | 'optimal' | 'caution' | 'high';

export type AcwrResult = {
  /** EWMA-отношение — основной сигнал. */
  ewma: number | null;
  /** Rolling-отношение — вторичное, для сверки. */
  rolling: number | null;
  zone: AcwrZone | null;
  /** Средняя дневная нагрузка за 7 дней. */
  acuteDailyMean: number | null;
  /** Средняя дневная нагрузка за 28 дней. */
  chronicDailyMean: number | null;
  reliable: boolean;
};

const ACUTE_DAYS = 7;
const CHRONIC_DAYS = 28;
const LAMBDA_ACUTE = 2 / (ACUTE_DAYS + 1);
const LAMBDA_CHRONIC = 2 / (CHRONIC_DAYS + 1);

/** Ниже этой средней хронической нагрузки отношение — численный шум. */
const MIN_CHRONIC_DAILY_LOAD = 10;

const ZONE_LOW_MAX = 0.8;
const ZONE_OPTIMAL_MAX = 1.3;
const ZONE_CAUTION_MAX = 1.5;

export function classifyAcwrZone(ratio: number): AcwrZone {
  if (ratio < ZONE_LOW_MAX) return 'low';
  if (ratio <= ZONE_OPTIMAL_MAX) return 'optimal';
  if (ratio <= ZONE_CAUTION_MAX) return 'caution';
  return 'high';
}

function ewmaSeries(loads: number[], lambda: number): number[] {
  const result: number[] = [];
  for (let index = 0; index < loads.length; index += 1) {
    if (index === 0) {
      result.push(loads[0]);
      continue;
    }
    result.push(lambda * loads[index] + (1 - lambda) * result[index - 1]);
  }
  return result;
}

export function computeAcwr(series: DailyLoadSeries): AcwrResult {
  const loads = series.days.map((day) => day.load);

  const acuteWindow = loads.slice(-ACUTE_DAYS);
  const chronicWindow = loads.slice(-CHRONIC_DAYS);
  const acuteDailyMean = mean(acuteWindow);
  const chronicDailyMean = mean(chronicWindow);

  // История считается от первой РЕАЛЬНОЙ тренировки, а не от длины ряда:
  // ряд всегда добит нулями до всего окна.
  const hasHistory =
    series.firstLoadDate !== null &&
    daysBetween(series.firstLoadDate, series.end) + 1 >= CHRONIC_DAYS;
  const reliable =
    hasHistory && chronicDailyMean !== null && chronicDailyMean >= MIN_CHRONIC_DAILY_LOAD;

  let rolling: number | null = null;
  if (acuteDailyMean !== null && chronicDailyMean !== null && chronicDailyMean > 0) {
    rolling = roundTo(acuteDailyMean / chronicDailyMean, 2);
  }

  let ewma: number | null = null;
  if (loads.length > 0) {
    const acuteEwma = ewmaSeries(loads, LAMBDA_ACUTE);
    const chronicEwma = ewmaSeries(loads, LAMBDA_CHRONIC);
    const lastChronic = chronicEwma[chronicEwma.length - 1];
    if (lastChronic > 0) {
      ewma = roundTo(acuteEwma[acuteEwma.length - 1] / lastChronic, 2);
    }
  }

  const primary = ewma ?? rolling;
  const zone = primary === null ? null : classifyAcwrZone(primary);

  return {
    ewma,
    rolling,
    zone,
    acuteDailyMean: acuteDailyMean === null ? null : roundTo(acuteDailyMean, 1),
    chronicDailyMean: chronicDailyMean === null ? null : roundTo(chronicDailyMean, 1),
    reliable,
  };
}
