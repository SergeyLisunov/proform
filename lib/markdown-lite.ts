/**
 * markdown-lite — минимальный XSS-безопасный рендер markdown-подмножества,
 * которое реально отдаёт Gemma 4: **жирный**, *курсив*, списки, `код`,
 * блоки кода, заголовки строкой.
 *
 * Почему не react-markdown/marked: тянут экосистему в клиентский бандл
 * ради четырёх конструкций. Безопасность по построению: ВЕСЬ ввод сначала
 * экранируется (escapeHtml), замены делаются только по уже-экранированному
 * тексту и вставляют исключительно фиксированные теги без атрибутов из
 * ввода — инъекция HTML/JS невозможна структурно.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Инлайновые замены внутри одной строки (вход уже экранирован). */
function renderInline(escaped: string): string {
  return escaped
    // `код` — до жирного/курсива, чтобы ** внутри кода не срабатывал
    .replace(/`([^`\n]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-[0.85em]">$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
}

/**
 * md → безопасный HTML. Поддержка: ```блоки кода```, - / * / 1. списки,
 * ## заголовки (рендерятся жирной строкой), пустая строка = абзац.
 */
export function renderMarkdownLite(md: string): string {
  const out: string[] = []
  // Блоки кода отделяем ДО построчной обработки
  const segments = md.split(/```[a-zA-Z]*\n?/)

  segments.forEach((segment, idx) => {
    const isCode = idx % 2 === 1
    if (isCode) {
      out.push(
        `<pre class="my-1.5 overflow-x-auto rounded-lg bg-muted p-2.5 text-[0.85em] leading-snug"><code>${escapeHtml(segment.replace(/\n$/, ''))}</code></pre>`,
      )
      return
    }

    const lines = segment.split('\n')
    let list: { tag: 'ul' | 'ol'; items: string[] } | null = null
    const flushList = () => {
      if (!list) return
      out.push(
        `<${list.tag} class="my-1.5 ${list.tag === 'ul' ? 'list-disc' : 'list-decimal'} pl-5 space-y-0.5">` +
        list.items.map(i => `<li>${i}</li>`).join('') +
        `</${list.tag}>`,
      )
      list = null
    }

    for (const rawLine of lines) {
      const line = rawLine.trimEnd()
      const escaped = renderInline(escapeHtml(line.trim()))

      const ulMatch = /^[-*]\s+/.test(line.trim())
      const olMatch = /^\d+[.)]\s+/.test(line.trim())

      if (ulMatch || olMatch) {
        const tag: 'ul' | 'ol' = ulMatch ? 'ul' : 'ol'
        const item = renderInline(escapeHtml(line.trim().replace(/^([-*]|\d+[.)])\s+/, '')))
        if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] } }
        list.items.push(item)
        continue
      }
      flushList()

      if (!line.trim()) continue

      const heading = /^#{1,4}\s+(.*)$/.exec(line.trim())
      if (heading) {
        out.push(`<p class="mt-2 mb-1 font-bold">${renderInline(escapeHtml(heading[1]))}</p>`)
        continue
      }
      out.push(`<p class="my-1">${escaped}</p>`)
    }
    flushList()
  })

  return out.join('')
}
