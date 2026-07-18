import { describe, expect, it } from 'vitest';
import { computeWellnessReadiness, type WellnessCheckinLike } from './wellness';

const AS_OF = '2026-07-17';

function dateOffset(offset: number): string {
  const d = new Date(`${AS_OF}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function checkin(date: string, o: Partial<WellnessCheckinLike> = {}): WellnessCheckinLike {
  return { date, energy: 4, mood: 4, sleep_quality: 4, sleep_hours: 8, soreness: 2, ...o };
}

/** 10 identical baseline check-ins before asOf + today. */
function stable(todayOverrides: Partial<WellnessCheckinLike> = {}): WellnessCheckinLike[] {
  const baseline = Array.from({ length: 10 }, (_, i) => checkin(dateOffset(-(i + 1))));
  return [...baseline, checkin(AS_OF, todayOverrides)];
}

describe('computeWellnessReadiness', () => {
  it('reports ok at the personal baseline', () => {
    const r = computeWellnessReadiness(stable(), AS_OF);
    expect(r.status).toBe('ok');
    expect(r.score).toBe(0);
    expect(r.checkinDate).toBe(AS_OF);
    expect(r.metrics).toHaveLength(5);
  });

  it('inverts soreness: high soreness lowers the score', () => {
    // baseline soreness 2 (SD 0 -> floored 0.5); today soreness 6 -> z = -(6-2)/0.5 = -8
    const r = computeWellnessReadiness(stable({ soreness: 6 }), AS_OF);
    const soreness = r.metrics.find((m) => m.metric === 'soreness');
    expect(soreness?.zScore).toBe(-8);
    expect(r.status).toBe('risk');
  });

  it('classifies a broad decline as risk', () => {
    const r = computeWellnessReadiness(
      stable({ energy: 2, mood: 2, sleep_quality: 2, sleep_hours: 5, soreness: 6 }),
      AS_OF,
    );
    expect(r.score).toBeLessThan(-1.5);
    expect(r.status).toBe('risk');
  });

  it('requires at least 7 baseline check-ins', () => {
    const few = [checkin(dateOffset(-1)), checkin(dateOffset(-2)), checkin(AS_OF)];
    expect(computeWellnessReadiness(few, AS_OF).status).toBe('not_enough_data');
  });

  it('returns not_enough_data when there is no recent check-in', () => {
    const stale = Array.from({ length: 10 }, (_, i) => checkin(dateOffset(-(i + 5))));
    const r = computeWellnessReadiness(stale, AS_OF);
    expect(r.status).toBe('not_enough_data');
    expect(r.checkinDate).toBeNull();
  });
});
