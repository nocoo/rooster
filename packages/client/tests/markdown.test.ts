import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '../src/lib/markdown.js'

describe('renderMarkdown', () => {
  it('should render plain text as paragraph', () => {
    const html = renderMarkdown('hello')
    expect(html).toContain('<p>hello</p>')
  })

  it('should render code blocks with highlight', () => {
    const html = renderMarkdown('```js\nconst x = 1\n```')
    expect(html).toContain('<pre>')
    expect(html).toContain('<code')
    expect(html).toContain('hljs')
  })

  it('should escape raw HTML input', () => {
    const html = renderMarkdown('<script>alert("xss")</script>')
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
    expect(html).toContain('<pre>')
    expect(html).toContain('foo')
  })
})
