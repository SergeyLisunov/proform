/**
 * CoachRestrictionsWidget — closes the Doctor → Coach feedback loop.
 *
 * Sprint Week 1, Day 1 — until migration 048 + this widget shipped, a
 * doctor/specialist could write "no jumping for 2 weeks" in their
 * medical_diary, but the coach had no UI surface for it. This widget
 * surfaces medical_diary entries where is_shared_with_coach=true for
 * any athlete the coach is linked to via trainer_athletes (status='accepted').
 *
 * RLS guarantees the coach only sees rows whitelisted by the doctor
 * AND only for connected athletes (policy `medical_diary_coach_shared`).
 *
 * Renders as a compact card on the coach dashboard. Hidden entirely if
 * there are no active shared restrictions, so it doesn't clutter the
 * UX of coaches with healthy teams.
 */
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type MedicalDiaryRow = Database['public']['Tables']['medical_diary']['Row']
type UserRow         = Database['public']['Tables']['users']['Row']

const ENTRY_TYPE_LABEL: Record<string, string> = {
  consultation:    'Консультация',
  rehab_progress:  'Реабилитация',
  prescription:    'Назначение',
  lab_results:     'Анализы',
  nutrition_plan:  'Питание',
  injury_note:     'Травма',
  observation:     'Наблюдение',
  schedule:        'Приём',
}

const SEVERITY_COLOR: Record<string, { bg: string; fg: string; border: string }> = {
  low:      { bg: '#F0FDF4', fg: '#15803D', border: '#BBF7D0' },
  moderate: { bg: '#FFF7ED', fg: '#C2410C', border: '#FED7AA' },
  high:     { bg: '#FEF2F2', fg: '#B91C1C', border: '#FECACA' },
  critical: { bg: '#FEE2E2', fg: '#7F1D1D', border: '#FCA5A5' },
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'short',
  })
}

export default async function CoachRestrictionsWidget({
  athleteIds,
}: {
  athleteIds: string[]
}) {
  if (athleteIds.length === 0) return null

  const sb = await createClient()

  // Fetch shared medical entries (RLS does the heavy lifting).
  const { data: entriesRaw } = await sb
    .from('medical_diary')
    .select('id, athlete_id, doctor_id, date, entry_type, title, note, severity, body_part, pain_level')
    .eq('is_shared_with_coach', true)
    .in('athlete_id', athleteIds)
    .order('date', { ascending: false })
    .limit(20)
  const entries = (entriesRaw ?? []) as Array<
    Pick<MedicalDiaryRow,
      'id' | 'athlete_id' | 'doctor_id' | 'date' | 'entry_type'
      | 'title' | 'note' | 'severity' | 'body_part' | 'pain_level'>
  >

  if (entries.length === 0) return null

  // Resolve athlete + doctor names in batch.
  const userIds = Array.from(new Set([
    ...entries.map(e => e.athlete_id).filter((x): x is string => !!x),
    ...entries.map(e => e.doctor_id),
  ]))
  const { data: usersRaw } = userIds.length
    ? await sb.from('users').select('id, name').in('id', userIds)
    : { data: [] as Array<Pick<UserRow, 'id' | 'name'>> }
  const nameById = new Map(
    ((usersRaw ?? []) as Array<Pick<UserRow, 'id' | 'name'>>).map(u => [u.id, u.name ?? '—']),
  )

  return (
    <div
      className="rounded-2xl border border-rose-200 overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#FEF2F2 0%,#FFF8F8 60%,#FFFFFF 100%)' }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-rose-100/80">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-rose-100">
            <i className="ki-filled ki-shield-cross text-base text-rose-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground leading-none">Медицинские ограничения</h3>
            <div className="text-[10px] text-muted-foreground mt-1">
              От врачей и специалистов · {entries.length}
            </div>
          </div>
        </div>
        <Link href="/diary"
          className="text-[11px] font-semibold text-rose-600 hover:underline shrink-0">
          Все →
        </Link>
      </div>

      <div className="divide-y divide-rose-100/70">
        {entries.slice(0, 6).map(e => {
          const sev = e.severity ? SEVERITY_COLOR[e.severity] ?? null : null
          return (
            <div key={e.id} className="flex items-start gap-3 px-5 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-rose-100">
                <i className="ki-filled ki-shield-tick text-sm text-rose-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <span className="text-[13px] font-bold text-foreground truncate max-w-[180px]">
                    {e.athlete_id ? nameById.get(e.athlete_id) ?? 'Атлет' : 'Атлет'}
                  </span>
                  <span className="rounded-full px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700">
                    {ENTRY_TYPE_LABEL[e.entry_type] ?? e.entry_type}
                  </span>
                  {sev && (
                    <span
                      className="rounded-full px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: sev.bg, color: sev.fg, border: `1px solid ${sev.border}` }}>
                      {e.severity === 'low' ? 'Лёгкая'
                        : e.severity === 'moderate' ? 'Умеренная'
                        : e.severity === 'high' ? 'Высокая'
                        : 'Критическая'}
                    </span>
                  )}
                  {e.body_part && (
                    <span className="rounded-full px-1.5 py-[1px] text-[9px] font-semibold bg-slate-100 text-slate-600">
                      {e.body_part}
                    </span>
                  )}
                  {typeof e.pain_level === 'number' && (
                    <span className={`rounded-full px-1.5 py-[1px] text-[9px] font-bold ${
                      e.pain_level >= 7 ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'
                    }`}>
                      Боль {e.pain_level}/10
                    </span>
                  )}
                </div>
                <div className="text-[12px] font-semibold text-foreground/90 leading-snug truncate">
                  {e.title || (e.note ?? '').slice(0, 80)}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {fmtDate(e.date)} · от {nameById.get(e.doctor_id) ?? 'врач'}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {entries.length > 6 && (
        <div className="px-5 py-2.5 border-t border-rose-100/70 bg-white/50 text-center">
          <Link href="/diary" className="text-[11px] font-semibold text-rose-600 hover:underline">
            Ещё {entries.length - 6} →
          </Link>
        </div>
      )}
    </div>
  )
}
