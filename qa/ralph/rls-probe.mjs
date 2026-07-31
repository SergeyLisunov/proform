#!/usr/bin/env node
/**
 * Sporteo RLS probe — ролевой матричный тест изоляции данных на уровне БД.
 *
 * Логинится настоящим паролем под каждой QA-ролью, получает JWT и ходит в
 * PostgREST от имени этой роли. Проверяет то, что не проверить статическим
 * аудитом: реально ли RLS закрывает чужие организации, чужих спортсменов и
 * медицинские данные — даже если приложение забудет проверку.
 *
 * Секреты: пароль берётся из QA_PASSWORD или из файла QA_ACCOUNTS_FILE
 * (по умолчанию ~/sporteo-qa-accounts.txt, chmod 600). В репозиторий
 * пароли не попадают.
 *
 * Запуск:  node qa/ralph/rls-probe.mjs
 * Вывод:   таблица результатов + qa/ralph/evidence/rls-probe.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// ── конфигурация ────────────────────────────────────────────────────────────
function loadEnvLocal() {
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Нет NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (.env.local)')
  process.exit(2)
}

function qaPassword() {
  if (process.env.QA_PASSWORD) return process.env.QA_PASSWORD
  const file = process.env.QA_ACCOUNTS_FILE || join(homedir(), 'sporteo-qa-accounts.txt')
  const m = /Sporteo-QA-[A-Za-z0-9]+/.exec(readFileSync(file, 'utf8'))
  if (!m) throw new Error(`Пароль не найден в ${file}; задайте QA_PASSWORD`)
  return m[0]
}

const ROLES = {
  ownerAlpha:   'qa.owner.alpha@sporteo-qa.dev',
  coachAlpha1:  'qa.coach.alpha1@sporteo-qa.dev',
  coachAlpha2:  'qa.coach.alpha2@sporteo-qa.dev',
  doctorAlpha:  'qa.doctor.alpha@sporteo-qa.dev',
  athleteAlpha1:'qa.athlete.alpha1@sporteo-qa.dev',
  athleteAlpha2:'qa.athlete.alpha2@sporteo-qa.dev',
  ownerBeta:    'qa.owner.beta@sporteo-qa.dev',
  coachBeta:    'qa.coach.beta@sporteo-qa.dev',
  doctorBeta:   'qa.doctor.beta@sporteo-qa.dev',
  athleteBeta:  'qa.athlete.beta@sporteo-qa.dev',
  platformOwner:'qa.platform.owner@sporteo-qa.dev',
}

// ── низкоуровневые помощники ────────────────────────────────────────────────
async function login(email, password) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error(`login ${email}: ${j.error_description || j.msg || r.status}`)
  return j.access_token
}

async function rest(token, path, init = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  let body = null
  try { body = await r.json() } catch { /* 204 */ }
  return { status: r.status, body }
}

const rows = r => (Array.isArray(r.body) ? r.body.length : r.status >= 400 ? -1 : 0)

// ── реестр проверок ─────────────────────────────────────────────────────────
const results = []
function check(id, title, severity, expected, actual, detail) {
  const pass = expected === actual
  results.push({ id, title, severity, expected, actual, pass, detail })
  const mark = pass ? '✅' : '❌'
  console.log(`${mark} ${id.padEnd(10)} ${title}\n     ожидалось: ${expected} · получено: ${actual}${detail ? ' · ' + detail : ''}`)
}

