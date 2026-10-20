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
 *      вложения, прежние выгрузки, брошенные формы), — в ту же папку, куда
 *      их положили бы проходы 1 и 2: {users.id}/med/ и
 *      {users.id}/apple_health/. Если запись сошлётся на такой файл позже
 *      (форма, сохранённая после прогона), повторный запуск найдёт файл на
 *      месте и просто перепишет ссылку. Файлы, появившиеся во время прогона,
 *      не трогаются — их заберёт следующий запуск;
 *   4. медицинские файлы в папках, которым не соответствует ни один
 *      пользователь, — в служебную папку _unowned/, доступную только
 *      серверу. Ничего не удаляется насовсем: файл сначала копируется.
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
 * Запись (и дневника, и выгрузки) перечитывается прямо перед обновлением
 * и обновляется, только если её не меняли за время копирования.
 *
 * Запуск (нужен service role ключ — только из окружения, в чат и в код он
 * не попадает):
 *   node scripts/migrate-medical-attachments.mjs           # план, без изменений
 *   node scripts/migrate-medical-attachments.mjs --apply   # перенос
 *
 * Требует применённой миграции 117. Запускать, когда врачи не работают,
 * и второй раз после выкладки — на случай записей, сохранённых между
 * проходами. Файлы моложе 15 минут проходы 3–4 откладывают: тогда скрипт
 * завершается с кодом 3 — повторите запуск через 15 минут, пока «свежих,
 * отложено» не станет 0. В выводе — id и пути, без имён файлов и
 * содержимого.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  PUBLIC_BUCKET, PRIVATE_BUCKET, publicPathFromUrl, isPublicUrl, diaryOwned, healthOwned, rewriteAttachments,
} from './medical-attachments-migration-lib.mjs'

const APPLY = process.argv.includes('--apply')
const PAGE = 500
const MAX_ROW_RETRIES = 3
// Файл, загруженный позже этого момента, мог попасть в запись уже после
// того, как проходы 1–2 её прочитали, — проход 3 его не трогает.
const RUN_STARTED_MS = Date.now()
const FRESH_MARGIN_MS = 15 * 60 * 1000

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

const stats = { diaryFiles: 0, healthFiles: 0, orphanFiles: 0, unownedFiles: 0, freshSkipped: 0, skippedForeign: 0, failed: 0 }

// ── помощники ───────────────────────────────────────────────────────────────

/**
 * Все строки — постранично по ключу (key > последнего), а не по смещению:
 * PostgREST отдаёт не больше max_rows, а смещение пропускает строки, если
 * таблица меняется во время чтения.
 */
async function allRowsByKey(build, key) {
  const out = []
  let last = null
  for (;;) {
    let q = build()
    if (last !== null) q = q.gt(key, last)
    const { data, error } = await q.order(key).limit(PAGE)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) return out
    out.push(...data)
    last = data[data.length - 1][key]
  }
}

/** Содержимое префикса публичного бакета: файлы и вложенные папки. */
async function listPublicEntries(prefix) {
  const files = []
  const folders = []
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await sb.storage.from(PUBLIC_BUCKET).list(prefix, { limit: 100, offset })
    if (error) throw new Error(`list ${prefix || '/'}: ${error.message}`)
    for (const o of data ?? []) {
      const path = prefix ? `${prefix}/${o.name}` : o.name
      if (o.id) files.push({ path, createdAt: o.created_at ? Date.parse(o.created_at) : 0 })
      else folders.push(path)
    }
    if (!data || data.length < 100) return { files, folders }
  }
}

