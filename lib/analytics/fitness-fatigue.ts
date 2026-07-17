/**
 * Модель Банистера (impulse-response) в параметризации PMC:
 *
 *   fitness (CTL) — EWMA дневной нагрузки, постоянная времени 42 дня
 *   fatigue (ATL) — EWMA дневной нагрузки, постоянная времени 7 дней
 *   form   (TSB)  — вчерашний fitness минус вчерашняя fatigue
 *
 * Положительная форма = свежесть; сильно отрицательная = накопленная усталость.
 * Значения в тех же единицах, что и ряд нагрузки, и осмысленны относительно
 * истории самого спортсмена, а не между спортсменами. Полностью новое для
 * proform — раньше CTL/ATL/TSB нигде не считались.
 */

import type { DailyLoadSeries } from './load';
import { roundTo } from './math';

export type FitnessFatigueDay = {
  date: string;
  fitness: number;
  fatigue: number;
  form: number;
};

export type FormTrend = 'rising' | 'falling' | 'flat';

export type FitnessFatigueResult = {
  days: FitnessFatigueDay[];
  current: FitnessFatigueDay | null;
  /** Направление `form` за последние 7 дней. */
  formTrend: FormTrend | null;
};

const FITNESS_TIME_CONSTANT = 42;
const FATIGUE_TIME_CONSTANT = 7;
const FLAT_FORM_DELTA = 5;

export function computeFitnessFatigue(series: DailyLoadSeries): FitnessFatigueResult {
  const days: FitnessFatigueDay[] = [];
  let fitness = 0;
  let fatigue = 0;

  for (const day of series.days) {
    const form = roundTo(fitness - fatigue, 1);
    fitness += (day.load - fitness) / FITNESS_TIME_CONSTANT;
    fatigue += (day.load - fatigue) / FATIGUE_TIME_CONSTANT;
    days.push({
      date: day.date,
      fitness: roundTo(fitness, 1),
      fatigue: roundTo(fatigue, 1),
      form,
    });
  }

  const current = days.length > 0 ? days[days.length - 1] : null;

  let formTrend: FormTrend | null = null;
  if (days.length >= 8) {
    const weekAgo = days[days.length - 8];
    const delta = days[days.length - 1].form - weekAgo.form;
    if (Math.abs(delta) <= FLAT_FORM_DELTA) {
      formTrend = 'flat';
    } else {
      formTrend = delta > 0 ? 'rising' : 'falling';
    }
  }

  return { days, current, formTrend };
}
