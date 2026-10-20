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

  // ── 6c. Запрос врачу о чужом спортсмене (P1, миграция 106) ────────────────
  const forgeInquiry = await rest(tokens.coachAlpha2, 'doctor_inquiries', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      coach_id: ids.coachAlpha2, athlete_id: ids.athleteAlpha1,
      question: 'QA-PROBE: вопрос о чужом спортсмене', question_type: 'general',
    }),
  })
  check('INQ-01', 'Тренер НЕ может создать запрос врачу о чужом спортсмене', 'P1', true,
    forgeInquiry.status >= 400 || rows(forgeInquiry) === 0, `status=${forgeInquiry.status}`)

  const ownInquiry = await rest(tokens.coachAlpha1, 'doctor_inquiries', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      coach_id: ids.coachAlpha1, athlete_id: ids.athleteAlpha1,
      question: 'QA-PROBE: вопрос о своём спортсмене', question_type: 'general',
    }),
  })
  check('INQ-02', 'Тренер ВСЁ ЕЩЁ может спросить врача о своём спортсмене', 'P1', 1, rows(ownInquiry),
    `status=${ownInquiry.status}`)
  if (rows(ownInquiry) === 1) {
    await rest(tokens.coachAlpha1, `doctor_inquiries?id=eq.${ownInquiry.body[0].id}`, { method: 'DELETE' })
  }

  // ── 6d. Записи о травме: авторство (P1, миграция 106) ─────────────────────
  const docInjury = await rest(tokens.doctorAlpha, 'injuries', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      athlete_id: ids.athleteAlpha1, reported_by: ids.doctorAlpha,
      onset_date: new Date().toISOString().slice(0, 10),
      body_part: 'QA-PROBE колено', description: 'Синтетическая запись QA',
    }),
  })
  check('INJ-01', 'Врач может внести запись о травме своему пациенту', 'P1', 1, rows(docInjury),
    `status=${docInjury.status}`)

  if (rows(docInjury) === 1) {
    const injuryId = docInjury.body[0].id

    const coachSees = await rest(tokens.coachAlpha1, `injuries?select=id&id=eq.${injuryId}`)
    check('INJ-02', 'Связанный тренер ВИДИТ запись врача о травме', 'P2', 1, rows(coachSees))

    const coachDeletes = await rest(tokens.coachAlpha1, `injuries?id=eq.${injuryId}`, { method: 'DELETE' })
    const stillThere = await rest(tokens.doctorAlpha, `injuries?select=id&id=eq.${injuryId}`)
    check('INJ-03', 'Тренер НЕ может удалить запись о травме, внесённую врачом', 'P1', 1, rows(stillThere),
      `DELETE status=${coachDeletes.status}`)

    const coachHijacks = await rest(tokens.coachAlpha1, `injuries?id=eq.${injuryId}`, {
      method: 'PATCH',
      body: JSON.stringify({ reported_by: ids.coachAlpha1, description: 'QA-PROBE: присвоено' }),
    })
    const afterHijack = await rest(tokens.doctorAlpha, `injuries?select=reported_by&id=eq.${injuryId}`)
    check('INJ-04', 'Тренер НЕ может присвоить себе запись врача', 'P1', true,
      afterHijack.body?.[0]?.reported_by === ids.doctorAlpha,
      `PATCH status=${coachHijacks.status}`)

    await rest(tokens.doctorAlpha, `injuries?id=eq.${injuryId}`, { method: 'DELETE' })
  }

  // ── 6e. Команда клуба: чужой спортсмен (P1, миграция 106) ─────────────────
  const group = await rest(tokens.ownerAlpha, 'org_groups', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ organization_id: alphaOrgId, name: 'QA-PROBE команда' }),
  })
  if (rows(group) === 1) {
    const groupId = group.body[0].id

    const addForeign = await rest(tokens.ownerAlpha, 'org_group_members', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ group_id: groupId, athlete_id: ids.athleteBeta }),
    })
    check('GRP-01', 'Клуб НЕ может добавить в команду спортсмена другого клуба', 'P1', true,
      addForeign.status >= 400 || rows(addForeign) === 0, `status=${addForeign.status}`)

    const addOwn = await rest(tokens.ownerAlpha, 'org_group_members', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ group_id: groupId, athlete_id: ids.athleteAlpha1 }),
    })
    check('GRP-02', 'Клуб ВСЁ ЕЩЁ может добавить своего спортсмена', 'P1', 1, rows(addOwn),
      `status=${addOwn.status}`)

    await rest(tokens.ownerAlpha, `org_group_members?group_id=eq.${groupId}`, { method: 'DELETE' })
    await rest(tokens.ownerAlpha, `org_groups?id=eq.${groupId}`, { method: 'DELETE' })
  } else {
    check('GRP-01', 'Клуб НЕ может добавить в команду спортсмена другого клуба', 'P1', true, false,
      `не удалось создать тестовую команду: status=${group.status}`)
  }

  // ── 6f. Медзаписи: только свой пациент (P0, миграции 114 и 116) ───────────
  // Каждая подделка, если прошла, сразу удаляется её же автором: проба не
  // должна оставлять ложных медзаписей у QA-спортсменов.
  //
  // «Закрыто» засчитывается только за отказ по правам (401/403 с кодом
  // 42501) или за ответ без строк. 400 от схемы, 409 от уникальности или
  // 500 — не доказательство защиты: такая проверка падает с подробностями.
  const today = new Date().toISOString().slice(0, 10)
  const blocked = r => ((r.status === 401 || r.status === 403) && r.body?.code === '42501')
    || (r.status < 300 && rows(r) === 0)
  const why = r => `status=${r.status}${r.body?.code ? ` code=${r.body.code}` : ''}`
  const post = (token, table, payload) => rest(token, table, {
    method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload),
  })
  const patch = (token, path, payload) => rest(token, path, { method: 'PATCH', body: JSON.stringify(payload) })
  const dropIfCreated = async (token, table, r) => {
    if (rows(r) > 0) await rest(token, `${table}?id=eq.${r.body[0].id}`, { method: 'DELETE' })
  }

  const forgeCheckup = await post(tokens.doctorBeta, 'medical_checkups', {
    doctor_id: ids.doctorBeta, athlete_id: ids.athleteAlpha1, checkup_date: today,
    findings: 'QA-PROBE: чужой пациент',
  })
  check('MED-09', 'Врач НЕ может создать осмотр не своему пациенту', 'P0', true,
    blocked(forgeCheckup), why(forgeCheckup))
  await dropIfCreated(tokens.doctorBeta, 'medical_checkups', forgeCheckup)

  const athleteCheckup = await post(tokens.athleteAlpha2, 'medical_checkups', {
    doctor_id: ids.athleteAlpha2, athlete_id: ids.athleteAlpha1, checkup_date: today,
    findings: 'QA-PROBE: не врач',
  })
  check('MED-10', 'Спортсмен НЕ может создать «осмотр» другому спортсмену', 'P0', true,
    blocked(athleteCheckup), why(athleteCheckup))
  await dropIfCreated(tokens.athleteAlpha2, 'medical_checkups', athleteCheckup)

  const forgeDiary = await post(tokens.doctorBeta, 'medical_diary', {
    doctor_id: ids.doctorBeta, athlete_id: ids.athleteAlpha1, date: today,
    note: 'QA-PROBE: чужой пациент', is_shared_with_coach: true,
  })
  check('MED-11', 'Врач НЕ может написать в дневник о не своём пациенте', 'P0', true,
    blocked(forgeDiary), why(forgeDiary))
  await dropIfCreated(tokens.doctorBeta, 'medical_diary', forgeDiary)

  const patientCheckup = await post(tokens.athleteAlpha1, 'medical_checkups', {
    doctor_id: ids.athleteAlpha1, athlete_id: ids.doctorAlpha, checkup_date: today,
    findings: 'QA-PROBE: пациент о враче',
  })
  check('MED-23', 'Пациент НЕ может создать «осмотр» о своём враче', 'P0', true,
    blocked(patientCheckup), why(patientCheckup))
  await dropIfCreated(tokens.athleteAlpha1, 'medical_checkups', patientCheckup)

  const ownNote = await post(tokens.doctorBeta, 'medical_diary', {
    doctor_id: ids.doctorBeta, date: today, note: 'QA-PROBE: личная заметка',
  })
  check('MED-12', 'Врач ВСЁ ЕЩЁ пишет личную заметку без спортсмена', 'P1', 1, rows(ownNote), why(ownNote))
  if (rows(ownNote) === 1) {
    const noteId = ownNote.body[0].id
    const repoint = await patch(tokens.doctorBeta, `medical_diary?id=eq.${noteId}`,
      { athlete_id: ids.athleteAlpha1, is_shared_with_athlete: true })
    const after = await rest(tokens.doctorBeta, `medical_diary?select=athlete_id&id=eq.${noteId}`)
    check('MED-13', 'Врач НЕ может перенести заметку на не своего пациента', 'P0', true,
      rows(after) === 1 && after.body[0].athlete_id == null, `PATCH ${why(repoint)}, строк после: ${rows(after)}`)
    await rest(tokens.doctorBeta, `medical_diary?id=eq.${noteId}`, { method: 'DELETE' })
  }

  const ownCheckup = await post(tokens.doctorAlpha, 'medical_checkups', {
    doctor_id: ids.doctorAlpha, athlete_id: ids.athleteAlpha1, checkup_date: today,
    findings: 'QA-PROBE: свой пациент',
  })
  check('MED-14', 'Врач ВСЁ ЕЩЁ создаёт осмотр своему пациенту', 'P1', 1, rows(ownCheckup), why(ownCheckup))
  if (rows(ownCheckup) === 1) {
    const checkupId = ownCheckup.body[0].id
    const repoint = await patch(tokens.doctorAlpha, `medical_checkups?id=eq.${checkupId}`,
      { athlete_id: ids.athleteBeta })
    const after = await rest(tokens.doctorAlpha, `medical_checkups?select=athlete_id&id=eq.${checkupId}`)
    check('MED-15', 'Врач НЕ может перенести осмотр на не своего пациента', 'P0', true,
      rows(after) === 1 && after.body[0].athlete_id === ids.athleteAlpha1,
      `PATCH ${why(repoint)}, строк после: ${rows(after)}`)
    await rest(tokens.doctorAlpha, `medical_checkups?id=eq.${checkupId}`, { method: 'DELETE' })
  }

  const docRec = await post(tokens.doctorAlpha, 'recommendations', {
    organization_id: alphaOrgId, athlete_id: ids.athleteAlpha1, doctor_id: ids.doctorAlpha,
    title: 'QA-PROBE: вложение врача', category: 'general', severity: 'low',
    visibility_level: 'coach_and_athlete', status: 'sent',
  })
  if (rows(docRec) === 1) {
    const recId = docRec.body[0].id
    // Отметка «Понятно» в том же запросе: если PATCH не дошёл до строки
    // (тренер не связан со спортсменом), проверка не засчитывается.
    const tamper = await rest(tokens.coachAlpha1, `recommendations?id=eq.${recId}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        acknowledged_by_coach_at: new Date().toISOString(),
        attachments: { file: 'QA-PROBE-поддельный-допуск.pdf' }, status: 'cancelled',
      }),
    })
    const after = await rest(tokens.doctorAlpha,
      `recommendations?select=attachments,status,acknowledged_by_coach_at&id=eq.${recId}`)
    const row = after.body?.[0]
    check('REC-01', 'Тренер НЕ может подменить вложение или статус рекомендации врача', 'P0', true,
      rows(tamper) === 1 && row?.acknowledged_by_coach_at != null
        && row.attachments == null && row.status !== 'cancelled',
      `PATCH ${why(tamper)} строк ${rows(tamper)}, после: ${JSON.stringify(row)}`)
    await rest(tokens.doctorAlpha, `recommendations?id=eq.${recId}`, { method: 'DELETE' })
  } else {
    // Не PASS: без рекомендации проверка не выполнена.
    check('REC-01', 'Тренер НЕ может подменить вложение или статус рекомендации врача', 'P0', true, false,
      `не удалось создать тестовую рекомендацию: ${why(docRec)}`)
  }

  // ── 6g. Связи: активной делает только согласие получателя (P0, 115) ──────
  // Активная doctor_athlete — это доступ к медзаписям (105, 114), поэтому
  // подделка связи равна подделке медзаписи. Тип doctor_athlete выбран
  // нарочно: в отличие от coach_athlete, он не запускает синхронизацию
  // trainer_athletes (085), и случайно прошедшая подделка ничего не выдаст.
  // У каждой пробы своя пара аккаунтов — остатки одной не мешают другой.
  //
  // Запросы на связь шлют QA-спортсменам уведомления (083). Удалить их от
  // имени врача нельзя — их убирает qa/ralph/seed-cleanup.sql.
  const activeBetween = async (token, a, b) => rows(await rest(token,
    `connections?select=id&status=eq.active&or=(and(initiator_id.eq.${a},recipient_id.eq.${b}),` +
    `and(initiator_id.eq.${b},recipient_id.eq.${a}))`))
  // Удалить связь пользователь может не иметь права (приложение их не
  // удаляет, а разрывает) — тогда отменяем и проверяем, что не осталась
  // активной.
  const removeConn = async (token, connId) => {
    await rest(token, `connections?id=eq.${connId}`, { method: 'DELETE' })
    const left = await rest(token, `connections?select=status&id=eq.${connId}`)
    if (rows(left) === 0) return
    await patch(token, `connections?id=eq.${connId}`, { status: 'cancelled' })
    const final = await rest(token, `connections?select=status&id=eq.${connId}`)
    const status = final.body?.[0]?.status
    console.log(status === 'active'
      ? `🚨 связь ${connId} осталась АКТИВНОЙ — убрать вручную через seed-cleanup.sql`
      : `⚠️  связь ${connId} не удалилась, статус: ${status}`)
  }
  const dropConn = async (token, r) => {
    if (rows(r) > 0) await removeConn(token, r.body[0].id)
  }

  const forgeActive = await post(tokens.doctorBeta, 'connections', {
    initiator_id: ids.doctorBeta, recipient_id: ids.athleteAlpha1,
    connection_type: 'doctor_athlete', status: 'active',
  })
  const forgedActive = await activeBetween(tokens.doctorBeta, ids.doctorBeta, ids.athleteAlpha1)
  check('CONN-01', 'Врач НЕ может сразу создать активную связь со спортсменом', 'P0', true,
    blocked(forgeActive) && forgedActive === 0, `${why(forgeActive)}, активных после: ${forgedActive}`)
  await dropConn(tokens.doctorBeta, forgeActive)

  // Запрос «от имени» спортсмена, где получатель — сам вызывающий: иначе
  // его отклонила бы любая политика «вставлять могут только стороны», и
  // проба прошла бы и без 115.
  const forgeInitiator = await post(tokens.doctorAlpha, 'connections', {
    initiator_id: ids.athleteBeta, recipient_id: ids.doctorAlpha, connection_type: 'doctor_athlete',
  })
  if (rows(forgeInitiator) > 0) {
    await patch(tokens.doctorAlpha, `connections?id=eq.${forgeInitiator.body[0].id}`, { status: 'active' })
  }
  const forgedFromVictim = await activeBetween(tokens.doctorAlpha, ids.athleteBeta, ids.doctorAlpha)
  check('CONN-02', 'Врач НЕ может создать запрос от имени спортсмена и принять его сам', 'P0', true,
    blocked(forgeInitiator) && forgedFromVictim === 0, `${why(forgeInitiator)}, активных после: ${forgedFromVictim}`)
  await dropConn(tokens.doctorAlpha, forgeInitiator)

  let request = await post(tokens.doctorBeta, 'connections', {
    initiator_id: ids.doctorBeta, recipient_id: ids.athleteAlpha2, connection_type: 'doctor_athlete',
  })
  if (rows(request) !== 1) {
    // Остался запрос от прошлого прогона (отменён, а не удалён) — вернуть
    // его в pending от имени инициатора, как повторный запрос в
    // POST /api/connections.
    request = await rest(tokens.doctorBeta,
      `connections?initiator_id=eq.${ids.doctorBeta}&recipient_id=eq.${ids.athleteAlpha2}` +
      `&connection_type=eq.doctor_athlete&status=neq.active`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'pending', responded_at: null }),
      })
  }
  if (rows(request) === 1) {
    const connId = request.body[0].id
    const selfAccept = await patch(tokens.doctorBeta, `connections?id=eq.${connId}`, { status: 'active' })
    const after = await rest(tokens.doctorBeta, `connections?select=status&id=eq.${connId}`)
    check('CONN-04', 'Врач НЕ может принять свой же запрос на связь', 'P0', true,
      rows(after) === 1 && after.body[0].status !== 'active', `PATCH ${why(selfAccept)}`)
    await removeConn(tokens.doctorBeta, connId)
  } else {
    // Не PASS: проверка не выполнена, если запрос не удалось создать.
    check('CONN-04', 'Врач НЕ может принять свой же запрос на связь', 'P0', true, false,
      `не удалось создать тестовый запрос: ${why(request)} ${JSON.stringify(request.body)?.slice(0, 80)}`)
  }

  const fakeDoctor = await post(tokens.coachAlpha1, 'connections', {
    initiator_id: ids.coachAlpha1, recipient_id: ids.athleteBeta, connection_type: 'doctor_athlete',
  })
  check('CONN-06', 'Тренер НЕ может назваться «врачом» в запросе на связь', 'P0', true,
    blocked(fakeDoctor), why(fakeDoctor))
  await dropConn(tokens.coachAlpha1, fakeDoctor)

  // Спортсмен A2 прислал запрос врачу Alpha и сам его отменил. Врач не
  // может вернуть его в pending и принять — нужен новый запрос от врача,
  // который спортсмен примет или нет.
  let athleteRequest = await post(tokens.athleteAlpha2, 'connections', {
    initiator_id: ids.athleteAlpha2, recipient_id: ids.doctorAlpha, connection_type: 'doctor_athlete',
  })
  if (rows(athleteRequest) !== 1) {
    athleteRequest = await rest(tokens.athleteAlpha2,
      `connections?initiator_id=eq.${ids.athleteAlpha2}&recipient_id=eq.${ids.doctorAlpha}` +
      `&connection_type=eq.doctor_athlete&status=neq.active`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'pending', responded_at: null }),
      })
  }
  if (rows(athleteRequest) === 1) {
    const connId = athleteRequest.body[0].id
    await patch(tokens.athleteAlpha2, `connections?id=eq.${connId}`, { status: 'cancelled' })
    const repend = await patch(tokens.doctorAlpha, `connections?id=eq.${connId}`, { status: 'pending' })
    const accept = await patch(tokens.doctorAlpha, `connections?id=eq.${connId}`, { status: 'active' })
    const after = await rest(tokens.athleteAlpha2, `connections?select=status&id=eq.${connId}`)
    check('CONN-11', 'Врач НЕ может сам вернуть и принять отменённый запрос спортсмена', 'P0', true,
      rows(after) === 1 && after.body[0].status !== 'active',
      `pending: ${why(repend)}, active: ${why(accept)}, статус после: ${after.body?.[0]?.status}`)
    await removeConn(tokens.athleteAlpha2, connId)
  } else {
    check('CONN-11', 'Врач НЕ может сам вернуть и принять отменённый запрос спортсмена', 'P0', true, false,
      `не удалось создать запрос спортсмена: ${why(athleteRequest)}`)
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
