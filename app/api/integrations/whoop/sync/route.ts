import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  refreshTokens, whoopRecovery, whoopCycles, whoopSleep,
} from '@/lib/integrations/whoop/adapter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/integrations/whoop/sync
 *
 * Тянет последние 14 дней Whoop-метрик и upsert'ит в daily_metrics.
 * Обновляет access_token через refresh при истечении. Запись об
 * успехе/ошибке пишется в user_device_connections.last_sync_*.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  const { data: me } = await supabase.from('users').select('id').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  const meId = (me as { id: string }).id

  const admin = createAdminClient()
  const { data: connRaw } = await admin
    .from('user_device_connections')
    .select('*')
    .eq('user_id', meId).eq('provider', 'whoop').maybeSingle()
  const conn = connRaw as {
    id: string
    access_token: string | null
    refresh_token: string | null
    token_expires_at: string | null
    status: string
  } | null

  if (!conn || conn.status !== 'connected' || !conn.access_token) {
    return NextResponse.json({ ok: false, error: 'NOT_CONNECTED' }, { status: 400 })
  }

  // Refresh если токен протух или осталось < 60 секунд.
  let accessToken = conn.access_token
  if (conn.refresh_token && conn.token_expires_at) {
    const expiresMs = new Date(conn.token_expires_at).getTime()
    if (expiresMs - Date.now() < 60_000) {
      try {
        const fresh = await refreshTokens(conn.refresh_token)
        accessToken = fresh.access_token
        await admin.from('user_device_connections').update({
          access_token: fresh.access_token,
          refresh_token: fresh.refresh_token,
          token_expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
        }).eq('id', conn.id)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        await admin.from('user_device_connections').update({
          status: 'failed', last_sync_error: `refresh: ${msg}`,
        }).eq('id', conn.id)
        return NextResponse.json({ ok: false, error: 'REFRESH_FAILED' }, { status: 401 })
      }
    }
  }

  const sinceISO = new Date(Date.now() - 14 * 86400000).toISOString()
  let upsertedCount = 0
  try {
    const [recovery, cycles, sleep] = await Promise.all([
      whoopRecovery(accessToken, sinceISO),
      whoopCycles(accessToken, sinceISO),
      whoopSleep(accessToken, sinceISO),
    ])

    // Build by-date map. Whoop cycles соответствуют «суткам» Whoop —
    // берём дату их start как опорную.
    const byDate: Record<string, {
      recovery_score?: number
      hrv?: number
      resting_heart_rate?: number
      day_strain?: number
      sleep_hours?: number
      sleep_efficiency?: number
      skin_temp_deviation?: number
    }> = {}
    for (const c of cycles) {
      if (c.score_state !== 'SCORED' || !c.score) continue
      const d = c.start.slice(0, 10)
      ;(byDate[d] ??= {}).day_strain = Number(c.score.strain.toFixed(2))
    }
    for (const r of recovery) {
      if (r.score_state !== 'SCORED' || !r.score) continue
      const d = r.created_at.slice(0, 10)
      const bucket = byDate[d] ??= {}
      bucket.recovery_score = r.score.recovery_score
      bucket.hrv            = Number(r.score.hrv_rmssd_milli.toFixed(1))
      bucket.resting_heart_rate = r.score.resting_heart_rate
      if (r.score.skin_temp_celsius != null)
        bucket.skin_temp_deviation = r.score.skin_temp_celsius
    }
    for (const s of sleep) {
      if (s.score_state !== 'SCORED' || !s.score?.stage_summary) continue
      const d = s.start.slice(0, 10)
      const bucket = byDate[d] ??= {}
      const summary = s.score.stage_summary
      const totalMs = summary.total_in_bed_time_milli - summary.total_awake_time_milli
      bucket.sleep_hours      = Number((totalMs / 3600_000).toFixed(2))
      bucket.sleep_efficiency = s.score.sleep_performance_percentage ?? undefined
    }

    const rows = Object.entries(byDate)
      .filter(([, v]) => Object.keys(v).length > 0)
      .map(([date, v]) => ({ athlete_id: meId, date, ...v }))
    if (rows.length > 0) {
      const { error } = await admin.from('daily_metrics')
        .upsert(rows, { onConflict: 'athlete_id,date' })
      if (error) throw error
      upsertedCount = rows.length
    }

    await admin.from('user_device_connections').update({
      status: 'connected',
      last_sync_at: new Date().toISOString(),
      last_sync_error: null,
    }).eq('id', conn.id)

    return NextResponse.json({ ok: true, count: upsertedCount })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[whoop/sync]', msg)
    await admin.from('user_device_connections').update({
      status: 'failed',
      last_sync_error: msg.slice(0, 400),
    }).eq('id', conn.id)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
