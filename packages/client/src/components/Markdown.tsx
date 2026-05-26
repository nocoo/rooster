import { useRef, useEffect } from 'preact/hooks'
import { renderMarkdown } from '../lib/markdown.js'

export function Markdown({ content }: { content: string }) {
  const html = renderMarkdown(content)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const timers: Array<ReturnType<typeof setTimeout>> = []

    function showFeedback(btn: HTMLElement, text: string) {
      btn.textContent = text
      const timer = setTimeout(() => { btn.textContent = 'Copy' }, 1500)
      timers.push(timer)
    }

    function handleClick(e: Event) {
      const target = e.target as HTMLElement
      if (!target.classList.contains('code-block-copy')) return
      const wrapper = target.closest('.code-block-wrapper')
      const code = wrapper?.querySelector('code')
      if (!code) return
      const text = code.textContent || ''
      let writePromise: Promise<void>
      try {
        writePromise = navigator.clipboard.writeText(text)
      } catch {
        showFeedback(target, 'Failed')
        return
      }
      writePromise.then(
        () => { showFeedback(target, 'Copied!') },
        () => { showFeedback(target, 'Failed') },
      )
    }

    el.addEventListener('click', handleClick)
    return () => {
      el.removeEventListener('click', handleClick)
      for (const t of timers) clearTimeout(t)
    }
  }, [content])

  return <div ref={containerRef} class="message-content markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
}
