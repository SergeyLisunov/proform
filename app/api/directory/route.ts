import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizeFilterTerm } from '@/lib/utils/search'

type DirType = 'coach' | 'doctor' | 'organization'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const sp = req.nextUrl.searchParams
  const type = (sp.get('type') as DirType) ?? 'coach'
  const q = sanitizeFilterTerm(sp.get('q')?.trim() ?? '')
  const city = sp.get('city')?.trim() ?? ''
  const specialization = sp.get('specialization')?.trim() ?? ''
  const format = sp.get('format')?.trim() ?? ''
  const maxPrice = sp.get('max_price') ? Number(sp.get('max_price')) : null
  const acceptsNew = sp.get('accepts') === '1'
  const sportType = sp.get('sport_type')?.trim() ?? ''
  const orgType = sp.get('org_type')?.trim() ?? ''

  if (type === 'coach') {
    let qb = supabase
      .from('coaches')
      .select('id, first_name, last_name, city, country, bio, specialization, experience_years, hourly_rate, currency, session_formats, accepts_new_athletes, profile_public, sports, workplace, athletes_count, users!inner(avatar_url, nickname, role)')
      .eq('profile_public', true)
      .limit(60)
    if (q) qb = qb.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,bio.ilike.%${q}%,workplace.ilike.%${q}%`)
    if (city) qb = qb.ilike('city', `%${city}%`)
    if (specialization) qb = qb.eq('specialization', specialization)
    if (format) qb = qb.contains('session_formats', [format])
    if (maxPrice) qb = qb.lte('hourly_rate', maxPrice)
    if (acceptsNew) qb = qb.eq('accepts_new_athletes', true)
    const { data, error } = await qb
    if (error) return NextResponse.json({ error: 'server_error' }, { status: 400 })
    return NextResponse.json({ items: data ?? [] })
  }

  if (type === 'doctor') {
    let qb = supabase
      .from('doctors')
      .select('id, first_name, last_name, city, country, bio, medical_specialization, experience_years, consultation_fee, currency, services, consultation_formats, accepts_new_patients, profile_public, main_focus, workplace, emergency_contact, users!inner(avatar_url, nickname, role)')
      .eq('profile_public', true)
      .limit(60)
    if (q) qb = qb.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,bio.ilike.%${q}%,main_focus.ilike.%${q}%`)
    if (city) qb = qb.ilike('city', `%${city}%`)
    if (specialization) qb = qb.eq('medical_specialization', specialization)
    if (format) qb = qb.contains('consultation_formats', [format])
    if (maxPrice) qb = qb.lte('consultation_fee', maxPrice)
    if (acceptsNew) qb = qb.eq('accepts_new_patients', true)
    const { data, error } = await qb
    if (error) return NextResponse.json({ error: 'server_error' }, { status: 400 })
    return NextResponse.json({ items: data ?? [] })
  }

  // organization
  let qb = supabase
    .from('organizations')
    .select('id, org_name, org_slug, description, city, country, sport_type, org_type, founded_year, members_count, coaches_count, services, training_base, profile_public, users!inner(avatar_url, role)')
    .eq('profile_public', true)
    .limit(60)
  if (q) qb = qb.or(`org_name.ilike.%${q}%,description.ilike.%${q}%,training_base.ilike.%${q}%`)
  if (city) qb = qb.ilike('city', `%${city}%`)
  if (sportType) qb = qb.eq('sport_type', sportType)
  if (orgType) qb = qb.eq('org_type', orgType)
  const { data, error } = await qb
  if (error) return NextResponse.json({ error: 'server_error' }, { status: 400 })
  return NextResponse.json({ items: data ?? [] })
}
