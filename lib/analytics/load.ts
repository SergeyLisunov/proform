/**
 * Тренировочная нагрузка по данным proform.
 *
 * В `workouts` НЕТ поля RPE, поэтому нагрузку берём той же формулой, что и
 * существующий services/acwr.service.ts, чтобы EWMA-ACWR и Банистер были
 * согласованы с уже показываемым в UI rolling-ACWR:
 *   load = activity_strain (Whoop 0–21), а при пустом strain —
 *          activity_duration_min * 0.1 (грубый прокси для ручных тренировок).
 */

import { addDays, listDatesInclusive } from './dates';
import { mean, populationSd, roundTo } from './math';

export type WorkoutLoadLike = {
  event_date: string | null;
  activity_strain: number | null;
  activity_duration_min: number | null;
};

/** Множитель для перевода минут в единицы нагрузки, когда strain недоступен. */
const DURATION_LOAD_FACTOR = 0.1;

/** Нагрузка одной тренировки, или null, если нечего посчитать. */
export function loadForWorkout(workout: WorkoutLoadLike): number | null {
  if (workout.activity_strain != null && workout.activity_strain > 0) {
    return workout.activity_strain;
  }
  if (workout.activity_duration_min != null && workout.activity_duration_min > 0) {
    return workout.activity_duration_min * DURATION_LOAD_FACTOR;
  }
  return null;
}

export type DailyLoad = {
  date: string;
  load: number;
};

export type DailyLoadQuality = {
  workoutsTotal: number;
  workoutsCounted: number;
  /** Тренировки без даты или без strain/длительности — не попали в нагрузку. */
  workoutsWithoutLoad: number;
};

export type DailyLoadSeries = {
  start: string;
  end: string;
  /** Непрерывный ряд по дням от start до end включительно (нули — дни без нагрузки). */
  days: DailyLoad[];
  /**
   * Первая дата с реальной нагрузкой (или null). Отличает «28 дней реальной
   * истории» от zero-filled окна — ряд всегда покрывает всё окно, поэтому его
   * длина сама по себе о стаже ничего не говорит.
   */
  firstLoadDate: string | null;
  quality: DailyLoadQuality;
};

export type WeeklyLoadStats = {
  weekStart: string;
  weekEnd: string;
  totalLoad: number;
  trainingDays: number;
  /** Монотонность Фостера = mean/SD дневных нагрузок; null при SD=0 или неполном окне. */
  monotony: number | null;
  /** Strain Фостера = недельная нагрузка × монотонность. */
  strain: number | null;
};

export function buildDailyLoadSeries(
  workouts: WorkoutLoadLike[],
  { start, end }: { start: string; end: string },
): DailyLoadSeries {
  const totals = new Map<string, number>();
  const quality: DailyLoadQuality = {
    workoutsTotal: 0,
    workoutsCounted: 0,
    workoutsWithoutLoad: 0,
  };

  for (const workout of workouts) {
    if (!workout.event_date) {
      quality.workoutsTotal += 1;
      quality.workoutsWithoutLoad += 1;
      continue;
    }
    const date = workout.event_date.slice(0, 10);
    if (date < start || date > end) {
      continue;
    }
    quality.workoutsTotal += 1;
    const load = loadForWorkout(workout);
    if (load === null) {
      quality.workoutsWithoutLoad += 1;
      continue;
    }
    quality.workoutsCounted += 1;
    totals.set(date, (totals.get(date) ?? 0) + load);
  }

  const days = listDatesInclusive(start, end).map((date) => ({
    date,
    load: totals.get(date) ?? 0,
  }));

  const firstLoadDate =
    totals.size > 0 ? [...totals.keys()].sort((a, b) => a.localeCompare(b))[0] : null;

  return { start, end, days, firstLoadDate, quality };
}

/**
 * Недельные суммы + монотонность/strain Фостера за 7 дней, кончая `weekEnd`.
 * Монотонности нужно полное 7-дневное окно внутри ряда, иначе null.
 */
export function computeWeeklyLoadStats(series: DailyLoadSeries, weekEnd: string): WeeklyLoadStats {
  const weekStart = addDays(weekEnd, -6);
  const loads = series.days
    .filter((day) => day.date >= weekStart && day.date <= weekEnd)
    .map((day) => day.load);

  const totalLoad = roundTo(loads.reduce((sum, load) => sum + load, 0), 1);
  const trainingDays = loads.filter((load) => load > 0).length;

  let monotonyRaw: number | null = null;
  if (loads.length === 7) {
    const avg = mean(loads);
    const sd = populationSd(loads);
    if (avg !== null && sd !== null && sd > 0) {
      monotonyRaw = avg / sd;
    }
  }

  const monotony = monotonyRaw === null ? null : roundTo(monotonyRaw, 2);
  // Умножаем на неокруглённую монотонность — двойное округление искажает strain.
  const strain = monotonyRaw === null ? null : roundTo(totalLoad * monotonyRaw, 0);

  return { weekStart, weekEnd, totalLoad, trainingDays, monotony, strain };
}
