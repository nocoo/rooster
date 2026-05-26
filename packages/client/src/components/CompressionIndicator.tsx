import { activeCompressionState } from '../state/chat.js'

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function CompressionIndicator() {
  const state = activeCompressionState.value
  if (!state) return null

  if (state.status === 'compressing') {
    return (
      <div class="compression-indicator compression-indicator--active" role="status">
        <span class="compression-indicator-label">Compressing context…</span>
        {state.message_count != null && (
          <span class="compression-indicator-detail">{state.message_count} messages</span>
        )}
        {state.token_count != null && (
          <span class="compression-indicator-detail">{formatTokens(state.token_count)} tokens</span>
        )}
        {state.source && (
          <span class="compression-indicator-detail">source: {state.source}</span>
        )}
      </div>
    )
  }

  return (
    <div class="compression-indicator compression-indicator--done" role="status">
      <span class="compression-indicator-label">Context compressed</span>
      {state.beforeTokens != null && state.afterTokens != null && (
        <span class="compression-indicator-detail">
          {formatTokens(state.beforeTokens)} → {formatTokens(state.afterTokens)} tokens
        </span>
      )}
      {state.summaryTokens != null && (
        <span class="compression-indicator-detail">summary: {formatTokens(state.summaryTokens)}</span>
      )}
      {state.totalMessages != null && state.resultMessages != null && (
        <span class="compression-indicator-detail">
          {state.totalMessages} → {state.resultMessages} messages
        </span>
      )}
    </div>
  )
}
