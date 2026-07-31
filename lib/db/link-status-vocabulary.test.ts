import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Регрессия: словарь статуса связи тренер↔спортсмен разъезжался с кодом.
 *
 * У trainer_athletes.status CHECK разрешал 'accepted' | 'active' |
 * 'inactive' | 'pending', а DEFAULT был 'active' — при том что код и RLS
 * считают связь действующей ТОЛЬКО при 'accepted'. Любая вставка без явного
 * статуса создавала строку, которой для приложения не существует: тренер не
 * видит спортсмена, RLS не пускает к тренировкам, ассистент отказывает в
 * контексте — молча, без ошибки. Миграция 111 свела словарь к
 * pending → accepted → inactive и сделала умолчанием 'accepted'.
 *
 * Здесь сторож на код: статусы, которые он пишет и читает у этой таблицы,
 * должны принадлежать словарю.
 */

const ROOT = process.cwd()

/** Словарь после миграции 111. */
const LINK_STATUSES = new Set(['pending', 'accepted', 'inactive'])

/** Статус, означающий действующую связь. Его же требуют RLS-политики. */
const ACTIVE_LINK_STATUS = 'accepted'

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(p)
  }
  return out
}

/**
 * Статусы, использованные в цепочке запроса к trainer_athletes.
 *
 * ВАЖНО про границы окна: в этом коде запросы к разным таблицам идут
 * вплотную (рядом с trainer_athletes часто стоят connections и parent_links,
 * где 'active' — ПРАВИЛЬНЫЙ статус). Наивное окно в N строк даёт ложные
 * срабатывания — на этом уже спотыкались при ручном разборе. Поэтому
 * обрываем окно на следующем `.from(`.
 */
function statusesInLinkQueries(src: string): string[] {
  const found: string[] = []
  const re = /from\(\s*['"]trainer_athletes['"]\s*\)/g
  let m: RegExpExecArray | null

  while ((m = re.exec(src)) !== null) {
    const rest = src.slice(m.index + m[0].length)
    const nextFrom = rest.search(/\.from\(|\bfrom\(\s*['"]/)
    const chain = nextFrom === -1 ? rest.slice(0, 600) : rest.slice(0, Math.min(nextFrom, 600))

    for (const sm of chain.matchAll(/status['"]?\s*[,:]\s*['"]([a-z_]+)['"]/g)) found.push(sm[1])
    for (const sm of chain.matchAll(/status:\s*['"]([a-z_]+)['"]/g)) found.push(sm[1])
  }
  return found
}

describe('статус связи тренер↔спортсмен: код и словарь БД совпадают', () => {
  const files = [
    ...walk(join(ROOT, 'app')),
    ...walk(join(ROOT, 'lib')),
    ...walk(join(ROOT, 'services')),
    ...walk(join(ROOT, 'components')),
  ]

  it('ни один запрос к trainer_athletes не использует статус вне словаря', () => {
    const offenders: string[] = []
    for (const file of files) {
      for (const status of statusesInLinkQueries(readFileSync(file, 'utf8'))) {
        if (!LINK_STATUSES.has(status)) {
          offenders.push(`${file.replace(ROOT + '/', '')} → status='${status}'`)
        }
      }
    }
    expect(
      offenders,
      `статусы вне CHECK trainer_athletes (запись упадёт 23514, чтение молча вернёт пусто):\n${offenders.join('\n')}`
    ).toEqual([])
  })

  it("действующей связью код считает именно 'accepted'", () => {
    const used = new Set<string>()
    for (const file of files) {
      for (const s of statusesInLinkQueries(readFileSync(file, 'utf8'))) used.add(s)
    }
    // Если это когда-нибудь перестанет выполняться — значит появился второй
    // «рабочий» статус, и вся история с 'active' повторяется.
    expect(used.has(ACTIVE_LINK_STATUS), 'код должен читать связь по accepted').toBe(true)
    expect(used.has('active'), "'active' удалён из словаря миграцией 111").toBe(false)
  })

  it('миграция 111 задаёт словарь и умолчание', () => {
    const mig = readFileSync(
      join(ROOT, 'supabase', 'migrations', '111_trainer_athletes_status_vocabulary.sql'),
      'utf8'
    )
    expect(mig).toMatch(/ALTER COLUMN status SET DEFAULT 'accepted'/)
    expect(mig).toMatch(/'pending'::text, 'accepted'::text, 'inactive'::text/)
    // Нормализация данных обязана идти ДО сужения CHECK, иначе он не создастся.
    expect(
      mig.indexOf("SET    status = 'accepted'"),
      'UPDATE должен предшествовать ADD CONSTRAINT'
    ).toBeLessThan(mig.indexOf('ADD CONSTRAINT trainer_athletes_status_check'))
  })
})
