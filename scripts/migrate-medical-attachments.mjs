#!/usr/bin/env node
/**
 * Перенос медицинских файлов из публичного бакета note-attachments в
 * закрытый medical-private (миграция 117).
 *
 * Три прохода:
 *   1. вложения медицинского дневника (medical_diary.attachments[].url) —
 *      в папку автора записи: {doctor_id}/med/{имя};
 *   2. выгрузки Apple Health (user_device_connections.metadata
 *      .uploaded_file_path или, у самых ранних, .uploaded_file_url) — в
 *      {user_id}/apple_health/{имя};
 *   3. медицинские файлы, на которые уже ничего не ссылается (удалённые
 *      вложения, прежние выгрузки, брошенные формы), — в
 *      {user_id}/orphaned/{имя}, доступные только владельцу. Ничего не
 *      удаляется насовсем: файл сначала копируется в закрытый бакет.
 *
 * Только свои файлы. Путь источника обязан лежать в папке владельца
 * записи — {auth_id}/med/ у врача, {users.id}/[health-private/]apple_health/
 * у выгрузки. Метаданные выгрузки пользователь правит сам, вложения — врач:
 * без этой проверки чужой путь, вписанный в свою запись, привёл бы к
 * удалению чужого файла. Такие записи пропускаются и печатаются.
 *
 * Порядок для каждого файла: копия в закрытый бакет → запись в базе
 * указывает на новый путь → удаление из публичного. Если шаг упал,
 * следующие не выполняются; повторный запуск продолжает с того же места.
 * Запись перечитывается прямо перед обновлением и обновляется, только
 * если её не меняли за время копирования.
 *
 * Запуск (нужен service role ключ — только из окружения, в чат и в код он
 * не попадает):
 *   node scripts/migrate-medical-attachments.mjs           # план, без изменений
 *   node scripts/migrate-medical-attachments.mjs --apply   # перенос
 *
 * Требует применённой миграции 117. Запускать, когда врачи не работают,
 * и второй раз после выкладки — на случай записей, сохранённых между
 * проходами. В выводе — id и пути, без имён файлов и содержимого.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  PUBLIC_BUCKET, PRIVATE_BUCKET, publicPathFromUrl, diaryOwned, healthOwned, rewriteAttachments,
} from './medical-attachments-migration-lib.mjs'

const APPLY = process.argv.includes('--apply')
const PAGE = 500
const MAX_ROW_RETRIES = 3

function loadEnvLocal() {
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnvLocal()

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) {
  console.error('Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в окружении или .env.local')
  process.exit(2)
}
const sb = createClient(URL_, KEY, { auth: { persistSession: false } })

const stats = { diaryFiles: 0, healthFiles: 0, orphanFiles: 0, skippedForeign: 0, failed: 0 }

// ── помощники ───────────────────────────────────────────────────────────────

/** Все строки запроса — постранично: PostgREST отдаёт не больше max_rows. */
async function allRows(build) {
  const out = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) return out
  }
}

/** Все объекты под префиксом публичного бакета (только файлы). */
async function listPublic(prefix) {
  const out = []
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await sb.storage.from(PUBLIC_BUCKET).list(prefix, { limit: 100, offset })
    if (error) throw new Error(`list ${prefix}: ${error.message}`)
    for (const o of data ?? []) if (o.id) out.push(`${prefix}/${o.name}`)
    if (!data || data.length < 100) return out
  }
}

async function existsInPrivate(path) {
  const dir = path.split('/').slice(0, -1).join('/')
  const { data } = await sb.storage.from(PRIVATE_BUCKET).list(dir, { search: basename(path), limit: 1 })
  return (data ?? []).some(o => o.name === basename(path))
}

/** Копия в закрытый бакет. true — файл там есть (скопирован или уже был). */
async function copyToPrivate(fromPath, toPath) {
  if (await existsInPrivate(toPath)) return true
  const { data: blob, error: dlErr } = await sb.storage.from(PUBLIC_BUCKET).download(fromPath)
  if (dlErr || !blob) { console.error(`  ✗ не скачать ${fromPath}: ${dlErr?.message}`); stats.failed++; return false }
  const { error: upErr } = await sb.storage.from(PRIVATE_BUCKET).upload(toPath, blob, {
    upsert: false, contentType: blob.type || 'application/octet-stream',
  })
  if (upErr) { console.error(`  ✗ не загрузить ${toPath}: ${upErr.message}`); stats.failed++; return false }
  return true
}

async function removeFromPublic(path) {
  const { error } = await sb.storage.from(PUBLIC_BUCKET).remove([path])
  if (error) { console.error(`  ⚠ скопирован, но не удалён из публичного: ${path}: ${error.message}`); stats.failed++ }
}

// ── 1. медицинский дневник ──────────────────────────────────────────────────

