import { useRef, useEffect } from 'preact/hooks'
import { renderMarkdown } from '../lib/markdown.js'

export function Markdown({ content }: { content: string }) {
  const html = renderMarkdown(content)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function handleClick(e: Event) {
      const target = e.target as HTMLElement
      if (!target.classList.contains('code-block-copy')) return
      const wrapper = target.closest('.code-block-wrapper')
      const code = wrapper?.querySelector('code')
      if (!code) return
      navigator.clipboard.writeText(code.textContent || '').then(
        () => {
          target.textContent = 'Copied!'
          setTimeout(() => { target.textContent = 'Copy' }, 1500)
        },
        () => {
          target.textContent = 'Failed'
          setTimeout(() => { target.textContent = 'Copy' }, 1500)
        },
      )
    }

    el.addEventListener('click', handleClick)
    return () => { el.removeEventListener('click', handleClick) }
  }, [content])

  return <div ref={containerRef} class="message-content markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
}
