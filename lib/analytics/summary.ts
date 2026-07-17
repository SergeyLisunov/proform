/**
 * Композиция движка аналитики + вью-модель для UI.
 *
 * Превращает сырые строки (workouts / wellness_checkins / personal_records /
 * athlete_goals) в один объект AthleteAnalytics, а затем в набор плиток +
 * строк целей с русскими подписями и тонами. Всё детерминированно; зоны ACWR
 * маппятся на существующие ACWR_ZONE_META (lib/acwr/calc) для единообразия с
 * уже показываемым в proform rolling-ACWR.
 */

import { ACWR_ZONE_META, type AcwrZone as AcwrDisplayZone } from '@/lib/acwr/calc';
import { computeAcwr, type AcwrResult, type AcwrZone } from './acwr';
import { addDays } from './dates';
import {
  computeFitnessFatigue,
  type FitnessFatigueDay,
  type FormTrend,
} from './fitness-fatigue';
import {
  buildDailyLoadSeries,
  computeWeeklyLoadStats,
  type DailyLoadSeries,
  type WeeklyLoadStats,
  type WorkoutLoadLike,
} from './load';
import { roundTo } from './math';
import {
  computeGoalForecast,
  type AthleteGoalLike,
  type GoalForecast,
  type GoalForecastStatus,
  type PersonalRecordPointLike,
} from './goal-forecast';
import {
  computeWellnessReadiness,
  type WellnessCheckinLike,
  type WellnessReadiness,
  type WellnessStatus,
} from './wellness';

export type AthleteAnalyticsInput = {
  workouts: WorkoutLoadLike[];
  checkIns: WellnessCheckinLike[];
  records: PersonalRecordPointLike[];
  goals: AthleteGoalLike[];
  /** «Сегодня» для всех окон, YYYY-MM-DD. */
  asOf: string;
  /** Окно истории в днях; 84 (12 недель) по умолчанию. */
  windowDays?: number;
};

export type AthleteAnalytics = {
  asOf: string;
  windowStart: string;
  series: DailyLoadSeries;
  currentWeek: WeeklyLoadStats;
  previousWeek: WeeklyLoadStats;
  weeklyChangePercent: number | null;
  acwr: AcwrResult;
  fitnessFatigue: {
    current: FitnessFatigueDay | null;
    formTrend: FormTrend | null;
  };
  wellness: WellnessReadiness;
  goalForecasts: GoalForecast[];
};

const DEFAULT_WINDOW_DAYS = 84;

export function computeAthleteAnalytics(input: AthleteAnalyticsInput): AthleteAnalytics {
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const asOf = input.asOf.slice(0, 10);
  const windowStart = addDays(asOf, -(windowDays - 1));

  const series = buildDailyLoadSeries(input.workouts, { start: windowStart, end: asOf });
  const currentWeek = computeWeeklyLoadStats(series, asOf);
  const previousWeek = computeWeeklyLoadStats(series, addDays(asOf, -7));

  const weeklyChangePercent =
    previousWeek.totalLoad > 0
      ? roundTo(((currentWeek.totalLoad - previousWeek.totalLoad) / previousWeek.totalLoad) * 100, 1)
      : null;

  const fitnessFatigue = computeFitnessFatigue(series);
  const activeGoals = input.goals.filter((goal) => goal.status === 'active');

  return {
    asOf,
    windowStart,
    series,
    currentWeek,
    previousWeek,
    weeklyChangePercent,
    acwr: computeAcwr(series),
    fitnessFatigue: {
      current: fitnessFatigue.current,
      formTrend: fitnessFatigue.formTrend,
    },
    wellness: computeWellnessReadiness(input.checkIns, asOf),
    goalForecasts: activeGoals.map((goal) => computeGoalForecast(goal, input.records)),
  };
}

/* -------------------------------------------------------------------------- */
/* Presentation                                                                */
/* -------------------------------------------------------------------------- */

export type AnalyticsTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export type AnalyticsTile = {
  key: string;
  label: string;
  value: string;
  hint?: string;
  tone: AnalyticsTone;
};

export type AnalyticsGoalRow = {
  key: string;
  title: string;
  statusLabel: string;
  tone: AnalyticsTone;
  detail?: string;
};

export type AnalyticsCardView =
  | { kind: 'empty'; reason: string }
  | { kind: 'ready'; tiles: AnalyticsTile[]; goals: AnalyticsGoalRow[]; dataQuality: string | null };

// Зоны движка (low/optimal/caution/high) -> зоны proform (ACWR_ZONE_META).
const ACWR_ZONE_TO_DISPLAY: Record<AcwrZone, AcwrDisplayZone> = {
  low: 'detraining',
  optimal: 'optimal',
  caution: 'monitor',
  high: 'danger',
};

const ACWR_DISPLAY_TONE: Record<AcwrDisplayZone, AnalyticsTone> = {
  detraining: 'info',
  optimal: 'success',
  monitor: 'warning',
  danger: 'danger',
  no_data: 'neutral',
};

const WELLNESS_META: Record<Exclude<WellnessStatus, 'not_enough_data'>, { label: string; tone: AnalyticsTone }> = {
  ok: { label: 'Норма', tone: 'success' },
  watch: { label: 'Наблюдать', tone: 'warning' },
  risk: { label: 'Риск', tone: 'danger' },
};

const GOAL_STATUS_META: Record<GoalForecastStatus, { label: string; tone: AnalyticsTone }> = {
  achieved: { label: 'Достигнута', tone: 'success' },
  on_track: { label: 'В графике', tone: 'success' },
  at_risk: { label: 'Под риском', tone: 'warning' },
  off_track: { label: 'Вне графика', tone: 'danger' },
  no_deadline: { label: 'Без дедлайна', tone: 'neutral' },
  not_enough_data: { label: 'Мало данных', tone: 'neutral' },
  unsupported: { label: '', tone: 'neutral' },
};

