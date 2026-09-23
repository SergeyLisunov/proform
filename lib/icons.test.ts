import { describe, expect, it } from 'vitest'
import { execSync } from 'node:child_process'
import { ICON_MAP, resolveIcon, FALLBACK_ICON } from './icons'

/**
 * Сторож перехода с keenicons на Lucide.
 *
 * Пока иконочный шрифт Metronic ещё подключён, незакрытое имя не падает
 * заметно: <Icon> молча отрисует запасной глиф, и подмена всплывёт только
 * при просмотре страницы глазами. Тест закрывает этот зазор — он читает
 * реальные имена из разметки и требует, чтобы каждое было в словаре.
 */
function keeniconsInSource(): string[] {
  // grep по исходникам, а не по списку в тесте: список устарел бы молча.
  const out = execSync(
    `grep -rhoE '\\bki-[a-z0-9-]+' app components --include='*.tsx' || true`,
    { encoding: 'utf8', cwd: process.cwd(), maxBuffer: 16 * 1024 * 1024 },
  )
  const modifiers = new Set(['ki-filled', 'ki-outline', 'ki-solid', 'ki-duotone'])
  return [...new Set(out.split('\n').map(s => s.trim()).filter(s => s && !modifiers.has(s)))]
}

describe('словарь иконок покрывает разметку', () => {
  it('каждое keenicon-имя из кода есть в ICON_MAP', () => {
    const missing = keeniconsInSource().filter(n => !(n in ICON_MAP))
    expect(missing, `нет в словаре: ${missing.join(', ')}`).toEqual([])
  })
})

describe('resolveIcon', () => {
  it('понимает имя с модификатором начертания', () => {
    expect(resolveIcon('ki-filled ki-cross')).toBe(ICON_MAP['ki-cross'])
    expect(resolveIcon('ki-outline ki-check')).toBe(ICON_MAP['ki-check'])
  })

  it('понимает голое имя', () => {
    expect(resolveIcon('ki-trash')).toBe(ICON_MAP['ki-trash'])
  })

  it('незнакомое имя даёт запасную иконку, а не падение', () => {
    // Отрисовать что-то нейтральное лучше, чем уронить страницу: имя
    // приходит из данных (конфиги разделов, пропы), а не только из кода.
    expect(resolveIcon('ki-does-not-exist')).toBe(FALLBACK_ICON)
    expect(resolveIcon('')).toBe(FALLBACK_ICON)
  })
})
