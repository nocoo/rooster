interface ReasoningBlockProps {
  reasoning: string
  done: boolean
  streaming?: boolean
}

export function ReasoningBlock({ reasoning, done, streaming }: ReasoningBlockProps) {
  if (!reasoning) return null

  const isExpanded = !done || streaming

  return (
    <details class="reasoning-block" open={isExpanded}>
      <summary class="reasoning-block-summary">
        <svg class="reasoning-block-icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" />
        </svg>
        <span class="reasoning-block-label">
          {streaming && !done ? 'Thinking…' : 'Reasoning'}
        </span>
      </summary>
      <div class="reasoning-block-content">
        <pre class="reasoning-block-text">{reasoning || ''}</pre>
      </div>
    </details>
  )
}