const FORM_TREND_LABEL: Record<FormTrend, string> = {
  rising: 'форма растёт',
  falling: 'форма падает',
  flat: 'форма стабильна',
};

const MAX_GOAL_TITLE_CHARS = 80;

function formatSigned(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`;
}

function formatValueUnit(value: number, unit: string | null): string {
  return unit ? `${value} ${unit}` : `${value}`;
}

function buildTiles(analytics: AthleteAnalytics): AnalyticsTile[] {
  const tiles: AnalyticsTile[] = [];
  const { currentWeek, previousWeek, weeklyChangePercent, acwr, fitnessFatigue, wellness } =
    analytics;

  if (currentWeek.totalLoad > 0 || previousWeek.totalLoad > 0) {
    const changeHint =
      weeklyChangePercent === null
        ? `${currentWeek.trainingDays} трен. дн.`
        : `${formatSigned(weeklyChangePercent)}% к пред. неделе`;
    const monotonyHigh = currentWeek.monotony !== null && currentWeek.monotony > 2;
    tiles.push({
      key: 'load',
      label: 'Недельная нагрузка',
      value: `${currentWeek.totalLoad} AU`,
      hint: monotonyHigh ? `${changeHint} · монотонность высокая` : changeHint,
      tone: monotonyHigh ? 'warning' : 'neutral',
    });
  }

  const acwrValue = acwr.ewma ?? acwr.rolling;
  // Вырожденное 0.00 (нет свежей нагрузки) не показываем — уводит в пустое состояние.
  if (acwrValue !== null && acwrValue > 0 && acwr.zone !== null) {
    const displayZone = ACWR_ZONE_TO_DISPLAY[acwr.zone];
    tiles.push({
      key: 'acwr',
      label: 'ACWR',
      value: acwrValue.toFixed(2),
      hint: acwr.reliable ? `зона: ${ACWR_ZONE_META[displayZone].label}` : 'мало истории — ориентировочно',
      tone: acwr.reliable ? ACWR_DISPLAY_TONE[displayZone] : 'neutral',
    });
  }

  if (acwr.reliable && fitnessFatigue.current !== null) {
    const form = fitnessFatigue.current.form;
    const tone: AnalyticsTone = form <= -30 ? 'warning' : form >= 25 ? 'info' : 'neutral';
    tiles.push({
      key: 'form',
      label: 'Форма (TSB)',
      value: `${form}`,
      hint: fitnessFatigue.formTrend === null ? undefined : FORM_TREND_LABEL[fitnessFatigue.formTrend],
      tone,
    });
  }

  if (wellness.status !== 'not_enough_data') {
    const w = WELLNESS_META[wellness.status];
    const below = wellness.metrics
      .filter((metric) => metric.zScore <= -1)
      .map((metric) => metric.metric)
      .join(', ');
    const detail = below ? `; ниже нормы: ${below}` : '';
    tiles.push({
      key: 'wellness',
      label: 'Готовность',
      value: w.label,
      hint: wellness.score === null ? undefined : `z=${wellness.score}${detail}`,
      tone: w.tone,
    });
  }

  return tiles;
}

function buildGoalRows(analytics: AthleteAnalytics): AnalyticsGoalRow[] {
  return analytics.goalForecasts
    .filter((forecast) => forecast.status !== 'unsupported')
    .map((forecast) => {
      const meta = GOAL_STATUS_META[forecast.status];
      const title =
        forecast.title.length > MAX_GOAL_TITLE_CHARS
          ? `${forecast.title.slice(0, MAX_GOAL_TITLE_CHARS - 3)}...`
          : forecast.title;
      const parts: string[] = [];
      if (forecast.currentValue !== null && forecast.targetValue !== null) {
        parts.push(
          `${formatValueUnit(forecast.currentValue, forecast.unit)} → цель ${formatValueUnit(forecast.targetValue, forecast.unit)}`,
        );
      }
      if (forecast.predictedAtTargetDate !== null && forecast.targetDate !== null) {
        parts.push(`прогноз ${formatValueUnit(forecast.predictedAtTargetDate, forecast.unit)} к ${forecast.targetDate}`);
      } else if (forecast.expectedDate !== null && forecast.status !== 'on_track') {
        parts.push(`трендовая дата: ${forecast.expectedDate}`);
      }
      return {
        key: forecast.goalId,
        title,
        statusLabel: meta.label,
        tone: meta.tone,
        detail: parts.length > 0 ? parts.join(' · ') : undefined,
      };
    });
}

function buildDataQuality(analytics: AthleteAnalytics): string | null {
  const { quality } = analytics.series;
  return quality.workoutsWithoutLoad > 0
    ? `Качество данных — без нагрузки: ${quality.workoutsWithoutLoad} из ${quality.workoutsTotal} трен.`
    : null;
}

export function buildLoadAnalyticsView(analytics: AthleteAnalytics | null): AnalyticsCardView {
  if (analytics === null) {
    return {
      kind: 'empty',
      reason: 'Недостаточно данных. Фиксируйте тренировки и wellness-чек-ины — метрики появятся автоматически.',
    };
  }
  const tiles = buildTiles(analytics);
  const goals = buildGoalRows(analytics);
  if (tiles.length === 0 && goals.length === 0) {
    return {
      kind: 'empty',
      reason: 'Недостаточно данных за 12 недель. Добавьте тренировки, wellness-чек-ины или результаты.',
    };
  }
  return { kind: 'ready', tiles, goals, dataQuality: buildDataQuality(analytics) };
}
