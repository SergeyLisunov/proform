import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  __resetForTests, getServerSnapshot, getSnapshot, setOpen, subscribe,
} from './sidebarOpenStore'

/**
 * Свёрнутость панели должна пережить перемонтирование каркаса.
 *
 * AppShell рендерится в layout'е каждого раздела, и при переходе в другой
 * раздел Next монтирует новый SidebarProvider. Раньше он стартовал
 * развёрнутым, и свёрнутая панель раскрывалась на каждом переходе.
 */
afterEach(() => {
  __resetForTests()
  vi.unstubAllGlobals()
})

describe('sidebarOpenStore', () => {
  it('сервер всегда отдаёт «развёрнута» — без cookies() в AppShell', () => {
    expect(getServerSnapshot()).toBe(true)
  })

  it('без cookie панель развёрнута', () => {
    vi.stubGlobal('document', { cookie: '' })
    expect(getSnapshot()).toBe(true)
  })

  it('берёт первичное значение из cookie, которую пишет SidebarProvider', () => {
    vi.stubGlobal('document', { cookie: 'foo=1; sidebar_state=false; bar=2' })
    expect(getSnapshot()).toBe(false)
  })

  it('значение переживает «перемонтирование»: новый подписчик видит свёрнутость', () => {
    vi.stubGlobal('document', { cookie: '' })
    const first = vi.fn()
    const unsubscribe = subscribe(first)
    setOpen(false)
    expect(first).toHaveBeenCalledTimes(1)
    unsubscribe()                       // старый каркас размонтирован
    const second = vi.fn()
    subscribe(second)                   // новый каркас в другом разделе
    expect(getSnapshot()).toBe(false)   // ← раньше здесь было бы «развёрнута»
  })

  it('не будит подписчиков, если значение не изменилось', () => {
    vi.stubGlobal('document', { cookie: '' })
    const l = vi.fn()
    subscribe(l)
    getSnapshot()
    setOpen(true)
    expect(l).not.toHaveBeenCalled()
  })
})
