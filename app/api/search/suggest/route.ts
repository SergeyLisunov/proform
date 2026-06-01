import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizeFilterTerm } from '@/lib/utils/search'

/**
 * Lightweight autocomplete for the global search bar / command palette.
 *
 * GET /api/search/suggest?q=<term>&limit=8
 *
 * Returns up to `limit` suggestions per bucket (people, coaches, doctors,
 * organizations). Powered by the `search_doc` tsvector columns introduced in
 * migration 021. Falls back to prefix ilike when the query is only 1–2 chars.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authUser.id)
    .single()
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const raw   = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '8'), 15)
  if (raw.length < 1) {
    return NextResponse.json({ people: [], coaches: [], doctors: [], organizations: [] })
  }

  // Sanitize for PostgREST .or() ilike filters below (M1); FTS tsquery path
  // re-strips non-alphanumerics anyway.
  const q = sanitizeFilterTerm(raw.startsWith('@') ? raw.slice(1) : raw)
  const useFts = q.length >= 3

  // Build a safe prefix tsquery: "alex" → "alex:*", supports multi-word "alex smi" → "alex:* & smi:*"
  const tsquery = q
    .split(/\s+/)
    .filter(Boolean)
    .map(t => t.replace(/[^\p{L}\p{N}_]/gu, ''))
    .filter(Boolean)
    .map(t => `${t}:*`)
    .join(' & ')

  // ── People (users) ───────────────────────────────────────────────────────
  // The `users` table stores a single `name` column (no first_name/last_name).
  let peopleQuery = supabase
    .from('users')
    .select('id, nickname, name, role, avatar_url, city, sport')
    .eq('is_searchable', true)
    .neq('role', 'admin')
    .neq('id', me.id)
    .limit(limit)

  if (useFts && tsquery) {
    peopleQuery = peopleQuery.textSearch('search_doc', tsquery, { type: 'plain' })
  } else {
    const term = q.toLowerCase()
    peopleQuery = peopleQuery.or(`nickname.ilike.${term}%,name.ilike.${term}%`)
  }

  const [{ data: peopleRaw }, coachesRes, doctorsRes, orgsRes] = await Promise.all([
    peopleQuery,
    // Coaches — search_doc if 3+ chars, else fallback
    useFts && tsquery
      ? supabase
          .from('coaches')
          .select('id, first_name, last_name, specialization, city, avatar_url')
          .eq('profile_public', true)
          .textSearch('search_doc', tsquery, { type: 'plain' })
          .limit(limit)
      : supabase
          .from('coaches')
          .select('id, first_name, last_name, specialization, city, avatar_url')
          .eq('profile_public', true)
          .or(`first_name.ilike.${q}%,last_name.ilike.${q}%,specialization.ilike.%${q}%`)
          .limit(limit),
    useFts && tsquery
      ? supabase
          .from('doctors')
          .select('id, first_name, last_name, medical_specialization, city, avatar_url')
          .eq('profile_public', true)
          .textSearch('search_doc', tsquery, { type: 'plain' })
          .limit(limit)
      : supabase
          .from('doctors')
          .select('id, first_name, last_name, medical_specialization, city, avatar_url')
          .eq('profile_public', true)
          .or(`first_name.ilike.${q}%,last_name.ilike.${q}%,medical_specialization.ilike.%${q}%`)
          .limit(limit),
    useFts && tsquery
      ? supabase
          .from('organizations')
          .select('id, org_name, org_slug, sport_type, city')
          .textSearch('search_doc', tsquery, { type: 'plain' })
          .limit(limit)
      : supabase
          .from('organizations')
          .select('id, org_name, org_slug, sport_type, city')
          .or(`org_name.ilike.${q}%,org_slug.ilike.${q}%`)
          .limit(limit),
  ])

  const people = (peopleRaw ?? []).map(u => ({
    id:         u.id,
    kind:       'user' as const,
    role:       u.role,
    name:       u.name || u.nickname || 'Пользователь',
    nickname:   u.nickname,
    avatar_url: u.avatar_url,
    subtitle:   [u.sport, u.city].filter(Boolean).join(' · ') || null,
    href:       `/profile/${u.id}`,
  }))

  const coaches = (coachesRes.data ?? []).map(c => ({
    id:         c.id,
    kind:       'coach' as const,
    name:       [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Тренер',
    avatar_url: c.avatar_url ?? null,
    subtitle:   [c.specialization, c.city].filter(Boolean).join(' · ') || null,
    href:       `/profile/${c.id}`,
  }))

  const doctors = (doctorsRes.data ?? []).map(d => ({
    id:         d.id,
    kind:       'doctor' as const,
    name:       [d.first_name, d.last_name].filter(Boolean).join(' ') || 'Врач',
    avatar_url: d.avatar_url ?? null,
    subtitle:   [d.medical_specialization, d.city].filter(Boolean).join(' · ') || null,
    href:       `/profile/${d.id}`,
  }))

  const organizations = (orgsRes.data ?? []).map(o => ({
    id:       o.id,
    kind:     'organization' as const,
    name:     o.org_name ?? 'Организация',
    subtitle: [o.sport_type, o.city].filter(Boolean).join(' · ') || null,
    href:     `/profile/${o.id}`,
  }))

  return NextResponse.json({ people, coaches, doctors, organizations })
}