async function migrateDiary(authIdOf, referenced) {
  const rows = await allRows(() => sb.from('medical_diary')
    .select('id, doctor_id, attachments').not('attachments', 'is', null).order('id'))

  for (const row of rows) {
    const atts = Array.isArray(row.attachments) ? row.attachments : []
    const legacy = atts.map(a => (a && !a.path ? publicPathFromUrl(a.url) : null)).filter(Boolean)
    if (!legacy.length) continue

    const authId = await authIdOf(row.doctor_id)
    const own = legacy.filter(p => diaryOwned(p, authId))
    const foreign = legacy.filter(p => !diaryOwned(p, authId))
    for (const p of foreign) {
      stats.skippedForeign++
      referenced.add(p)
      console.log(`  ! medical_diary ${row.id}: путь не из папки автора, пропущен — ${p}`)
    }
    if (!own.length) continue
    console.log(`medical_diary ${row.id}: к переносу ${own.length}: ${own.join(', ')}`)
    if (!APPLY) { stats.diaryFiles += own.length; own.forEach(p => referenced.add(p)); continue }

    const moved = new Map()
    for (const from of own) {
      const to = `${row.doctor_id}/med/${basename(from)}`
      if (await copyToPrivate(from, to)) moved.set(from, to)
      else referenced.add(from)
    }
    if (!moved.size) continue

    let updated = false
    for (let attempt = 0; attempt < MAX_ROW_RETRIES && !updated; attempt++) {
      const { data: fresh, error: readErr } = await sb.from('medical_diary')
        .select('attachments, updated_at').eq('id', row.id).maybeSingle()
      if (readErr || !fresh) break
      const { data: done, error: updErr } = await sb.from('medical_diary')
        .update({ attachments: rewriteAttachments(fresh.attachments, moved) })
        .eq('id', row.id).eq('updated_at', fresh.updated_at).select('id')
      if (updErr) { console.error(`  ✗ запись ${row.id}: ${updErr.message}`); break }
      updated = (done ?? []).length === 1
    }
    if (!updated) {
      console.error(`  ✗ запись ${row.id} не обновлена — старые файлы не удаляются`)
      stats.failed++
      moved.forEach((_, from) => referenced.add(from))
      continue
    }
    for (const from of moved.keys()) await removeFromPublic(from)
    stats.diaryFiles += moved.size
  }
}

// ── 2. выгрузки Apple Health ────────────────────────────────────────────────

async function migrateAppleHealth(referenced) {
  const rows = await allRows(() => sb.from('user_device_connections')
    .select('user_id, metadata').eq('provider', 'apple_health').order('user_id'))

  for (const row of rows) {
    const meta = row.metadata ?? {}
    if (meta.uploaded_file_bucket === PRIVATE_BUCKET) continue
    const from = meta.uploaded_file_path ?? publicPathFromUrl(meta.uploaded_file_url)
    if (!from) continue
    if (!healthOwned(from, row.user_id)) {
      stats.skippedForeign++
      referenced.add(from)
      console.log(`  ! apple_health ${row.user_id}: путь не из папки владельца, пропущен — ${from}`)
      continue
    }
    console.log(`apple_health ${row.user_id}: к переносу ${from}`)
    if (!APPLY) { stats.healthFiles++; referenced.add(from); continue }

    const to = `${row.user_id}/apple_health/${basename(from)}`
    if (!(await copyToPrivate(from, to))) { referenced.add(from); continue }
    const nextMeta = { ...meta, uploaded_file_bucket: PRIVATE_BUCKET, uploaded_file_path: to }
    delete nextMeta.uploaded_file_url
    const { error: updErr } = await sb.from('user_device_connections')
      .update({ metadata: nextMeta }).eq('user_id', row.user_id).eq('provider', 'apple_health')
    if (updErr) {
      console.error(`  ✗ ${row.user_id} не обновлён: ${updErr.message} — старый файл не удаляется`)
      stats.failed++
      referenced.add(from)
      continue
    }
    await removeFromPublic(from)
    stats.healthFiles++
  }
}

// ── 3. медицинские файлы без ссылок ─────────────────────────────────────────

async function migrateOrphans(users, referenced) {
  for (const u of users) {
    const prefixes = [
      u.auth_id && `${u.auth_id}/med`,
      `${u.id}/apple_health`,
      `${u.id}/health-private/apple_health`,
    ].filter(Boolean)
    for (const prefix of prefixes) {
      for (const from of await listPublic(prefix)) {
        if (referenced.has(from)) continue
        console.log(`без ссылок ${u.id}: ${from}`)
        if (!APPLY) { stats.orphanFiles++; continue }
        const to = `${u.id}/orphaned/${basename(from)}`
        if (!(await copyToPrivate(from, to))) continue
        await removeFromPublic(from)
        stats.orphanFiles++
      }
    }
  }
}

async function main() {
  console.log(APPLY ? 'ПЕРЕНОС (--apply)' : 'ПЛАН — изменений нет. Для переноса: --apply')

  const users = await allRows(() => sb.from('users').select('id, auth_id').order('id'))
  const authById = new Map(users.map(u => [u.id, u.auth_id]))
  const authIdOf = async id => authById.get(id) ?? null
  // Пути, которые всё ещё нужны записям (не перенесены, чужие, ошибка):
  // проход 3 их не трогает.
  const referenced = new Set()

  await migrateDiary(authIdOf, referenced)
  await migrateAppleHealth(referenced)
  await migrateOrphans(users, referenced)

  console.log('─'.repeat(60))
  console.log(`Вложений дневника: ${stats.diaryFiles}; выгрузок Apple Health: ${stats.healthFiles}; ` +
    `файлов без ссылок: ${stats.orphanFiles}; пропущено чужих путей: ${stats.skippedForeign}; ошибок: ${stats.failed}`)
  if (!APPLY) console.log('Ничего не изменено.')
  process.exit(stats.failed ? 1 : 0)
}

main().catch(e => { console.error('ОШИБКА:', e.message); process.exit(1) })
