/**
 * Готовность (readiness) по ежедневным wellness-чек-инам proform.
 *
 * Каждая метрика сравнивается с ЛИЧНОЙ базой спортсмена (mean/SD за 28 дней)
 * как z-оценка — работает при любой шкале. energy/mood/sleep_quality/sleep_hours
 * «выше = лучше»; soreness (0–10) «выше = ХУЖЕ», поэтому её z инвертируется,
 * чтобы во всех метриках отрицательный z означал «ниже нормы».
 *
 * Полностью новое для proform: раньше wellness был только CRUD + средние без
 * персональной базы, z-оценок и гейта надёжности.
 */

import { addDays } from './dates';
import { mean, populationSd, roundTo } from './math';

export type WellnessCheckinLike = {
  date: string;
  energy: number | null;
  mood: number | null;
  sleep_quality: number | null;
  sleep_hours: number | null;
  soreness: number | null;
};

export type WellnessStatus = 'ok' | 'watch' | 'risk' | 'not_enough_data';

export type WellnessMetricKey = 'energy' | 'mood' | 'sleep_quality' | 'sleep_hours' | 'soreness';

export type WellnessMetricSnapshot = {
  metric: WellnessMetricKey;
  today: number;
  baselineMean: number;
  /** Уже с учётом направления: отрицательный z = «хуже личной нормы». */
  zScore: number;
};

export type WellnessReadiness = {
  status: WellnessStatus;
  /** Средний z по доступным метрикам; отрицательный = ниже личной базы. */
  score: number | null;
  metrics: WellnessMetricSnapshot[];
  /** Дата чек-ина, взятого за «сегодня» (в пределах 2 дней от asOf), или null. */
  checkinDate: string | null;
  baselineCheckins: number;
};

const BASELINE_DAYS = 28;
const MIN_BASELINE_CHECKINS = 7;
const MIN_METRIC_SAMPLES = 5;
/** Пол СКО — держит z в узде, когда база почти константна. */
const SD_FLOOR = 0.5;
const WATCH_THRESHOLD = -0.5;
const RISK_THRESHOLD = -1.5;

// direction: +1 — выше лучше; -1 — выше хуже (инверсия z).
const METRICS: Array<{ key: WellnessMetricKey; direction: 1 | -1 }> = [
  { key: 'energy', direction: 1 },
  { key: 'mood', direction: 1 },
  { key: 'sleep_quality', direction: 1 },
  { key: 'sleep_hours', direction: 1 },
  { key: 'soreness', direction: -1 },
];

function isFiniteNumber(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function computeWellnessReadiness(
  checkIns: WellnessCheckinLike[],
  asOf: string,
): WellnessReadiness {
  const sorted = checkIns
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date));

  const earliestToday = addDays(asOf, -2);
  const today = [...sorted]
    .reverse()
    .find((checkin) => checkin.date >= earliestToday && checkin.date <= asOf);

  const empty: WellnessReadiness = {
    status: 'not_enough_data',
    score: null,
    metrics: [],
    checkinDate: today?.date ?? null,
    baselineCheckins: 0,
  };

  if (!today) {
    return empty;
  }

  const baselineStart = addDays(today.date, -BASELINE_DAYS);
  const baseline = sorted.filter(
    (checkin) => checkin.date >= baselineStart && checkin.date < today.date,
  );

  if (baseline.length < MIN_BASELINE_CHECKINS) {
    return { ...empty, baselineCheckins: baseline.length };
  }

  const metrics: WellnessMetricSnapshot[] = [];
  for (const { key, direction } of METRICS) {
    const todayValue = today[key];
    if (!isFiniteNumber(todayValue)) {
      continue;
    }
    const history = baseline.map((checkin) => checkin[key]).filter(isFiniteNumber);
    if (history.length < MIN_METRIC_SAMPLES) {
      continue;
    }
    const baselineMean = mean(history);
    const baselineSd = populationSd(history);
    if (baselineMean === null || baselineSd === null) {
      continue;
    }
    const sd = Math.max(baselineSd, SD_FLOOR);
    metrics.push({
      metric: key,
      today: todayValue,
      baselineMean: roundTo(baselineMean, 2),
      zScore: roundTo((direction * (todayValue - baselineMean)) / sd, 2),
    });
  }

  if (metrics.length === 0) {
    return { ...empty, baselineCheckins: baseline.length };
  }

  const score = roundTo(
    metrics.reduce((sum, metric) => sum + metric.zScore, 0) / metrics.length,
    2,
  );

  let status: WellnessStatus;
  if (score >= WATCH_THRESHOLD) {
    status = 'ok';
  } else if (score >= RISK_THRESHOLD) {
    status = 'watch';
  } else {
    status = 'risk';
  }

  return {
    status,
    score,
    metrics,
    checkinDate: today.date,
    baselineCheckins: baseline.length,
  };
}
