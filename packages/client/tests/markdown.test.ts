import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '../src/lib/markdown.js'

describe('renderMarkdown', () => {
  it('should render plain text as paragraph', () => {
    const html = renderMarkdown('hello')
    expect(html).toContain('<p>hello</p>')
  })

  it('should render code blocks with highlight and wrapper', () => {
    const html = renderMarkdown('```js\nconst x = 1\n```')
    expect(html).toContain('<div class="code-block-wrapper">')
    expect(html).toContain('<pre>')
    expect(html).toContain('<code class="language-js">')
    expect(html).toContain('hljs')
  })

  it('should include language label in code block header', () => {
    const html = renderMarkdown('```typescript\nlet y = 2\n```')
    expect(html).toContain('<span class="code-block-lang">typescript</span>')
  })

  it('should not include language label when no language specified', () => {
    const html = renderMarkdown('```\nplain code\n```')
    expect(html).not.toContain('code-block-lang')
    expect(html).toContain('<div class="code-block-header">')
    expect(html).toContain('plain code')
  })

  it('should include copy button in code block header', () => {
    const html = renderMarkdown('```js\ncode\n```')
    expect(html).toContain('<button type="button" class="code-block-copy" aria-label="Copy code">Copy</button>')
  })

  it('should escape raw HTML input', () => {
    const html = renderMarkdown('<script>alert("xss")</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('should escape HTML in code block content', () => {
    const html = renderMarkdown('```html\n<div class="evil">&</div>\n```')
    expect(html).not.toContain('<div class="evil">')
    expect(html).toContain('&amp;')
  })

  it('should escape language name in attributes', () => {
    const html = renderMarkdown('```<script>\nalert(1)\n```')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('should render inline code', () => {
    const html = renderMarkdown('use `const` keyword')
    expect(html).toContain('<code>const</code>')
  })

  it('should render lists', () => {
    const html = renderMarkdown('- item 1\n- item 2')
    expect(html).toContain('<li>item 1</li>')
  })

  it('should handle unknown language gracefully', () => {
    const html = renderMarkdown('```unknownlang\nfoo\n```')
    expect(html).toContain('<div class="code-block-wrapper">')
    expect(html).toContain('<span class="code-block-lang">unknownlang</span>')
    expect(html).toContain('foo')
  })

  it('should render blockquote', () => {
    const html = renderMarkdown('> quoted text')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('quoted text')
  })

  it('should render table', () => {
    const html = renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |')
    expect(html).toContain('<table>')
    expect(html).toContain('<th>A</th>')
    expect(html).toContain('<td>1</td>')
  })
})
