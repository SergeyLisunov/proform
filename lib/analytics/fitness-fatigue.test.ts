import { describe, expect, it } from 'vitest';
import { computeFitnessFatigue } from './fitness-fatigue';
import type { DailyLoadSeries } from './load';

function seriesFromLoads(loads: number[]): DailyLoadSeries {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const dateAt = (i: number) => new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10);
  return {
    start: '2026-01-01',
    end: dateAt(loads.length - 1),
    days: loads.map((load, i) => ({ date: dateAt(i), load })),
    firstLoadDate: loads.some((l) => l > 0) ? '2026-01-01' : null,
    quality: { workoutsTotal: 0, workoutsCounted: 0, workoutsWithoutLoad: 0 },
  };
}

describe('computeFitnessFatigue', () => {
  it('computes exact CTL/ATL/TSB recursion for a tiny series', () => {
    // day1: form 0; fitness 42/42=1; fatigue 42/7=6
    // day2: form 1-6=-5; fitness ~1.0; fatigue 6-6/7 -> 5.1
    const { days, current } = computeFitnessFatigue(seriesFromLoads([42, 0]));
    expect(days[0]).toMatchObject({ form: 0, fitness: 1, fatigue: 6 });
    expect(current).toMatchObject({ form: -5, fitness: 1, fatigue: 5.1 });
  });

  it('shows positive form (freshness) after a taper', () => {
    const { current, formTrend } = computeFitnessFatigue(
      seriesFromLoads([...Array(28).fill(12), ...Array(7).fill(0)]),
    );
    expect(current!.form).toBeGreaterThan(0);
    expect(formTrend).toBe('rising');
  });

  it('returns null trend for a short series', () => {
    expect(computeFitnessFatigue(seriesFromLoads([12, 12])).formTrend).toBeNull();
  });
});
