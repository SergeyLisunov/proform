/**
 * Загрузчик данных для движка аналитики (lib/analytics).
 *
 * Тонкий слой поверх Supabase по конвенции proform: клиентский
 * @/lib/supabase/client, резолв текущего пользователя через users.auth_id,
 * фильтр по athlete_id (RLS изолирует чтение тренером связанных атлетов).
 * Всю арифметику делает движок — здесь только выборка и маппинг строк.
 *
 * Даёт то, чего в proform ещё не было: единый непрерывный дневной ряд нагрузки
 * + wellness + цели за 12 недель, готовый для EWMA-ACWR / Банистера /
 * z-оценок готовности / прогноза целей.
 */

import { createClient } from '@/lib/supabase/client';
import {
  computeAthleteAnalytics,
  type AthleteAnalytics,
  type AthleteAnalyticsInput,
} from '@/lib/analytics';

const WINDOW_DAYS = 84;
/** Wellness-базе нужно ещё 28 дней до начала окна нагрузки. */
const WELLNESS_LOOKBACK_DAYS = WINDOW_DAYS + 28;

function isoDaysAgo(asOf: string, days: number): string {
  const d = new Date(`${asOf}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Собирает вход движка для конкретного атлета (по athlete_id = users.id).
 * Возвращает null, если у атлета нет ни одной релевантной строки.
 */
export async function loadAthleteAnalyticsInput(
  athleteId: string,
  asOf: string = today(),
): Promise<AthleteAnalyticsInput | null> {
  const sb = createClient();
  const windowStart = isoDaysAgo(asOf, WINDOW_DAYS - 1);
  const wellnessStart = isoDaysAgo(asOf, WELLNESS_LOOKBACK_DAYS);

  const [workoutsRes, checkinsRes, recordsRes, goalsRes] = await Promise.all([
    sb
      .from('workouts')
      .select('event_date, activity_strain, activity_duration_min')
      .eq('athlete_id', athleteId)
      .gte('event_date', windowStart)
      .lte('event_date', asOf),
    sb
      .from('wellness_checkins')
      .select('date, energy, mood, sleep_quality, sleep_hours, soreness')
      .eq('athlete_id', athleteId)
      .gte('date', wellnessStart)
      .lte('date', asOf),
    sb
      .from('personal_records')
      .select('achieved_at, metric, value')
      .eq('athlete_id', athleteId),
    sb
      .from('athlete_goals')
      .select('id, metric, metric_label, target_value, target_unit, target_date, current_value, status')
      .eq('athlete_id', athleteId)
      .eq('status', 'active'),
  ]);

  const workouts = (workoutsRes.data ?? []).map((w) => ({
    event_date: w.event_date,
    activity_strain: w.activity_strain,
    activity_duration_min: w.activity_duration_min,
  }));
  const checkIns = (checkinsRes.data ?? []).map((c) => ({
    date: c.date,
    energy: c.energy,
    mood: c.mood,
    sleep_quality: c.sleep_quality,
    sleep_hours: c.sleep_hours,
    soreness: c.soreness,
  }));
  const records = (recordsRes.data ?? []).map((r) => ({
    achieved_at: r.achieved_at,
    metric: r.metric,
    value: r.value,
  }));
  const goals = (goalsRes.data ?? []).map((g) => ({
    id: g.id,
    // metric_label человекочитаемее — используем его как заголовок цели.
    title: g.metric_label ?? g.metric ?? 'Цель',
    metric: g.metric,
    target_value: g.target_value,
    target_unit: g.target_unit,
    target_date: g.target_date,
    current_value: g.current_value,
    status: g.status,
  }));

  if (
    workouts.length === 0 &&
    checkIns.length === 0 &&
    records.length === 0 &&
    goals.length === 0
  ) {
    return null;
  }

  return { workouts, checkIns, records, goals, asOf, windowDays: WINDOW_DAYS };
}

/** Готовая аналитика по атлету (или null, если данных нет). */
export async function getAthleteAnalytics(
  athleteId: string,
  asOf: string = today(),
): Promise<AthleteAnalytics | null> {
  const input = await loadAthleteAnalyticsInput(athleteId, asOf);
  return input ? computeAthleteAnalytics(input) : null;
}

/** Аналитика для текущего залогиненного атлета (по auth → users.id). */
export async function getMyAnalytics(asOf: string = today()): Promise<AthleteAnalytics | null> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return null;
  const { data: meRow } = await sb
    .from('users')
    .select('id')
    .eq('auth_id', auth.user.id)
    .maybeSingle();
  const me = meRow as { id: string } | null;
  if (!me) return null;
  return getAthleteAnalytics(me.id, asOf);
}
