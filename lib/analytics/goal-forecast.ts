/**
 * Детерминированный прогноз достижения целей по истории результатов.
 *
 * Строит МНК-тренд по ряду результатов метрики и проецирует на дату цели —
 * отвечает на «при текущем темпе успеет ли?», а не «что физиологически
 * возможно». Новое для proform: раньше цели показывали только
 * current/target в процентах, без тренда/ETA.
 *
 * Особенности proform:
 *  - в `athlete_goals` НЕТ поля направления — выводим из target vs current_value
 *    (цель ниже текущего → «меньше лучше», иначе «больше лучше»);
 *  - ряд результатов берём из `personal_records` (value по achieved_at),
 *    сопоставляя по метрике; текущее значение — из goal.current_value.
 */

import { addDays, daysBetween } from './dates';
import { fitLine, roundTo } from './math';

export type GoalImprovementRule = 'higher_is_better' | 'lower_is_better';

export type AthleteGoalLike = {
  id: string;
  title: string;
  metric: string | null;
  target_value: number | null;
  target_unit: string | null;
  target_date: string | null;
  current_value: number | null;
  status: string;
};

export type PersonalRecordPointLike = {
  achieved_at: string;
  metric: string | null;
  value: number | null;
};

export type GoalForecastStatus =
  | 'achieved'
  | 'on_track'
  | 'at_risk'
  | 'off_track'
  | 'no_deadline'
  | 'not_enough_data'
  | 'unsupported';

export type GoalForecast = {
  goalId: string;
  title: string;
  unit: string | null;
  status: GoalForecastStatus;
  currentValue: number | null;
  targetValue: number | null;
  targetDate: string | null;
  rule: GoalImprovementRule | null;
  /** Прогнозное значение метрики на дату цели (линейный тренд). */
  predictedAtTargetDate: number | null;
  /** Дата, когда тренд достигает цели, если достигает. */
  expectedDate: string | null;
  slopePerWeek: number | null;
  pointsUsed: number;
};

const MIN_POINTS = 3;
const MIN_SPAN_DAYS = 14;
const AT_RISK_GRACE_DAYS = 21;
const FLAT_SLOPE_EPSILON = 1e-9;
const MAX_FORECAST_HORIZON_DAYS = 730;

function normalizeKey(value: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Направление цели. В athlete_goals нет явного поля, а METRIC_PRESETS его не
 * несут (weight_kg двусмыслен), поэтому выводим из target vs current: у активной
 * цели текущее значение обычно на «ещё не достигнутой» стороне, и вывод верен.
 * Настоящее достижение фиксируется полем goal.status='achieved' (движок обрабатывает
 * только активные цели), поэтому детект achieved здесь — лишь страховка на равенстве.
 */
export function inferRule(goal: AthleteGoalLike): GoalImprovementRule | null {
  if (goal.target_value === null) return null;
  if (goal.current_value !== null && goal.current_value !== goal.target_value) {
    return goal.target_value < goal.current_value ? 'lower_is_better' : 'higher_is_better';
  }
  // Без current_value направление неизвестно — считаем «больше лучше» (частый случай).
  return 'higher_is_better';
}

function meetsTarget(value: number, target: number, rule: GoalImprovementRule): boolean {
  return rule === 'lower_is_better' ? value <= target : value >= target;
}

export function selectGoalPoints(
  goal: AthleteGoalLike,
  records: PersonalRecordPointLike[],
): PersonalRecordPointLike[] {
  const goalMetric = normalizeKey(goal.metric);
  return records
    .filter((record) => {
      if (record.value === null) return false;
      if (goalMetric && normalizeKey(record.metric) !== goalMetric) return false;
      return true;
    })
    .slice()
    .sort((left, right) => left.achieved_at.localeCompare(right.achieved_at));
}

export function computeGoalForecast(
  goal: AthleteGoalLike,
  records: PersonalRecordPointLike[],
): GoalForecast {
  const points = selectGoalPoints(goal, records);
  const rule = inferRule(goal);
  // Текущее значение: последний результат из ряда, иначе current_value самой цели.
  const currentValue =
    points.length > 0 ? points[points.length - 1].value : goal.current_value;

  const base: GoalForecast = {
    goalId: goal.id,
    title: goal.title,
    unit: goal.target_unit,
    status: 'not_enough_data',
    currentValue,
    targetValue: goal.target_value,
    targetDate: goal.target_date,
    rule,
    predictedAtTargetDate: null,
    expectedDate: null,
    slopePerWeek: null,
    pointsUsed: points.length,
  };

  if (goal.target_value === null || rule === null) {
    return { ...base, status: 'unsupported' };
  }

  if (currentValue !== null && meetsTarget(currentValue, goal.target_value, rule)) {
    return { ...base, status: 'achieved' };
  }

  if (points.length < MIN_POINTS) {
    return base;
  }

  const firstDate = points[0].achieved_at;
  const lastDate = points[points.length - 1].achieved_at;
  if (daysBetween(firstDate, lastDate) < MIN_SPAN_DAYS) {
    return base;
  }

  const fit = fitLine(
    points.map((point) => ({
      x: daysBetween(firstDate, point.achieved_at),
      y: point.value as number,
    })),
  );
  if (fit === null) {
    return base;
  }

  const slopePerWeek = roundTo(fit.slope * 7, 3);
  const movingTowardTarget =
    rule === 'lower_is_better' ? fit.slope < -FLAT_SLOPE_EPSILON : fit.slope > FLAT_SLOPE_EPSILON;

  if (!movingTowardTarget) {
    return { ...base, slopePerWeek, status: 'off_track' };
  }

  const lastDay = daysBetween(firstDate, lastDate);
  const crossingDay = Math.ceil((goal.target_value - fit.intercept) / fit.slope);
  const hasMeaningfulCrossing =
    Number.isFinite(crossingDay) &&
    crossingDay > lastDay &&
    crossingDay <= lastDay + MAX_FORECAST_HORIZON_DAYS;
  const expectedDate = hasMeaningfulCrossing ? addDays(firstDate, crossingDay) : null;

  if (goal.target_date === null) {
    return { ...base, slopePerWeek, expectedDate, status: 'no_deadline' };
  }

  const targetDay = daysBetween(firstDate, goal.target_date);
  const predictedAtTargetDate = roundTo(fit.intercept + fit.slope * targetDay, 3);

  let status: GoalForecastStatus;
  if (!hasMeaningfulCrossing) {
    status = 'off_track';
  } else if (crossingDay <= targetDay) {
    status = 'on_track';
  } else if (crossingDay <= targetDay + AT_RISK_GRACE_DAYS) {
    status = 'at_risk';
  } else {
    status = 'off_track';
  }

  return { ...base, slopePerWeek, expectedDate, predictedAtTargetDate, status };
}
