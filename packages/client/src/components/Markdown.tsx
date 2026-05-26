import { renderMarkdown } from '../lib/markdown.js'

export function Markdown({ content }: { content: string }) {
  const html = renderMarkdown(content)
  return <div class="message-content markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
}
