'use client'

/**
 * <ClearanceBadge /> — компактный traffic-light бейдж для current clearance.
 * Used by:
 *   - coach athletes list (app/athletes/page.tsx)
 *   - WorkoutAddDrawer banner (с size='lg')
 *   - athlete dashboard
 *   - parent dashboard
 * Один источник правды для отрисовки светофора (P3 #3).
 *
 * Принимает либо данные напрямую (current_clearances row), либо athleteId —
 * в последнем случае сам fetch'ит row через RLS-разрешённый запрос.
 */
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export type ClearanceStatus = 'full' | 'limited' | 'light_only' | 'banned'

export interface CurrentClearanceRow {
  status:        ClearanceStatus
  note:          string | null
  valid_until:   string | null
  review_needed: boolean
}

interface PropsWithData {
  current:     CurrentClearanceRow | null
  athleteId?:  never
  size?:       'sm' | 'md' | 'lg'
  showNote?:   boolean
}
interface PropsWithFetch {
  athleteId:   string
  current?:    never
  size?:       'sm' | 'md' | 'lg'
  showNote?:   boolean
}
type Props = PropsWithData | PropsWithFetch

const META: Record<ClearanceStatus, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  full:       { label: 'Полный',      emoji: '🟢', color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  limited:    { label: 'Ограниченный', emoji: '🟡', color: '#A16207', bg: '#FEFCE8', border: '#FDE68A' },
  light_only: { label: 'Лёгкий',      emoji: '🟠', color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' },
  banned:     { label: 'Запрет',      emoji: '🔴', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
}

const REVIEW_META = {
  label: 'требуется review', emoji: '⏳', color: '#475569', bg: '#F1F5F9', border: '#CBD5E1',
}

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}

export default function ClearanceBadge(props: Props) {
  const { size = 'sm', showNote = false } = props
  const [fetched, setFetched] = useState<CurrentClearanceRow | null | undefined>(undefined)

  useEffect(() => {
    if (!('athleteId' in props) || !props.athleteId) return
    let cancelled = false
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (sb() as any)
        .from('current_clearances')
        .select('status, note, valid_until, review_needed')
        .eq('athlete_id', props.athleteId)
        .maybeSingle()
      if (!cancelled) setFetched((data as CurrentClearanceRow | null) ?? null)
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, ['athleteId' in props ? props.athleteId : null])

  const current = 'current' in props ? props.current : fetched
  if (current === undefined) return null  // fetching, render nothing (avoid flicker)
  if (current === null) return null       // no clearance yet — nothing to show

  const m  = current.review_needed ? REVIEW_META : META[current.status]
  const px = size === 'sm' ? '4px 9px' : size === 'md' ? '6px 12px' : '8px 14px'
  const fs = size === 'sm' ? 11 : size === 'md' ? 13 : 14

  return (
    <span title={current.note ?? undefined} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: px, borderRadius: 999,
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
      fontSize: fs, fontWeight: 700, lineHeight: 1.1,
    }}>
      <span>{m.emoji}</span>
      <span>{m.label}</span>
      {showNote && current.valid_until && !current.review_needed && (
        <span style={{ fontWeight: 500, opacity: 0.75, marginLeft: 4 }}>
          · до {fmtDate(current.valid_until)}
        </span>
      )}
    </span>
  )
}
