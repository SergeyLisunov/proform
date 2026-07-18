import { describe, expect, it } from 'vitest';
import {
  buildDailyLoadSeries,
  computeWeeklyLoadStats,
  loadForWorkout,
  type WorkoutLoadLike,
} from './load';

function w(overrides: Partial<WorkoutLoadLike>): WorkoutLoadLike {
  return { event_date: '2026-07-01', activity_strain: 12, activity_duration_min: 60, ...overrides };
}

describe('loadForWorkout', () => {
  it('uses activity_strain when present', () => {
    expect(loadForWorkout(w({ activity_strain: 14 }))).toBe(14);
  });

  it('falls back to duration * 0.1 when strain is null/zero', () => {
    expect(loadForWorkout(w({ activity_strain: null, activity_duration_min: 90 }))).toBe(9);
    expect(loadForWorkout(w({ activity_strain: 0, activity_duration_min: 50 }))).toBe(5);
  });

  it('returns null when neither strain nor duration is usable', () => {
    expect(loadForWorkout(w({ activity_strain: null, activity_duration_min: null }))).toBeNull();
    expect(loadForWorkout(w({ activity_strain: 0, activity_duration_min: 0 }))).toBeNull();
  });
});

describe('buildDailyLoadSeries', () => {
  it('builds a zero-filled series with per-day sums and firstLoadDate', () => {
    const series = buildDailyLoadSeries(
      [
        w({ event_date: '2026-07-02', activity_strain: 10 }),
        w({ event_date: '2026-07-04', activity_strain: 8 }),
        w({ event_date: '2026-07-04', activity_strain: 5 }),
        w({ event_date: '2026-07-06', activity_strain: null, activity_duration_min: null }), // no load
        w({ event_date: null, activity_strain: 9 }), // no date
        w({ event_date: '2026-06-01', activity_strain: 20 }), // out of window
      ],
      { start: '2026-07-01', end: '2026-07-07' },
    );
    expect(series.days).toHaveLength(7);
    expect(series.days.map((d) => d.load)).toEqual([0, 10, 0, 13, 0, 0, 0]);
    expect(series.firstLoadDate).toBe('2026-07-02');
    expect(series.quality).toEqual({ workoutsTotal: 5, workoutsCounted: 3, workoutsWithoutLoad: 2 });
  });

  it('reports null firstLoadDate for an empty window', () => {
    const series = buildDailyLoadSeries([], { start: '2026-07-01', end: '2026-07-07' });
    expect(series.firstLoadDate).toBeNull();
  });
});

describe('computeWeeklyLoadStats', () => {
  it('computes Foster monotony and strain from raw (unrounded) monotony', () => {
    // three strain-10 days -> daily [0,10,0,10,0,10,0]; mean 4.2857, popSD 4.9487
    // monotony 0.866 -> strain = round(30 * 0.866025) = 26 (not 30*0.87)
    const series = buildDailyLoadSeries(
      ['2026-07-12', '2026-07-14', '2026-07-16'].map((d) => w({ event_date: d, activity_strain: 10 })),
      { start: '2026-07-11', end: '2026-07-17' },
    );
    const stats = computeWeeklyLoadStats(series, '2026-07-17');
    expect(stats.totalLoad).toBe(30);
    expect(stats.trainingDays).toBe(3);
    expect(stats.monotony).toBe(0.87);
    expect(stats.strain).toBe(26);
  });

  it('returns null monotony when every day is identical (SD 0)', () => {
    const series = buildDailyLoadSeries(
      ['11', '12', '13', '14', '15', '16', '17'].map((dd) =>
        w({ event_date: `2026-07-${dd}`, activity_strain: 8 }),
      ),
      { start: '2026-07-11', end: '2026-07-17' },
    );
    const stats = computeWeeklyLoadStats(series, '2026-07-17');
    expect(stats.monotony).toBeNull();
    expect(stats.strain).toBeNull();
  });
});