async function main() {
  const password = qaPassword()
  const tokens = {}
  for (const [key, email] of Object.entries(ROLES)) {
    tokens[key] = await login(email, password)
  }
  console.log(`\nВошли под ${Object.keys(tokens).length} ролями\n${'─'.repeat(72)}`)

  // Идентификаторы через собственные строки (каждая роль видит себя).
  const ids = {}
  for (const key of Object.keys(ROLES)) {
    const me = await rest(tokens[key], `users?select=id,role,email&email=eq.${encodeURIComponent(ROLES[key])}`)
    ids[key] = me.body?.[0]?.id ?? null
  }
  const missing = Object.entries(ids).filter(([, v]) => !v).map(([k]) => k)
  if (missing.length) console.log(`⚠️  не удалось прочитать собственный users-ряд: ${missing.join(', ')}`)

  // ── 1. Cross-tenant: чужая организация ────────────────────────────────────
  const betaOrg = await rest(tokens.ownerBeta, 'organizations?select=id,org_slug&org_slug=eq.qa-club-beta')
  const betaOrgId = betaOrg.body?.[0]?.id
  const alphaOrg = await rest(tokens.ownerAlpha, 'organizations?select=id,org_slug&org_slug=eq.qa-club-alpha')
  const alphaOrgId = alphaOrg.body?.[0]?.id

  const alphaSeesBetaMembers = await rest(tokens.ownerAlpha, `org_members?select=id&org_id=eq.${betaOrgId}`)
  check('XT-01', 'Владелец Alpha НЕ видит состав организации Beta', 'P0', 0, rows(alphaSeesBetaMembers),
    `org_members(beta) → ${JSON.stringify(alphaSeesBetaMembers.body)?.slice(0, 80)}`)

  const betaSeesAlphaMembers = await rest(tokens.ownerBeta, `org_members?select=id&org_id=eq.${alphaOrgId}`)
  check('XT-02', 'Владелец Beta НЕ видит состав организации Alpha', 'P0', 0, rows(betaSeesAlphaMembers))

  // ── 2. Cross-tenant: чужой спортсмен ──────────────────────────────────────
  const coachAlphaSeesBetaAthlete = await rest(tokens.coachAlpha1,
    `users?select=id,email&id=eq.${ids.athleteBeta}`)
  check('XT-03', 'Тренер Alpha НЕ читает профиль спортсмена Beta', 'P0', 0, rows(coachAlphaSeesBetaAthlete))

  const coachAlphaSeesBetaWorkouts = await rest(tokens.coachAlpha1,
    `workouts?select=id&athlete_id=eq.${ids.athleteBeta}`)
  check('XT-04', 'Тренер Alpha НЕ читает тренировки спортсмена Beta', 'P0', 0, rows(coachAlphaSeesBetaWorkouts))

  const doctorAlphaSeesBetaAthlete = await rest(tokens.doctorAlpha,
    `wellness_checkins?select=id&athlete_id=eq.${ids.athleteBeta}`)
  check('XT-05', 'Врач Alpha НЕ читает самочувствие спортсмена Beta', 'P0', 0, rows(doctorAlphaSeesBetaAthlete))

  // ── 3. Внутри организации: чужой спортсмен другого тренера ────────────────
  const coach2SeesAthlete1 = await rest(tokens.coachAlpha2,
    `workouts?select=id&athlete_id=eq.${ids.athleteAlpha1}`)
  check('IN-01', 'Тренер Alpha-2 НЕ читает тренировки спортсмена другого тренера', 'P0', 0, rows(coach2SeesAthlete1))

  const athlete2SeesAthlete1 = await rest(tokens.athleteAlpha2,
    `workouts?select=id&athlete_id=eq.${ids.athleteAlpha1}`)
  check('IN-02', 'Спортсмен НЕ читает тренировки другого спортсмена', 'P0', 0, rows(athlete2SeesAthlete1))

  // ── 4. Свои данные видны (позитивный контроль) ────────────────────────────
  const coach1SeesOwn = await rest(tokens.coachAlpha1, `workouts?select=id&athlete_id=eq.${ids.athleteAlpha1}`)
  check('POS-01', 'Тренер Alpha-1 ВИДИТ тренировки своего спортсмена', 'P1', 1, rows(coach1SeesOwn))

  const athlete1SeesOwn = await rest(tokens.athleteAlpha1, `workouts?select=id&athlete_id=eq.${ids.athleteAlpha1}`)
  check('POS-02', 'Спортсмен ВИДИТ свои тренировки', 'P1', 1, rows(athlete1SeesOwn))

  // ── 5. Медицинская конфиденциальность ─────────────────────────────────────
  const orgSeesMedicalDiary = await rest(tokens.ownerAlpha, 'medical_diary?select=id&limit=5')
  check('MED-01', 'Организация НЕ читает медицинский дневник', 'P0', 0, rows(orgSeesMedicalDiary))

  const coachSeesMedicalDiary = await rest(tokens.coachAlpha1, 'medical_diary?select=id&limit=5')
  check('MED-02', 'Тренер НЕ читает медицинский дневник', 'P0', 0, rows(coachSeesMedicalDiary))

  const doctorBetaSeesAlphaRec = await rest(tokens.doctorBeta,
    `recommendations?select=id&athlete_id=eq.${ids.athleteAlpha1}`)
  check('MED-03', 'Врач Beta НЕ читает рекомендации спортсмена Alpha', 'P0', 0, rows(doctorBetaSeesAlphaRec))

  const coach1SeesRec = await rest(tokens.coachAlpha1,
    `recommendations?select=id,title&athlete_id=eq.${ids.athleteAlpha1}`)
  check('MED-04', 'Тренер-адресат ВИДИТ рекомендацию (visibility coach_and_athlete)', 'P1', 1, rows(coach1SeesRec))

  const athlete1SeesRec = await rest(tokens.athleteAlpha1,
    `recommendations?select=id,title&athlete_id=eq.${ids.athleteAlpha1}`)
  check('MED-05', 'Спортсмен ВИДИТ адресованную ему рекомендацию', 'P1', 1, rows(athlete1SeesRec))

  const coach2SeesRec = await rest(tokens.coachAlpha2,
    `recommendations?select=id&athlete_id=eq.${ids.athleteAlpha1}`)
  check('MED-06', 'Посторонний тренер НЕ видит чужую рекомендацию', 'P0', 0, rows(coach2SeesRec))

  // ── 6. Запись в чужие данные ──────────────────────────────────────────────
  const forgeWorkout = await rest(tokens.athleteAlpha2, 'workouts', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      athlete_id: ids.athleteAlpha1, event_date: new Date().toISOString().slice(0, 10),
      event_type: 'workout', activity_type: 'Бег', name: 'QA-PROBE: подделка',
    }),
  })
  check('WR-01', 'Спортсмен НЕ может записать тренировку другому спортсмену', 'P0', true,
    forgeWorkout.status >= 400 || rows(forgeWorkout) === 0,
    `status=${forgeWorkout.status}`)

  const forgeRole = await rest(tokens.athleteAlpha2, `users?id=eq.${ids.athleteAlpha2}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ role: 'admin' }),
  })
  const roleAfter = await rest(tokens.athleteAlpha2, `users?select=role&id=eq.${ids.athleteAlpha2}`)
  check('WR-02', 'Спортсмен НЕ может повысить себе роль до admin', 'P0', true,
    roleAfter.body?.[0]?.role !== 'admin',
    `роль после попытки: ${roleAfter.body?.[0]?.role} (PATCH status=${forgeRole.status})`)

  const forgeMembership = await rest(tokens.athleteAlpha2, 'org_members', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ org_id: betaOrgId, user_id: ids.athleteAlpha2, member_role: 'org_admin', status: 'active' }),
  })
  check('WR-03', 'Спортсмен НЕ может вписать себя админом в чужую организацию', 'P0', true,
    forgeMembership.status >= 400 || rows(forgeMembership) === 0,
    `status=${forgeMembership.status}`)

  // ── 6b. Медицинская запись чужому пациенту (P0, миграция 105) ─────────────
  const forgeRec = await rest(tokens.doctorBeta, 'recommendations', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      organization_id: alphaOrgId,
      athlete_id: ids.athleteAlpha1,
      doctor_id: ids.doctorBeta,
      title: 'QA-PROBE: чужой пациент',
      category: 'general', severity: 'low',
      visibility_level: 'coach_and_athlete', status: 'draft',
    }),
  })
  check('MED-07', 'Врач НЕ может выписать рекомендацию не своему пациенту', 'P0', true,
    forgeRec.status >= 400 || rows(forgeRec) === 0,
    `status=${forgeRec.status}`)

  const selfRec = await rest(tokens.doctorAlpha, 'recommendations', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      organization_id: alphaOrgId,
      athlete_id: ids.athleteAlpha1,
      doctor_id: ids.doctorAlpha,
      title: 'QA-PROBE: свой пациент',
      category: 'general', severity: 'low',
      visibility_level: 'coach_and_athlete', status: 'draft',
    }),
  })
  check('MED-08', 'Врач ВСЁ ЕЩЁ может выписать рекомендацию своему пациенту', 'P1', 1, rows(selfRec),
    `status=${selfRec.status}`)
  // прибираем за собой
  if (rows(selfRec) === 1) {
    await rest(tokens.doctorAlpha, `recommendations?title=eq.${encodeURIComponent('QA-PROBE: свой пациент')}`, { method: 'DELETE' })
  }

  // ── 7. Приватные AI-диалоги ───────────────────────────────────────────────
  const ownerSeesAiConv = await rest(tokens.ownerAlpha, 'ai_conversations?select=id&limit=5')
  check('AI-01', 'Организация НЕ читает чужие AI-диалоги', 'P0', 0, rows(ownerSeesAiConv))

  const platformSeesAiConv = await rest(tokens.platformOwner, 'ai_conversations?select=id&limit=5')
  check('AI-02', 'Владелец платформы НЕ читает приватные AI-диалоги по умолчанию', 'P0', 0, rows(platformSeesAiConv))

  // ── 8. Владелец платформы и чужие медданные ───────────────────────────────
  const platformSeesMedical = await rest(tokens.platformOwner, 'medical_diary?select=id&limit=5')
  check('OWN-01', 'Владелец платформы НЕ читает медицинский дневник по умолчанию', 'P0', 0, rows(platformSeesMedical))

  // ── отчёт ─────────────────────────────────────────────────────────────────
  const failed = results.filter(r => !r.pass)
  console.log('─'.repeat(72))
  console.log(`Проверок: ${results.length} · прошло: ${results.length - failed.length} · упало: ${failed.length}`)
  if (failed.length) {
    console.log('\nУПАВШИЕ:')
    for (const f of failed) console.log(`  [${f.severity}] ${f.id} ${f.title} → ${f.actual} (ожидалось ${f.expected})`)
  }

  mkdirSync(join(process.cwd(), 'qa/ralph/evidence'), { recursive: true })
  writeFileSync(
    join(process.cwd(), 'qa/ralph/evidence/rls-probe.json'),
    JSON.stringify({ ranAt: new Date().toISOString(), total: results.length, failed: failed.length, results }, null, 2)
  )
  process.exit(failed.length ? 1 : 0)
}

main().catch(e => { console.error('ПРОБА УПАЛА:', e.message); process.exit(2) })
