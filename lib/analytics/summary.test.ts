import { describe, expect, it } from 'vitest';
import type { WorkoutLoadLike } from './load';
import type { WellnessCheckinLike } from './wellness';
import { buildLoadAnalyticsView, computeAthleteAnalytics } from './summary';

const AS_OF = '2026-07-17';

function dateOffset(offset: number): string {
  const d = new Date(`${AS_OF}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function dailyWorkouts(days: number, strain = 10): WorkoutLoadLike[] {
  return Array.from({ length: days }, (_, i) => ({
    event_date: dateOffset(-i),
    activity_strain: strain,
    activity_duration_min: 60,
  }));
}

function dailyCheckins(days: number): WellnessCheckinLike[] {
  return Array.from({ length: days }, (_, i) => ({
    date: dateOffset(-i),
    energy: 4,
    mood: 4,
    sleep_quality: 4,
    sleep_hours: 8,
    soreness: 2,
  }));
}

describe('computeAthleteAnalytics + buildLoadAnalyticsView', () => {
  it('composes a ready view for a steady block', () => {
    const analytics = computeAthleteAnalytics({
      workouts: dailyWorkouts(28),
      checkIns: dailyCheckins(14),
      records: [],
      goals: [],
      asOf: AS_OF,
      windowDays: 28,
    });
    expect(analytics.acwr.reliable).toBe(true);
    const view = buildLoadAnalyticsView(analytics);
    expect(view.kind).toBe('ready');
    if (view.kind !== 'ready') return;
    const keys = view.tiles.map((t) => t.key);
    expect(keys).toContain('load');
    expect(keys).toContain('acwr');
    expect(keys).toContain('form');
    expect(keys).toContain('wellness');
    expect(view.tiles.find((t) => t.key === 'acwr')?.tone).toBe('success');
    expect(view.tiles.find((t) => t.key === 'wellness')?.value).toBe('Норма');
  });

  it('returns empty view when there is no data', () => {
    const analytics = computeAthleteAnalytics({
      workouts: [],
      checkIns: [],
      records: [],
      goals: [],
      asOf: AS_OF,
    });
    expect(buildLoadAnalyticsView(analytics).kind).toBe('empty');
  });

  it('falls back to empty for a near-idle athlete (degenerate ACWR)', () => {
    const analytics = computeAthleteAnalytics({
      workouts: [{ event_date: dateOffset(-60), activity_strain: 12, activity_duration_min: 60 }],
      checkIns: [],
      records: [],
      goals: [],
      asOf: AS_OF,
      windowDays: 84,
    });
    expect(buildLoadAnalyticsView(analytics).kind).toBe('empty');
  });

  it('shows an ACWR reliability caveat for a new athlete with recent load', () => {
    const analytics = computeAthleteAnalytics({
      workouts: dailyWorkouts(5, 14),
      checkIns: [],
      records: [],
      goals: [],
      asOf: AS_OF,
      windowDays: 84,
    });
    const view = buildLoadAnalyticsView(analytics);
    if (view.kind !== 'ready') throw new Error('expected ready');
    const acwr = view.tiles.find((t) => t.key === 'acwr');
    expect(acwr?.tone).toBe('neutral');
    expect(acwr?.hint).toContain('мало истории');
  });
});
