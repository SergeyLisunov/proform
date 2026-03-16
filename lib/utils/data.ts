import type { Database } from '@/types/database'

export type Workout = Database['public']['Tables']['workouts']['Row']
export type DailyMetric = Database['public']['Tables']['daily_metrics']['Row']

// Real WHOOP-derived static data for dashboard previews (no auth required for demo charts)
export const DEMO_WEEKLY = [
  { w: 'W47', strain: 73.0, sessions: 1 },
  { w: 'W48', strain: 54.7, sessions: 4 },
  { w: 'W49', strain: 47.6, sessions: 0 },
  { w: 'W50', strain: 65.1, sessions: 4 },
  { w: 'W51', strain: 75.6, sessions: 1 },
  { w: 'W52', strain: 77.7, sessions: 1 },
  { w: 'W01', strain: 56.1, sessions: 2 },
  { w: 'W02', strain: 43.1, sessions: 2 },
]

export const DEMO_DAILY = [
  { day: 'Thu', strain: 13.6, hrv: 46.3, rhr: 49.6, recovery: 57.1, sleep: 7.5 },
  { day: 'Fri', strain: 10.8, hrv: 47.7, rhr: 41.2, recovery: 45.3, sleep: 7.7 },
  { day: 'Sat', strain:  8.3, hrv: 48.1, rhr: 47.8, recovery: 46.4, sleep: 8.6 },
  { day: 'Sun', strain:  1.1, hrv: 49.9, rhr: 46.1, recovery: 35.1, sleep: 7.7 },
  { day: 'Mon', strain: 12.3, hrv: 51.6, rhr: 44.5, recovery: 37.1, sleep: 7.0 },
  { day: 'Tue', strain: 13.2, hrv: 31.5, rhr: 42.5, recovery: 46.2, sleep: 8.4 },
  { day: 'Wed', strain: 17.6, hrv: 43.3, rhr: 54.0, recovery: 34.8, sleep: 8.3 },
]

export const DEMO_HRZ = [13.4, 22.1, 27.3, 26.5, 10.6] // %

export const DEMO_SESSIONS = [
  { date: '2024-01-10', type: 'Walking',        dur: 51,  avg_hr: 119, cal: 95,   strain: 2.3,  z: [22, 20,  7,  1,  2] },
  { date: '2024-01-09', type: 'Running',        dur: 62,  avg_hr: 132, cal: 447,  strain: 9.0,  z: [11, 21, 16, 12,  2] },
  { date: '2024-01-07', type: 'Running',        dur: 47,  avg_hr: 140, cal: 489,  strain: 12.8, z: [ 6,  9, 14, 16,  3] },
  { date: '2024-01-05', type: 'Running',        dur: 67,  avg_hr: 143, cal: 763,  strain: 14.1, z: [ 5, 12, 20, 25,  5] },
  { date: '2023-12-27', type: 'Running',        dur: 62,  avg_hr: 141, cal: 638,  strain: 12.9, z: [ 5, 14, 18, 18,  7] },
  { date: '2023-12-22', type: 'Running',        dur: 41,  avg_hr: 135, cal: 341,  strain: 10.3, z: [ 6, 10, 13, 10,  2] },
  { date: '2023-12-17', type: 'Running',        dur: 72,  avg_hr: 147, cal: 927,  strain: 16.1, z: [ 5, 11, 18, 23, 15] },
]

export const DEMO_GROUP = [
  { w: 'W48', SK: 54.7, MW: 91.1, JT: 73.3, LN: 78.7 },
  { w: 'W49', SK: 47.6, MW: 65.6, JT: 56.8, LN: 70.9 },
  { w: 'W50', SK: 65.1, MW: 61.7, JT: 84.4, LN: 78.6 },
  { w: 'W51', SK: 75.6, MW: 64.0, JT: 58.5, LN: 57.7 },
]

export const TYPE_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  Running:          { bg: '#EFF6FF', text: '#2563EB', icon: 'ki-abstract-26' },
  Cycling:          { bg: '#F0FDF4', text: '#16A34A', icon: 'ki-bicycle' },
  Swimming:         { bg: '#F5F3FF', text: '#7C3AED', icon: 'ki-water' },
  HIIT:             { bg: '#FEF2F2', text: '#DC2626', icon: 'ki-abstract-17' },
  'Weight Training':{ bg: '#FFF7ED', text: '#F97316', icon: 'ki-dumbbell' },
  CrossFit:         { bg: '#FFFBEB', text: '#D97706', icon: 'ki-abstract-28' },
  Yoga:             { bg: '#F0FDF4', text: '#0D9488', icon: 'ki-heart' },
  Walking:          { bg: '#F8FAFC', text: '#64748B', icon: 'ki-map' },
}

export function recoveryColor(v: number) {
  return v >= 67 ? '#16A34A' : v >= 34 ? '#F97316' : '#DC2626'
}
