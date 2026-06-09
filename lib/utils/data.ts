import type { Database } from '@/types/database'

export type Workout = Database['public']['Tables']['workouts']['Row']
export type DailyMetric = Database['public']['Tables']['daily_metrics']['Row']

// ── WHOOP Demo Data (real dataset — USER_00011 Sara Kowalski) ──────────────
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
  { date: '2025-01-28', type: 'Running',  dur: 62,  avg_hr: 132, cal: 447,  strain: 9.0,  z: [11, 21, 16, 12, 2], recovery: 65 },
  { date: '2025-01-26', type: 'Running',  dur: 47,  avg_hr: 140, cal: 489,  strain: 12.8, z: [6,  9, 14, 16, 3], recovery: 72 },
  { date: '2025-01-24', type: 'Running',  dur: 67,  avg_hr: 143, cal: 763,  strain: 14.1, z: [5,  12, 20, 25, 5], recovery: 58 },
  { date: '2025-01-21', type: 'Running',  dur: 62,  avg_hr: 141, cal: 638,  strain: 12.9, z: [5,  14, 18, 18, 7], recovery: 70 },
  { date: '2025-01-19', type: 'Running',  dur: 41,  avg_hr: 135, cal: 341,  strain: 10.3, z: [6,  10, 13, 10, 2], recovery: 75 },
  { date: '2025-01-16', type: 'Running',  dur: 72,  avg_hr: 147, cal: 927,  strain: 16.1, z: [5,  11, 18, 23,15], recovery: 48 },
  { date: '2025-01-14', type: 'Walking',  dur: 51,  avg_hr: 119, cal: 95,   strain: 2.3,  z: [22, 20,  7,  1, 2], recovery: 80 },
]

export const DEMO_GROUP = [
  { w: 'W48', SK: 54.7, MW: 91.1, JT: 73.3, LN: 78.7 },
  { w: 'W49', SK: 47.6, MW: 65.6, JT: 56.8, LN: 70.9 },
  { w: 'W50', SK: 65.1, MW: 61.7, JT: 84.4, LN: 78.6 },
  { w: 'W51', SK: 75.6, MW: 64.0, JT: 58.5, LN: 57.7 },
]

export const TYPE_COLORS: Record<string, { bg: string; text: string; icon: string; border: string }> = {
  Running:           { bg: '#EFF6FF', text: '#2563EB', icon: 'ki-abstract-26',  border: '#BFDBFE' },
  Cycling:           { bg: '#F0FDF4', text: '#16A34A', icon: 'ki-abstract-14',  border: '#BBF7D0' },
  Swimming:          { bg: '#F5F3FF', text: '#7C3AED', icon: 'ki-abstract-18',  border: '#DDD6FE' },
  HIIT:              { bg: '#FEF2F2', text: '#DC2626', icon: 'ki-abstract-17',  border: '#FECACA' },
  'Weight Training': { bg: '#FEF0E7', text: '#F35703', icon: 'ki-abstract-31',  border: '#FBC1A0' },
  CrossFit:          { bg: '#FFFBEB', text: '#D97706', icon: 'ki-abstract-28',  border: '#FDE68A' },
  Yoga:              { bg: '#F0FDF4', text: '#0D9488', icon: 'ki-heart',         border: '#99F6E4' },
  Walking:           { bg: '#F8FAFC', text: '#64748B', icon: 'ki-map',           border: '#CBD5E1' },
}

// ── Calendar colors ──────────────────────────────────────────────────────────
export const CYCLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  macro: { bg: '#EFF6FF', text: '#1D4ED8', border: '#93C5FD' },
  meso:  { bg: '#FEF0E7', text: '#B03D04', border: '#FBC1A0' },
  micro: { bg: '#F0FDF4', text: '#15803D', border: '#86EFAC' },
}

export const EVENT_COLORS: Record<string, { bg: string; text: string }> = {
  workout:     { bg: '#EFF6FF', text: '#2563EB' },
  competition: { bg: '#FEF0E7', text: '#D44A02' },
  rest:        { bg: '#F1F5F9', text: '#64748B' },
  medical:     { bg: '#FDF4FF', text: '#9333EA' },
  camp:        { bg: '#F0FDFA', text: '#0F766E' },
  test:        { bg: '#FEFCE8', text: '#A16207' },
  other:       { bg: '#F8FAFC', text: '#475569' },
}

// ── Risk badge ────────────────────────────────────────────────────────────────
export const RISK_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  low:      { bg: '#F0FDF4', text: '#15803D', border: '#86EFAC', icon: 'ki-check-circle' },
  moderate: { bg: '#FEF0E7', text: '#B03D04', border: '#FBC1A0', icon: 'ki-information-2' },
  high:     { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', icon: 'ki-information-4' },
  critical: { bg: '#450A0A', text: '#FCA5A5', border: '#7F1D1D', icon: 'ki-information-4' },
}

// ── Coach marks ────────────────────────────────────────────────────────────────
export const COACH_MARKS: Record<string, { label: string; bg: string; text: string }> = {
  overload:       { label: 'Overload',       bg: '#FEF2F2', text: '#DC2626' },
  under_recovery: { label: 'Under-Recovery', bg: '#FEF0E7', text: '#D44A02' },
  unstable:       { label: 'Unstable',       bg: '#FEFCE8', text: '#A16207' },
  on_track:       { label: 'On Track',       bg: '#F0FDF4', text: '#16A34A' },
  peak:           { label: 'Peak',           bg: '#EFF6FF', text: '#2563EB' },
  taper:          { label: 'Taper',          bg: '#F5F3FF', text: '#7C3AED' },
}

