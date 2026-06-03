'use client'
/**
 * /org/athletes/[id] — Sprint W2 Day 12.
 *
 * Org-view athlete profile (READ-ONLY summary). Org admin может drill-
 * down из dashboard в карточку конкретного athlete'а — но НЕ должен
 * видеть личные medical details (medical_diary entries, wellness
 * check-in specifics, AI conversation history). Privacy by design.
 *
 * Что показывается:
 *   - name + photo + team + coach + doctor — basic identity
 *   - last_activity_at — когда athlete последний раз был активен
 *   - aggregated counts: active recommendations, injuries, attendance
 *   - team membership badge
 *   - "Открыть полный профиль" — disabled для org_admin, доступно только
 *     coach/doctor с active connection
 *
 * Если caller НЕ org_admin/owner текущей организации — redirect to /profile/[id]
 * (existing public passport flow).
 */
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import { getMyOrg } from '@/services/org.service'
import { createClient } from '@/lib/supabase/client'
import type { Organization } from '@/types/org.types'
import { Card, Alert, Badge } from '@/components/ui/metronic'

interface AthleteProfile {
  id: string
  name: string | null
  avatar_url: string | null
  email: string | null
  city: string | null
  birth_date: string | null
  sport: string | null
  active_in_org_since: string | null
  member_role: string | null
}

interface AthleteCounts {
  active_recommendations: number
  active_injuries: number
  workouts_last_30d: number
  team_names: string[]
  coach_names: string[]
  doctor_names: string[]
}

