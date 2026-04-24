/**
 * Whoop OAuth 2.0 integration — полный цикл: authorize → token exchange →
 * refresh → data sync.
 *
 * Docs: https://developer.whoop.com
 * Auth:   https://api.prod.whoop.com/oauth/oauth2/auth
 * Token:  https://api.prod.whoop.com/oauth/oauth2/token
 * API:    https://api.prod.whoop.com/developer/v1
 *
 * Требует envs: WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET.
 * Redirect URI: {NEXT_PUBLIC_APP_URL}/api/integrations/whoop/callback
 */

const AUTH_URL  = 'https://api.prod.whoop.com/oauth/oauth2/auth'
const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'
const API_BASE  = 'https://api.prod.whoop.com/developer/v1'

export const WHOOP_SCOPES = [
  'read:profile',
  'read:recovery',
  'read:cycles',
  'read:workout',
  'read:sleep',
].join(' ')

export function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://proform-delta.vercel.app'
  return `${base}/api/integrations/whoop/callback`
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID ?? '',
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: WHOOP_SCOPES,
    state,
  })
  return `${AUTH_URL}?${params.toString()}`
}

export interface WhoopTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope: string
}

export async function exchangeCode(code: string): Promise<WhoopTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    client_id: process.env.WHOOP_CLIENT_ID ?? '',
    client_secret: process.env.WHOOP_CLIENT_SECRET ?? '',
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`Whoop token exchange failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as WhoopTokens
}

export async function refreshTokens(refreshToken: string): Promise<WhoopTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.WHOOP_CLIENT_ID ?? '',
    client_secret: process.env.WHOOP_CLIENT_SECRET ?? '',
    scope: WHOOP_SCOPES,
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`Whoop refresh failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as WhoopTokens
}

// ── Public API fetchers ────────────────────────────────────────────────────

async function whoopFetch<T>(token: string, path: string, search?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  for (const [k, v] of Object.entries(search ?? {})) url.searchParams.set(k, v)
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Whoop API ${path} failed: ${res.status}`)
  return (await res.json()) as T
}

export interface WhoopUser { user_id: number; email: string; first_name?: string; last_name?: string }

export interface WhoopRecoveryRecord {
  cycle_id: number
  sleep_id: number
  created_at: string         // ISO timestamp
  updated_at: string
  score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE'
  score?: {
    user_calibrating: boolean
    recovery_score: number   // 0..100
    resting_heart_rate: number
    hrv_rmssd_milli: number
    spo2_percentage?: number
    skin_temp_celsius?: number
  }
}

export interface WhoopCycleRecord {
  id: number
  created_at: string
  updated_at: string
  start: string; end?: string
  timezone_offset: string
  score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE'
  score?: {
    strain: number           // 0..21
    kilojoule: number
    average_heart_rate: number
    max_heart_rate: number
  }
}

export interface WhoopSleepRecord {
  id: number
  created_at: string
  updated_at: string
  start: string; end: string
  score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE'
  score?: {
    stage_summary?: {
      total_in_bed_time_milli: number
      total_awake_time_milli: number
      total_light_sleep_time_milli: number
      total_slow_wave_sleep_time_milli: number
      total_rem_sleep_time_milli: number
      sleep_cycle_count: number
    }
    sleep_performance_percentage?: number
  }
}

export async function whoopProfile(token: string): Promise<WhoopUser> {
  return whoopFetch<WhoopUser>(token, '/user/profile/basic')
}

export async function whoopRecovery(token: string, sinceISO: string): Promise<WhoopRecoveryRecord[]> {
  const res = await whoopFetch<{ records: WhoopRecoveryRecord[]; next_token?: string }>(
    token, '/recovery', { limit: '25', start: sinceISO },
  )
  return res.records ?? []
}

export async function whoopCycles(token: string, sinceISO: string): Promise<WhoopCycleRecord[]> {
  const res = await whoopFetch<{ records: WhoopCycleRecord[]; next_token?: string }>(
    token, '/cycle', { limit: '25', start: sinceISO },
  )
  return res.records ?? []
}

export async function whoopSleep(token: string, sinceISO: string): Promise<WhoopSleepRecord[]> {
  const res = await whoopFetch<{ records: WhoopSleepRecord[]; next_token?: string }>(
    token, '/activity/sleep', { limit: '25', start: sinceISO },
  )
  return res.records ?? []
}