// ── 4 prototype athletes (WHOOP dataset) ─────────────────────────────────────
export const DEMO_ATHLETES = [
  { id: 'USER_00011', name: 'Sara Kowalski',   sport: 'Бег',                 recovery: 42, hrv: 47.2,  rhr: 58, age: 45, gender: 'F', sessions: 18, streak: 5,  risk: 'moderate' as const },
  { id: 'USER_00003', name: 'Marcus Weiden',   sport: 'Велоспорт',           recovery: 82, hrv: 62.2,  rhr: 44, age: 43, gender: 'M', sessions: 24, streak: 12, risk: 'low' as const },
  { id: 'USER_00006', name: 'James Thornton',  sport: 'Плавание',            recovery: 63, hrv: 32.0,  rhr: 52, age: 55, gender: 'M', sessions: 20, streak: 8,  risk: 'moderate' as const },
  { id: 'USER_00001', name: 'Linh Nguyen',     sport: 'Силовая подготовка',  recovery: 80, hrv: 106.5, rhr: 48, age: 56, gender: 'F', sessions: 22, streak: 10, risk: 'low' as const },
]

// ── Demo competitions ─────────────────────────────────────────────────────────
export const DEMO_COMPETITIONS = [
  { id: '1', date: '2024-03-15', name: 'City Spring 10K',     type: 'race', status: 'completed', location: 'Frankfurt',   distance: '10 km',    result: '42:18',  position: 8,   pb: true,  notes: 'Personal best! Great pacing.' },
  { id: '2', date: '2024-06-02', name: 'Rhein Marathon',       type: 'race', status: 'completed', location: 'Cologne',     distance: '42.2 km',  result: '3:54:22',position: 142, pb: false, notes: 'Tough heat, finished strong.' },
  { id: '3', date: '2024-09-20', name: 'Autumn Half Marathon', type: 'race', status: 'completed', location: 'Frankfurt',   distance: '21.1 km',  result: '1:52:41',position: 37,  pb: false, notes: 'Good consistent pace.' },
  { id: '4', date: '2025-03-16', name: 'City Spring 10K',     type: 'race', status: 'planned',   location: 'Frankfurt',   distance: '10 km',    result: null,     position: null, pb: false, notes: 'Target: sub 41:00.' },
  { id: '5', date: '2025-05-25', name: 'Düsseldorf Marathon', type: 'race', status: 'registered',location: 'Düsseldorf',  distance: '42.2 km',  result: null,     position: null, pb: false, notes: 'A-race of the season.' },
]

// ── Demo cycle blocks ─────────────────────────────────────────────────────────
export const DEMO_CYCLES = [
  { start: '2025-01-06', end: '2025-03-30', type: 'macro', label: 'Base Building Phase',  color: 'blue' },
  { start: '2025-01-06', end: '2025-01-26', type: 'meso',  label: 'Aerobic Foundation',   color: 'blue' },
  { start: '2025-01-27', end: '2025-02-16', type: 'meso',  label: 'Tempo Development',    color: 'orange' },
  { start: '2025-02-17', end: '2025-03-09', type: 'meso',  label: 'Race Specific',        color: 'orange' },
  { start: '2025-03-10', end: '2025-03-30', type: 'meso',  label: 'Peak & Taper',         color: 'green' },
  { start: '2025-01-06', end: '2025-01-12', type: 'micro', label: 'Easy Week 1',          color: 'blue' },
  { start: '2025-01-13', end: '2025-01-19', type: 'micro', label: 'Build Week 1',         color: 'orange' },
  { start: '2025-01-20', end: '2025-01-26', type: 'micro', label: 'Build Week 2',         color: 'orange' },
]

// ── Demo coach observation diary ─────────────────────────────────────────────
export const DEMO_DIARY = [
  { date: '2025-02-14', title: 'Back on Track',          note: 'Metrics normalised. Good session, athlete motivated.', risk: 'low',      category: 'motivation', tags: ['positive','recovery'] },
  { date: '2025-02-03', title: 'Recovery Concern',       note: '3rd day of lower HRV. Sleep quality down. Monitoring closely.', risk: 'high',     category: 'health',    tags: ['recovery','alert'] },
  { date: '2025-01-24', title: 'Tempo Session OK',       note: 'First tempo at 4:30/km. 25 min solid effort.', risk: 'low',      category: 'performance', tags: ['tempo','progress'] },
  { date: '2025-01-17', title: 'Slight Fatigue Signs',   note: 'HRV dropped 8 pts vs baseline. Reduce intensity.', risk: 'moderate', category: 'health',    tags: ['fatigue','hrv'] },
  { date: '2025-01-10', title: 'Aerobic Base - Good',   note: 'Sara running well in Z2. HR controlled under 145 bpm.', risk: 'low',      category: 'performance', tags: ['aerobic','positive'] },
]

export function recoveryColor(v: number) {
  return v >= 67 ? '#16A34A' : v >= 34 ? '#F35703' : '#DC2626'
}
