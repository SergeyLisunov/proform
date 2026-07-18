import { describe, expect, it } from 'vitest';
import {
  computeGoalForecast,
  inferRule,
  type AthleteGoalLike,
  type PersonalRecordPointLike,
} from './goal-forecast';

function goal(o: Partial<AthleteGoalLike> = {}): AthleteGoalLike {
  return {
    id: 'g1',
    title: '5 км',
    metric: 'run_5k',
    target_value: 55,
    target_unit: 'мин',
    target_date: '2026-03-01',
    current_value: 60,
    status: 'active',
    ...o,
  };
}

function rec(achieved_at: string, value: number, metric = 'run_5k'): PersonalRecordPointLike {
  return { achieved_at, metric, value };
}

describe('inferRule', () => {
  it('infers lower_is_better when target is below current', () => {
    expect(inferRule(goal({ target_value: 55, current_value: 60 }))).toBe('lower_is_better');
  });
  it('infers higher_is_better when target is above current', () => {
    expect(inferRule(goal({ target_value: 100, current_value: 80 }))).toBe('higher_is_better');
  });
  it('defaults to higher_is_better without current_value', () => {
    expect(inferRule(goal({ current_value: null }))).toBe('higher_is_better');
  });
  it('returns null when target is missing', () => {
    expect(inferRule(goal({ target_value: null }))).toBeNull();
  });
});

describe('computeGoalForecast', () => {
  it('marks unsupported when target is missing', () => {
    expect(computeGoalForecast(goal({ target_value: null }), []).status).toBe('unsupported');
  });

  it('treats an active goal short of target as in-progress, not achieved', () => {
    // current 54, target 55: without an explicit direction field the engine
    // reads this as higher-is-better in progress. Real achievements are marked
    // by proform's own goal.status='achieved' (filtered out upstream).
    expect(computeGoalForecast(goal({ current_value: 54 }), []).status).toBe('not_enough_data');
  });

  it('detects achieved when the current value exactly meets the target', () => {
    expect(computeGoalForecast(goal({ current_value: 55, target_value: 55 }), []).status).toBe(
      'achieved',
    );
  });

  it('reports not_enough_data with fewer than 3 records', () => {
    const f = computeGoalForecast(goal(), [rec('2026-01-01', 60), rec('2026-01-15', 58)]);
    expect(f.status).toBe('not_enough_data');
    expect(f.rule).toBe('lower_is_better');
  });

  it('forecasts on_track for a fast-improving lower_is_better goal', () => {
    // 60 -> 58 -> 56 over 28 days (slope -1/week); crosses 55 ~ day 35;
    // target_date far out -> on_track
    const f = computeGoalForecast(goal({ target_date: '2026-06-01' }), [
      rec('2026-01-01', 60),
      rec('2026-01-15', 58),
      rec('2026-01-29', 56),
    ]);
    expect(f.status).toBe('on_track');
    expect(f.slopePerWeek).toBe(-1);
  });

  it('marks a worsening trend off_track', () => {
    const f = computeGoalForecast(goal(), [
      rec('2026-01-01', 56),
      rec('2026-01-15', 58),
      rec('2026-01-29', 60),
    ]);
    expect(f.status).toBe('off_track');
  });

  it('matches records by metric only', () => {
    const f = computeGoalForecast(goal(), [
      rec('2026-01-01', 60),
      rec('2026-01-10', 1, 'bench_press'), // different metric, ignored
      rec('2026-01-15', 58),
      rec('2026-01-29', 56),
    ]);
    expect(f.pointsUsed).toBe(3);
  });
});
