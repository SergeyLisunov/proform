/**
 * GET /api/club/feed — закрытая лента тренировок клуба (P1 соц-ядро).
 *
 * Стратегия ролей 2026-07: «тренировка = пост в закрытой ленте клуба».
 * Отдаёт последние тренировки атлетов МОЕЙ организации + счётчики
 * «респектов» + мой флаг реакции.
 *
 * Почему server-route с admin-клиентом, а не расширение RLS workouts:
 * строки workouts содержат column-sensitive данные (hrv, recovery_score,
 * risk_flag, mood) — открывать одноклубникам row-SELECT нельзя (см. vault:
 * «RLS row-level не подходит для column-sensitive surfaces»). Роут отдаёт
 * строгий allow-list колонок: id, athlete_id, name, activity_type,
 * event_date, activity_duration_min — тот же паттерн, что parent-progress.
 *
 * Членство проверяется кодом: caller обязан быть активным членом организации;
 * лента конечна (limit 20) — policy child-privacy-defaults, принцип 3.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FEED_LIMIT = 20

export async function GET() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const { data: meRow } = await supabase
    .from('users').select('id').eq('auth_id', authUser.id).maybeSingle()
  if (!meRow) return NextResponse.json({ ok: false, error: 'no_profile' }, { status: 404 })
  const meId = (meRow as { id: string }).id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // 1. Моя организация (первая активная связь).
  const { data: mem } = await admin
    .from('org_members')
    .select('org_id')
    .eq('user_id', meId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (!mem?.org_id) return NextResponse.json({ ok: true, org: null, items: [] })
  const orgId = mem.org_id as string

  // 2. Атлеты клуба + имя организации.
  const [{ data: org }, { data: roster }] = await Promise.all([
    admin.from('organizations').select('org_name').eq('id', orgId).maybeSingle(),
    admin.from('org_members')
      .select('user_id')
      .eq('org_id', orgId)
      .eq('member_role', 'athlete')
      .eq('status', 'active'),
  ])
  const athleteIds: string[] = ((roster ?? []) as Array<{ user_id: string }>).map(r => r.user_id)
  if (athleteIds.length === 0) {
    return NextResponse.json({ ok: true, org: { id: orgId, name: org?.org_name ?? null }, items: [] })
  }

  // 3. Тренировки — СТРОГИЙ allow-list колонок, без медицинских полей.
  const { data: workouts } = await admin
    .from('workouts')
    .select('id, athlete_id, name, activity_type, event_date, activity_duration_min')
    .in('athlete_id', athleteIds)
    .lte('event_date', new Date().toISOString().slice(0, 10))
    .order('event_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(FEED_LIMIT)

  const items = (workouts ?? []) as Array<{
    id: string; athlete_id: string; name: string | null;
    activity_type: string | null; event_date: string; activity_duration_min: number | null
  }>
  if (items.length === 0) {
    return NextResponse.json({ ok: true, org: { id: orgId, name: org?.org_name ?? null }, items: [] })
  }

  // 4. Имена атлетов + реакции (счётчик, мой флаг, «есть ли респект тренера»).
  const workoutIds = items.map(w => w.id)
  const ownerIds = [...new Set(items.map(w => w.athlete_id))]
  const [{ data: users }, { data: reactions }, { data: trainerLinks }] = await Promise.all([
    admin.from('users').select('id, name').in('id', ownerIds),
    admin.from('workout_reactions').select('workout_id, user_id').in('workout_id', workoutIds),
    admin.from('trainer_athletes')
      .select('trainer_id, athlete_id')
      .in('athlete_id', ownerIds)
      .eq('status', 'accepted'),
  ])
  const nameMap = new Map(((users ?? []) as Array<{ id: string; name: string | null }>).map(u => [u.id, u.name ?? 'Атлет']))
  const trainersByAthlete = new Map<string, Set<string>>()
  for (const l of ((trainerLinks ?? []) as Array<{ trainer_id: string; athlete_id: string }>)) {
    if (!trainersByAthlete.has(l.athlete_id)) trainersByAthlete.set(l.athlete_id, new Set())
    trainersByAthlete.get(l.athlete_id)!.add(l.trainer_id)
  }
  const reactsByWorkout = new Map<string, Array<{ user_id: string }>>()
  for (const r of ((reactions ?? []) as Array<{ workout_id: string; user_id: string }>)) {
    if (!reactsByWorkout.has(r.workout_id)) reactsByWorkout.set(r.workout_id, [])
    reactsByWorkout.get(r.workout_id)!.push({ user_id: r.user_id })
  }

  return NextResponse.json({
    ok: true,
    org: { id: orgId, name: org?.org_name ?? null },
    me: meId,
    items: items.map(w => {
      const rs = reactsByWorkout.get(w.id) ?? []
      const trainers = trainersByAthlete.get(w.athlete_id)
      return {
        ...w,
        athlete_name:  nameMap.get(w.athlete_id) ?? 'Атлет',
        respects:      rs.length,
        reacted_by_me: rs.some(r => r.user_id === meId),
        coach_respect: trainers ? rs.some(r => trainers.has(r.user_id)) : false,
        is_mine:       w.athlete_id === meId,
      }
    }),
  })
}
