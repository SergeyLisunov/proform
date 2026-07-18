import { describe, expect, it } from 'vitest';
import { classifyAcwrZone, computeAcwr } from './acwr';
import type { DailyLoadSeries } from './load';

function seriesFromLoads(loads: number[]): DailyLoadSeries {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const dateAt = (i: number) => new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10);
  const firstLoadIndex = loads.findIndex((l) => l > 0);
  return {
    start: '2026-01-01',
    end: dateAt(loads.length - 1),
    days: loads.map((load, i) => ({ date: dateAt(i), load })),
    firstLoadDate: firstLoadIndex === -1 ? null : dateAt(firstLoadIndex),
    quality: { workoutsTotal: 0, workoutsCounted: 0, workoutsWithoutLoad: 0 },
  };
}

describe('classifyAcwrZone', () => {
  it('maps ratios to zones', () => {
    expect(classifyAcwrZone(0.5)).toBe('low');
    expect(classifyAcwrZone(1.0)).toBe('optimal');
    expect(classifyAcwrZone(1.4)).toBe('caution');
    expect(classifyAcwrZone(1.6)).toBe('high');
  });
});

describe('computeAcwr', () => {
  it('returns 1.0 for a long constant load and is reliable', () => {
    const r = computeAcwr(seriesFromLoads(Array(56).fill(12)));
    expect(r.ewma).toBe(1);
    expect(r.rolling).toBe(1);
    expect(r.zone).toBe('optimal');
    expect(r.reliable).toBe(true);
  });

  it('flags a spike as high zone', () => {
    const r = computeAcwr(seriesFromLoads([...Array(55).fill(12), 60]));
    expect(r.zone).toBe('high');
    expect(r.ewma).not.toBeNull();
  });

  it('is NOT reliable for a new athlete in a long zero-filled window', () => {
    // 84-day window, first real load only 5 days ago -> EWMA cold-start inflates
    // the ratio, but it must be flagged unreliable.
    const r = computeAcwr(seriesFromLoads([...Array(79).fill(0), ...Array(5).fill(14)]));
    expect(r.reliable).toBe(false);
  });

  it('is not reliable when chronic load is trivial', () => {
    const r = computeAcwr(seriesFromLoads(Array(56).fill(2)));
    expect(r.reliable).toBe(false);
  });

  it('returns nulls for an all-zero series', () => {
    const r = computeAcwr(seriesFromLoads(Array(56).fill(0)));
    expect(r.ewma).toBeNull();
    expect(r.zone).toBeNull();
    expect(r.reliable).toBe(false);
  });
});
