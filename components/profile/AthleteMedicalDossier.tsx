'use client'
/**
 * AthleteMedicalDossier — Sprint W21 (audit #2).
 *
 * Surfaces an athlete's active medical recommendations / restrictions on
 * the profile page (app/profile/[id]) when the viewer is a LINKED
 * coach / doctor / organization. Before this, that screen was a vanity
 * profile — a coach clicking their athlete got bio + stats but nothing
 * actionable, breaking the doctor → coach → athlete loop.
 *
 * SECURITY: data comes exclusively from GET /api/recommendations?athlete_id=…
 * which authenticates the caller and relies on RLS for ALL visibility
 * scoping (athlete_only / coach_only / coach_and_athlete / org_full). This
 * component adds NO Supabase query of its own — it can only ever render
 * what the viewer's tier + RLS already permit. The parent gates rendering
 * to accepted connections; this fetch is a second, server-enforced line of
 * defence (RLS returns [] for anyone not entitled).
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CATEGORY_META,
  SEVERITY_META,
  type Recommendation,
} from '@/services/recommendations.service'

interface Props {
  athleteId: string
}

type LoadState = 'loading' | 'ready' | 'error'

const SECTION_COLOR = '#DC2626'
const SECTION_BG = '#FEF2F2'

export default function AthleteMedicalDossier({ athleteId }: Props) {
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [state, setState] = useState<LoadState>('loading')

  const load = useCallback(async () => {
    setState('loading')
    try {
      const res = await fetch(
        `/api/recommendations?athlete_id=${encodeURIComponent(athleteId)}`,
        { cache: 'no-store' },
      )
      const json = (await res.json()) as { ok: boolean; data?: Recommendation[] }
      if (!res.ok || !json.ok) {
        setState('error')
        return
      }
      // Only surface live recommendations (skip drafts / closed / expired).
      const active = (json.data ?? []).filter(r =>
        r.status === 'sent' || r.status === 'active' || r.status === 'acknowledged',
      )
      setRecs(active)
      setState('ready')
    } catch {
      setState('error')
    }
  }, [athleteId])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: SECTION_COLOR, textTransform: 'uppercase', letterSpacing: '0.14em', display: 'inline-block', background: SECTION_BG, padding: '3px 10px', borderRadius: 99, margin: 0 }}>
          Медицинские рекомендации и ограничения
        </p>
        <Link href="/diary" style={{ fontSize: 11, fontWeight: 700, color: SECTION_COLOR, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          Открыть дневник →
        </Link>
      </div>

      {state === 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
          <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Загрузка…</span>
        </div>
      )}

      {state === 'error' && (
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>
          Не удалось загрузить рекомендации. <button onClick={load} style={{ color: SECTION_COLOR, fontWeight: 600, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Повторить</button>
        </p>
      )}

      {state === 'ready' && recs.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>
          Активных рекомендаций нет.
        </p>
      )}

      {state === 'ready' && recs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recs.map(r => {
            const cat = CATEGORY_META[r.category]
            const sev = SEVERITY_META[r.severity]
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'var(--accent)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: sev.bg, border: `1px solid ${sev.border}`, color: sev.color }}>
                  <i className={`ki-filled ${cat.icon} text-sm`} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>{r.title}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '1px 7px', borderRadius: 99, background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}>{sev.label}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: 'var(--card)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>{cat.label}</span>
                    {r.valid_until && (
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A' }}>
                        до {new Date(r.valid_until + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                  {r.body && (
                    <p style={{ fontSize: 12, color: 'var(--foreground)', opacity: 0.9, lineHeight: 1.45, margin: '4px 0 0' }}>{r.body}</p>
                  )}
                  <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '6px 0 0' }}>
                    {new Date(r.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
