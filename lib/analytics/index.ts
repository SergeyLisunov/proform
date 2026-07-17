/**
 * lib/analytics — детерминированный движок спортивной аналитики для proform.
 *
 * Чистые функции (без импортов Supabase), тестируемые и переносимые. Дополняет
 * существующий rolling-ACWR (services/acwr.service.ts) недостающим: EWMA-ACWR с
 * гейтом надёжности, монотонность/strain Фостера, Банистер CTL/ATL/TSB,
 * wellness-готовность через z-оценки к личной базе, прогноз достижения целей.
 *
 * Тонкий слой доступа к БД под эти функции живёт отдельно (services/*),
 * по конвенции proform (клиентский @/lib/supabase/client, фильтр по athlete_id).
 */

export {
  buildDailyLoadSeries,
  computeWeeklyLoadStats,
  loadForWorkout,
  type DailyLoad,
  type DailyLoadQuality,
  type DailyLoadSeries,
  type WeeklyLoadStats,
  type WorkoutLoadLike,
} from './load';
export { classifyAcwrZone, computeAcwr, type AcwrResult, type AcwrZone } from './acwr';
export {
  computeFitnessFatigue,
  type FitnessFatigueDay,
  type FitnessFatigueResult,
  type FormTrend,
} from './fitness-fatigue';
export {
  computeWellnessReadiness,
  type WellnessCheckinLike,
  type WellnessMetricKey,
  type WellnessMetricSnapshot,
  type WellnessReadiness,
  type WellnessStatus,
} from './wellness';
export {
  computeGoalForecast,
  inferRule,
  selectGoalPoints,
  type AthleteGoalLike,
  type GoalForecast,
  type GoalForecastStatus,
  type GoalImprovementRule,
  type PersonalRecordPointLike,
} from './goal-forecast';
export {
  buildLoadAnalyticsView,
  computeAthleteAnalytics,
  type AnalyticsCardView,
  type AnalyticsGoalRow,
  type AnalyticsTile,
  type AnalyticsTone,
  type AthleteAnalytics,
  type AthleteAnalyticsInput,
} from './summary';