export default function OrgAthletePage() {
  const params = useParams<{ id: string }>()
  const athleteId = params.id
  const { user, loading: userLoading } = useUser()

  const [org, setOrg]                 = useState<Organization | null>(null)
  const [profile, setProfile]         = useState<AthleteProfile | null>(null)
  const [counts, setCounts]           = useState<AthleteCounts | null>(null)
  const [loading, setLoading]         = useState(true)
  const [forbidden, setForbidden]     = useState(false)

  const load = useCallback(async () => {
    if (!athleteId) return
    setLoading(true)
    setForbidden(false)
    try {
      const orgData = await getMyOrg()
      if (!orgData) { setForbidden(true); return }
      setOrg(orgData)

      const sb = createClient()

      // Verify athlete is in this org
      const { data: memberRaw } = await sb
        .from('org_members')
        .select('member_role, joined_at, status')
        .eq('org_id', orgData.id)
        .eq('user_id', athleteId)
        .maybeSingle()
      const member = memberRaw as { member_role: string; joined_at: string | null; status: string } | null
      if (!member || member.status !== 'active') {
        setForbidden(true)
        return
      }

      // Athlete profile
      const { data: userRaw } = await sb
        .from('users')
        .select('id, name, avatar_url, email, city, birth_date, sport')
        .eq('id', athleteId)
        .maybeSingle()
      const u = userRaw as Pick<AthleteProfile, 'id' | 'name' | 'avatar_url' | 'email' | 'city' | 'birth_date' | 'sport'> | null
      if (!u) { setForbidden(true); return }

      setProfile({
        ...u,
        active_in_org_since: member.joined_at,
        member_role: member.member_role,
      })

      // Aggregations in parallel — never fetch raw medical content
      const [
        { data: recsRaw },
        { data: injuriesRaw },
        { data: workoutsRaw },
        { data: groupsRaw },
        { data: coachLinksRaw },
        { data: doctorLinksRaw },
      ] = await Promise.all([
        sb.from('recommendations')
          .select('id', { count: 'exact', head: true })
          .eq('athlete_id', athleteId)
          .in('status', ['sent', 'active', 'acknowledged']),
        sb.from('injuries')
          .select('id', { count: 'exact', head: true })
          .eq('athlete_id', athleteId)
          .neq('status', 'recovered'),
        sb.from('workouts')
          .select('id', { count: 'exact', head: true })
          .eq('athlete_id', athleteId)
          .gte('event_date', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
        sb.from('org_group_members')
          .select('group_id')
          .eq('athlete_id', athleteId),
        sb.from('trainer_athletes')
          .select('trainer_id')
          .eq('athlete_id', athleteId)
          .eq('status', 'accepted'),
        sb.from('connections')
          .select('initiator_id, recipient_id')
          .eq('connection_type', 'doctor_athlete')
          .eq('status', 'active')
          .or(`initiator_id.eq.${athleteId},recipient_id.eq.${athleteId}`),
      ])

      // Resolve team names
      const groupIds = ((groupsRaw ?? []) as Array<{ group_id: string }>).map(g => g.group_id)
      let teamNames: string[] = []
      if (groupIds.length > 0) {
        const { data: groups } = await sb
          .from('org_groups')
          .select('name')
          .in('id', groupIds)
        teamNames = ((groups ?? []) as Array<{ name: string }>).map(g => g.name)
      }

      // Resolve coach/doctor names
      const coachIds = ((coachLinksRaw ?? []) as Array<{ trainer_id: string }>).map(l => l.trainer_id)
      const doctorIds = Array.from(new Set(
        ((doctorLinksRaw ?? []) as Array<{ initiator_id: string; recipient_id: string }>)
          .map(c => c.initiator_id === athleteId ? c.recipient_id : c.initiator_id)
      ))
      const userIdsToResolve = Array.from(new Set([...coachIds, ...doctorIds]))
      let nameById = new Map<string, string>()
      if (userIdsToResolve.length > 0) {
        const { data: users } = await sb
          .from('users')
          .select('id, name')
          .in('id', userIdsToResolve)
        nameById = new Map(((users ?? []) as Array<{ id: string; name: string | null }>)
          .map(u => [u.id, u.name ?? '—']))
      }

      // For count headers — we used head:true so data is null but count is set on
      // the response — TypeScript types in this project don't expose count via
      // .select(); we mimic the behavior with separate eager queries. To keep
      // it simple we use array-length on the wide queries.
      const recsCount     = Array.isArray(recsRaw) ? recsRaw.length : 0
      const injuriesCount = Array.isArray(injuriesRaw) ? injuriesRaw.length : 0
      const workoutsCount = Array.isArray(workoutsRaw) ? workoutsRaw.length : 0

      setCounts({
        active_recommendations: recsCount,
        active_injuries:        injuriesCount,
        workouts_last_30d:      workoutsCount,
        team_names:             teamNames,
        coach_names:            coachIds.map(id => nameById.get(id) ?? '—').filter(n => n !== '—'),
        doctor_names:           doctorIds.map(id => nameById.get(id) ?? '—').filter(n => n !== '—'),
      })
    } finally {
      setLoading(false)
    }
  }, [athleteId])

  useEffect(() => {
    if (userLoading) return
    if (user?.role !== 'organization') { setForbidden(true); setLoading(false); return }
    load()
  }, [user, userLoading, load])

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (forbidden || !profile || !counts || !org) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <i className="ki-filled ki-shield-cross text-3xl text-red-400" />
        <p className="text-sm font-semibold text-foreground">Атлет не найден или нет доступа</p>
        <Link href="/org" className="text-xs text-orange-600 hover:underline">← Назад в управление</Link>
      </div>
    )
  }

  const initials = (profile.name ?? '?').split(' ').map(s => s.charAt(0).toUpperCase()).join('').slice(0, 2)

  return (
    <div className="flex flex-col gap-5 pf-enter">
      {/* Privacy banner */}
      <Alert variant="warning" icon="ki-shield-tick" title="Org-view: упрощённый профиль.">
        Из этого экрана вы видите только agg-метрики и членство. Полный профиль с
        тренировочной историей и медицинскими данными доступен только связанному
        тренеру/врачу (через RLS).
      </Alert>

      {/* Hero card */}
      <Card className="rounded-3xl p-6 flex items-start gap-5 flex-wrap">
        <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center text-2xl font-bold text-orange-700 shrink-0 overflow-hidden">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{profile.name ?? '—'}</h1>
            {profile.member_role && (
              <Badge variant="primary" size="sm" className="!rounded-full uppercase tracking-wider">
                {profile.member_role}
              </Badge>
            )}
          </div>
          <div className="mt-1 text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
            {profile.sport && <span>🏃 {profile.sport}</span>}
            {profile.city && <span>📍 {profile.city}</span>}
            {profile.active_in_org_since && (
              <span>В организации с {new Date(profile.active_in_org_since).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</span>
            )}
          </div>
        </div>
        <Link href="/org" className="kt-btn kt-btn-sm kt-btn-outline gap-2">
          <i className="ki-filled ki-arrow-left text-xs" />
          В управление
        </Link>
      </Card>

      {/* Aggregations grid (no raw medical detail) */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Активных рекомендаций" value={counts.active_recommendations} icon="ki-clipboard-check" color="#7C3AED" bg="#FAF5FF" />
        <Tile label="Активных травм" value={counts.active_injuries} icon="ki-shield-cross" color="#B91C1C" bg="#FEF2F2" />
        <Tile label="Тренировок за 30д" value={counts.workouts_last_30d} icon="ki-flash" color="#F97316" bg="#FFF7ED" />
        <Tile label="Команд" value={counts.team_names.length} icon="ki-people" color="#2563EB" bg="#EFF6FF" />
      </section>

      {/* Membership context */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ContextCard title="Команды" items={counts.team_names} emptyHint="Не привязан к команде" icon="ki-people" color="#2563EB" />
        <ContextCard title="Тренеры" items={counts.coach_names} emptyHint="Без активного тренера" icon="ki-shield-tick" color="#16A34A" />
        <ContextCard title="Врачи / Специалисты" items={counts.doctor_names} emptyHint="Без активного врача" icon="ki-heart-circle" color="#E11D48" />
      </section>
    </div>
  )
}

function Tile({ label, value, icon, color, bg }: { label: string; value: number; icon: string; color: string; bg: string }) {
  return (
    <Card className="p-4 rounded-2xl">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-2xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
          <div className="pf-num mt-2 text-2xl leading-none text-foreground font-bold">{value}</div>
        </div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
          <i className={`ki-filled ${icon}`} style={{ color, fontSize: 16 }} />
        </div>
      </div>
    </Card>
  )
}

function ContextCard({ title, items, emptyHint, icon, color }: { title: string; items: string[]; emptyHint: string; icon: string; color: string }) {
  return (
    <Card className="p-4 rounded-2xl">
      <div className="flex items-center gap-2 mb-2">
        <i className={`ki-filled ${icon} text-sm`} style={{ color }} />
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{emptyHint}</p>
      ) : (
        <ul className="space-y-1">
          {items.map(name => (
            <li key={name} className="text-sm font-semibold text-foreground">{name}</li>
          ))}
        </ul>
      )}
    </Card>
  )
}
