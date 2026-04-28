import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Server-only aggregator публичного «Athlete Passport».
 * Использует service-role client, НО сам фильтрует по
 * athletes.profile_public = true и отдаёт клиенту только
 * безопасную проекцию (никаких email/phone/birth_date,
 * никакого внутреннего users.id).
 */

export interface AthletePassport {
  // NOTE: internal users.id is intentionally NOT exposed here.
  // The public identifier is `nickname`. The DB id is a stable
  // enumeration handle into other authenticated APIs and must
  // never leak to anonymous callers.
  nickname: string
  display_name: string
  role: string
  avatar_url: string | null
  background_url: string | null
  bio: string | null
  sport: string | null
  discipline: string | null
  club: string | null
  city: string | null
  country: string | null
  // Сокращённые соц-сети (показываем только host для антиспама).
  social: {
    instagram: string | null
    telegram:  string | null
    youtube:   string | null
    tiktok:    string | null
    website:   string | null
  }
  // Публичные агрегаты (workouts_public).
  workouts_public: boolean
  stats: {
    total_workouts_90d: number
    total_minutes_90d: number
    avg_recovery_30d: number | null
    current_streak_days: number
  } | null
  recent_workouts: Array<{
    id: string
    event_date: string
    activity_type: string | null
    name: string | null
    duration_min: number | null
    strain: number | null
  }>
  personal_records: Array<{
    id: string
    category: string | null
    exercise: string | null
    metric: string | null
    value: number | null
    unit: string | null
    achieved_at: string | null
    lower_is_better: boolean | null
  }>
}

function deriveDisplayName(u: {
  name: string | null
  nickname: string | null
  first_name?: string | null
  last_name?: string | null
}): string {
  const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  return full || u.name || (u.nickname ? `@${u.nickname}` : 'Атлет')
}

function hostOnly(url: string | null): string | null {
  if (!url) return null
  try { return new URL(url).host.replace(/^www\./, '') } catch { return null }
}

function streakDays(dates: string[]): number {
  // dates отсортированы desc (yyyy-mm-dd). Считаем подряд идущие дни от сегодня.
  const set = new Set(dates)
  let count = 0
  const d = new Date(); d.setHours(0, 0, 0, 0)
  while (true) {
    const iso = d.toISOString().slice(0, 10)
    if (!set.has(iso)) break
    count++
    d.setDate(d.getDate() - 1)
  }
  return count
}

export async function getAthletePassport(nickname: string): Promise<AthletePassport | null> {
  if (!nickname || !/^[a-z0-9][a-z0-9_-]{1,30}$/i.test(nickname)) return null
  const admin = createAdminClient()

  const { data: userRaw } = await admin
    .from('users')
    .select('id, name, nickname, role, avatar_url')
    .ilike('nickname', nickname)
    .maybeSingle()
  const u = userRaw as { id: string; name: string | null; nickname: string | null; role: string; avatar_url: string | null } | null
  if (!u || u.role !== 'athlete') return null

  const { data: athRaw } = await admin
    .from('athletes')
    .select('id, first_name, last_name, bio, city, country, club, primary_sport, avatar_url, background_url, instagram_url, telegram_url, youtube_url, tiktok_url, website_url, profile_public, workouts_public')
    .eq('id', u.id).maybeSingle()
  const a = athRaw as any
  if (!a || a.profile_public !== true) return null

  // Public workouts aggregate (последние 90 дней).
  let stats: AthletePassport['stats'] = null
  const recentWorkouts: AthletePassport['recent_workouts'] = []
  if (a.workouts_public) {
    const from90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
    const from30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

    const [{ data: workoutsRaw }, { data: metricsRaw }] = await Promise.all([
      admin.from('workouts')
        .select('id, event_date, activity_type, name, activity_duration_min, activity_strain, is_public')
        .eq('athlete_id', u.id)
        .gte('event_date', from90)
        .order('event_date', { ascending: false })
        .limit(50),
      admin.from('daily_metrics')
        .select('date, recovery_score')
        .eq('athlete_id', u.id)
        .gte('date', from30)
        .order('date', { ascending: false })
        .limit(30),
    ])

    const workouts = ((workoutsRaw ?? []) as Array<{
      id: string; event_date: string | null; activity_type: string | null
      name: string | null; activity_duration_min: number | null
      activity_strain: number | null; is_public: boolean | null
    }>).filter(w => w.is_public !== false && w.event_date)

    for (const w of workouts.slice(0, 10)) {
      recentWorkouts.push({
        id: w.id,
        event_date: w.event_date!,
        activity_type: w.activity_type,
        name: w.name,
        duration_min: w.activity_duration_min,
        strain: w.activity_strain,
      })
    }

    const metrics = (metricsRaw ?? []) as Array<{ date: string; recovery_score: number | null }>
    const recValues = metrics.map(m => m.recovery_score).filter((v): v is number => typeof v === 'number')
    const avgRecovery = recValues.length > 0
      ? Math.round(recValues.reduce((s, v) => s + v, 0) / recValues.length)
      : null

    stats = {
      total_workouts_90d: workouts.length,
      total_minutes_90d:  workouts.reduce((s, w) => s + (w.activity_duration_min ?? 0), 0),
      avg_recovery_30d:   avgRecovery,
      current_streak_days: streakDays(workouts.map(w => w.event_date!)),
    }
  }

  // Personal records — все, т.к. сам факт хранения = атлет занёс сознательно.
  const { data: prRaw } = await admin
    .from('personal_records')
    .select('id, category, exercise, metric, value, unit, achieved_at, lower_is_better')
    .eq('athlete_id', u.id)
    .order('achieved_at', { ascending: false })
    .limit(8)
  const personalRecords = ((prRaw ?? []) as Array<{
    id: string; category: string | null; exercise: string | null
    metric: string | null; value: number | null; unit: string | null
    achieved_at: string | null; lower_is_better: boolean | null
  }>).map(r => ({
    id: r.id,
    category: r.category,
    exercise: r.exercise,
    metric:   r.metric,
    value:    r.value,
    unit:     r.unit,
    achieved_at: r.achieved_at,
    lower_is_better: r.lower_is_better,
  }))

  return {
    nickname: u.nickname ?? nickname,
    display_name: deriveDisplayName({
      name: u.name,
      nickname: u.nickname,
      first_name: a.first_name,
      last_name:  a.last_name,
    }),
    role: u.role,
    avatar_url:     a.avatar_url ?? u.avatar_url,
    background_url: a.background_url ?? null,
    bio:     a.bio ?? null,
    sport:   a.primary_sport ?? null,
    discipline: null,
    club:    a.club ?? null,
    city:    a.city ?? null,
    country: a.country ?? null,
    social: {
      instagram: hostOnly(a.instagram_url),
      telegram:  hostOnly(a.telegram_url),
      youtube:   hostOnly(a.youtube_url),
      tiktok:    hostOnly(a.tiktok_url),
      website:   hostOnly(a.website_url),
    },
    workouts_public: a.workouts_public === true,
    stats,
    recent_workouts: recentWorkouts,
    personal_records: personalRecords,
  }
}
