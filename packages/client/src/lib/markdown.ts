import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value
      } catch { /* fallback */ }
    }
    return escapeHtml(str)
  },
})

md.renderer.rules['fence'] = (tokens, idx) => {
  const token = tokens[idx]
  /* v8 ignore next */
  if (!token) return ''
  const lang = token.info.trim()
  const highlighted = md.options.highlight?.(token.content, lang, '') ?? escapeHtml(token.content)
  const langLabel = lang ? `<span class="code-block-lang">${escapeHtml(lang)}</span>` : ''
  const copyBtn = `<button type="button" class="code-block-copy" aria-label="Copy code">Copy</button>`
  const header = `<div class="code-block-header">${langLabel}${copyBtn}</div>`
  return `<div class="code-block-wrapper">${header}<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${highlighted}</code></pre></div>\n`
}

export function renderMarkdown(source: string): string {
  return md.render(source)
}
