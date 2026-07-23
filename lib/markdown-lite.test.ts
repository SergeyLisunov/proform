import { describe, expect, it } from 'vitest'
import { renderMarkdownLite } from './markdown-lite'

describe('renderMarkdownLite — XSS safety', () => {
  it('экранирует HTML-теги из ввода', () => {
    const html = renderMarkdownLite('<script>alert(1)</script>')
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;script&gt;')
  })

  it('экранирует HTML внутри жирного и кода', () => {
    const html = renderMarkdownLite('**<img src=x onerror=alert(1)>** и `<b>x</b>`')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<b>')
    expect(html).toContain('<strong>&lt;img')
  })

  it('экранирует HTML внутри блока кода', () => {
    const html = renderMarkdownLite('```\n<script>x</script>\n```')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('не пропускает атрибуты/URL из ввода в теги', () => {
    const html = renderMarkdownLite('*текст* "с кавычками" & амперсанд')
    expect(html).toContain('&quot;')
    expect(html).toContain('&amp;')
  })
})

describe('renderMarkdownLite — рендеринг', () => {
  it('жирный и курсив', () => {
    expect(renderMarkdownLite('**жирный** и *курсив*'))
      .toContain('<strong>жирный</strong>')
    expect(renderMarkdownLite('**жирный** и *курсив*'))
      .toContain('<em>курсив</em>')
  })

  it('маркированный список', () => {
    const html = renderMarkdownLite('- один\n- два')
    expect(html).toContain('<ul')
    expect(html).toContain('<li>один</li>')
    expect(html).toContain('<li>два</li>')
  })

  it('нумерованный список', () => {
    const html = renderMarkdownLite('1. раз\n2. два')
    expect(html).toContain('<ol')
    expect(html).toContain('<li>раз</li>')
  })

  it('inline-код не подхватывает ** внутри', () => {
    const html = renderMarkdownLite('`a ** b`')
    expect(html).toContain('a ** b')
    expect(html).not.toContain('<strong>')
  })

  it('блок кода сохраняет содержимое', () => {
    const html = renderMarkdownLite('```js\nconst a = 1\n```')
    expect(html).toContain('<pre')
    expect(html).toContain('const a = 1')
  })

  it('заголовок рендерится жирной строкой', () => {
    const html = renderMarkdownLite('## План на неделю')
    expect(html).toContain('font-bold')
    expect(html).toContain('План на неделю')
  })

  it('обычные абзацы', () => {
    const html = renderMarkdownLite('Первый.\n\nВторой.')
    expect(html).toContain('<p class="my-1">Первый.</p>')
    expect(html).toContain('<p class="my-1">Второй.</p>')
  })

  it('жирный маркер внутри пункта списка', () => {
    const html = renderMarkdownLite('- **Важно:** отдых')
    expect(html).toContain('<li><strong>Важно:</strong> отдых</li>')
  })
})