const isFresh = f => f.createdAt > RUN_STARTED_MS - FRESH_MARGIN_MS

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
  const rows = await allRowsByKey(() => sb.from('medical_diary')
    .select('id, doctor_id, attachments').not('attachments', 'is', null), 'id')

  for (const row of rows) {
    const atts = Array.isArray(row.attachments) ? row.attachments : []
    const broken = atts.filter(a => a && !a.path && isPublicUrl(a.url) && !publicPathFromUrl(a.url))
    if (broken.length) {
      stats.failed += broken.length
      console.error(`  ✗ medical_diary ${row.id}: ссылка на файл не разбирается (${broken.length}) — пропущена`)
    }
    const legacy = atts.map(a => (a && !a.path ? publicPathFromUrl(a.url) : null)).filter(Boolean)
    if (!legacy.length) continue

    const authId = await authIdOf(row.doctor_id)
    const own = legacy.filter(p => diaryOwned(p, authId))
    const foreign = legacy.filter(p => !diaryOwned(p, authId))
    // Чужой путь не мешает проходу 3 закрыть файл его настоящего владельца:
    // в «нужные» он не попадает.
    for (const p of foreign) {
      stats.skippedForeign++
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

/** Путь старой выгрузки в публичном бакете по метаданным, или null. */
function healthSource(meta) {
  if (!meta || meta.uploaded_file_bucket === PRIVATE_BUCKET) return null
  return meta.uploaded_file_path ?? publicPathFromUrl(meta.uploaded_file_url)
}

async function migrateAppleHealth(referenced) {
  const rows = await allRowsByKey(() => sb.from('user_device_connections')
    .select('user_id, metadata').eq('provider', 'apple_health'), 'user_id')

  for (const row of rows) {
    const meta = row.metadata ?? {}
    if (meta.uploaded_file_bucket !== PRIVATE_BUCKET && isPublicUrl(meta.uploaded_file_url)
        && !meta.uploaded_file_path && !publicPathFromUrl(meta.uploaded_file_url)) {
      stats.failed++
      console.error(`  ✗ apple_health ${row.user_id}: ссылка на выгрузку не разбирается — пропущена`)
      continue
    }
    const from = healthSource(meta)
    if (!from) continue
    if (!healthOwned(from, row.user_id)) {
      stats.skippedForeign++
      console.log(`  ! apple_health ${row.user_id}: путь не из папки владельца, пропущен — ${from}`)
      continue
    }
    console.log(`apple_health ${row.user_id}: к переносу ${from}`)
    if (!APPLY) { stats.healthFiles++; referenced.add(from); continue }

    const to = `${row.user_id}/apple_health/${basename(from)}`
    if (!(await copyToPrivate(from, to))) { referenced.add(from); continue }

    // Как в дневнике: перечитать и обновить, только если строку не меняли.
    // Пользователь мог за это время загрузить новую выгрузку — тогда её не
    // трогаем, а старый файл остаётся без ссылки и уходит в проходе 3.
    let updated = false
    let superseded = false
    for (let attempt = 0; attempt < MAX_ROW_RETRIES && !updated && !superseded; attempt++) {
      const { data: fresh, error: readErr } = await sb.from('user_device_connections')
        .select('metadata, updated_at').eq('user_id', row.user_id).eq('provider', 'apple_health').maybeSingle()
      if (readErr || !fresh) break
      if (healthSource(fresh.metadata) !== from) { superseded = true; break }
      const nextMeta = { ...fresh.metadata, uploaded_file_bucket: PRIVATE_BUCKET, uploaded_file_path: to }
      delete nextMeta.uploaded_file_url
      const { data: done, error: updErr } = await sb.from('user_device_connections')
        .update({ metadata: nextMeta })
        .eq('user_id', row.user_id).eq('provider', 'apple_health').eq('updated_at', fresh.updated_at)
        .select('user_id')
      if (updErr) { console.error(`  ✗ ${row.user_id}: ${updErr.message}`); break }
      updated = (done ?? []).length === 1
    }
    if (superseded) {
      console.log(`  · apple_health ${row.user_id}: за время переноса загружена новая выгрузка — запись не тронута`)
      continue
    }
    if (!updated) {
      console.error(`  ✗ ${row.user_id} не обновлён — старый файл не удаляется`)
      stats.failed++
      referenced.add(from)
      continue
    }
    await removeFromPublic(from)
    stats.healthFiles++
  }
}

// ── 3. медицинские файлы без ссылок ─────────────────────────────────────────

/** Куда положить файл без ссылки — туда же, куда его положили бы проходы 1–2. */
function orphanDestination(u, path) {
  const name = basename(path)
  return path.startsWith(`${u.auth_id}/med/`) ? `${u.id}/med/${name}` : `${u.id}/apple_health/${name}`
}

async function moveUnreferenced(files, destinationOf, referenced, label, counter) {
  for (const f of files) {
    if (referenced.has(f.path)) continue
    if (isFresh(f)) {
      stats.freshSkipped++
      console.log(`  · ${label}: ${f.path} моложе 15 минут — повторите запуск позже`)
      continue
    }
    console.log(`${label}: ${f.path}`)
    if (!APPLY) { stats[counter]++; continue }
    if (!(await copyToPrivate(f.path, destinationOf(f.path)))) continue
    await removeFromPublic(f.path)
    stats[counter]++
  }
}

const MEDICAL_SUBFOLDERS = ['med', 'apple_health', 'health-private/apple_health']

async function migrateOrphans(users, referenced) {
  for (const u of users) {
    const prefixes = [
      u.auth_id && `${u.auth_id}/med`,
      `${u.id}/apple_health`,
      `${u.id}/health-private/apple_health`,
    ].filter(Boolean)
    for (const prefix of prefixes) {
      const { files } = await listPublicEntries(prefix)
      await moveUnreferenced(files, p => orphanDestination(u, p), referenced, `без ссылок ${u.id}`, 'orphanFiles')
    }
  }
}

// ── 4. медицинские файлы в папках без владельца ─────────────────────────────

async function migrateUnowned(users, referenced) {
  const known = new Set(users.flatMap(u => [u.id, u.auth_id].filter(Boolean)))
  const { folders } = await listPublicEntries('')
  for (const folder of folders) {
    if (known.has(folder)) continue
    for (const sub of MEDICAL_SUBFOLDERS) {
      const { files } = await listPublicEntries(`${folder}/${sub}`)
      // Папка _unowned/ не совпадает ни с одним users.id — по политике 117
      // её не читает никто, кроме сервера.
      await moveUnreferenced(files, p => `_unowned/${p}`, referenced, `папка без владельца ${folder}`, 'unownedFiles')
    }
  }
}

async function main() {
  console.log(APPLY ? 'ПЕРЕНОС (--apply)' : 'ПЛАН — изменений нет. Для переноса: --apply')

  const users = await allRowsByKey(() => sb.from('users').select('id, auth_id'), 'id')
  const authById = new Map(users.map(u => [u.id, u.auth_id]))
  const authIdOf = async id => authById.get(id) ?? null
  // Пути, которые всё ещё нужны записям (не перенесены, ошибка): проходы
  // 3–4 их не трогают. Чужие пути сюда не попадают.
  const referenced = new Set()

  await migrateDiary(authIdOf, referenced)
  await migrateAppleHealth(referenced)
  await migrateOrphans(users, referenced)
  await migrateUnowned(users, referenced)

  console.log('─'.repeat(60))
  console.log(`Вложений дневника: ${stats.diaryFiles}; выгрузок Apple Health: ${stats.healthFiles}; ` +
    `файлов без ссылок: ${stats.orphanFiles}; в папках без владельца: ${stats.unownedFiles}; ` +
    `свежих, отложено: ${stats.freshSkipped}; чужих путей: ${stats.skippedForeign}; ошибок: ${stats.failed}`)
  if (!APPLY) console.log('Ничего не изменено.')
  if (stats.failed) process.exit(1)
  if (stats.freshSkipped) {
    console.log('Есть отложенные свежие файлы — повторите запуск через 15 минут.')
    process.exit(3)
  }
  process.exit(0)
}

main().catch(e => { console.error('ОШИБКА:', e.message); process.exit(1) })
