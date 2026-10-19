/**
 * Состояние «панель развёрнута / свёрнута», переживающее смену раздела.
 *
 * ЗАЧЕМ. AppShell рендерится в layout'е каждого раздела, а не одним общим
 * layout'ом. При переходе /dashboard → /calendar Next размонтирует поддерево
 * одного раздела и смонтирует другое — вместе с новым SidebarProvider в
 * состоянии по умолчанию. Пользователь сворачивал панель, кликал иконку в
 * свёрнутой полосе — и на новой странице панель снова разворачивалась, а
 * контент прыгал вправо. Так при каждом переходе в другой раздел.
 *
 * Значение хранится вне React, на уровне модуля: оно живёт, пока не
 * перезагружена страница, и переживает перемонтирование каркаса.
 *
 * Первичное значение — из cookie sidebar_state, которую SidebarProvider
 * пишет сам при каждом переключении. Читается только на клиенте: читать её
 * на сервере значило бы вызвать cookies() в AppShell и сделать динамическими
 * все 26 разделов, включая отдаваемые статикой. Поэтому серверный снимок —
 * «развёрнута», и при полной перезагрузке со свёрнутой панелью она на миг
 * покажется развёрнутой; при переходах между разделами — нет.
 */
const COOKIE = 'sidebar_state'

let open: boolean | null = null
const listeners = new Set<() => void>()

function readCookie(): boolean {
  if (typeof document === 'undefined') return true
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=(true|false)`))
  return m ? m[1] === 'true' : true
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getSnapshot(): boolean {
  if (open === null) open = readCookie()
  return open
}

export function getServerSnapshot(): boolean {
  return true
}

export function setOpen(next: boolean): void {
  if (open === next) return
  open = next
  listeners.forEach(l => l())
}

/** Только для тестов: вернуть хранилище в исходное состояние. */
export function __resetForTests(): void {
  open = null
  listeners.clear()
}
