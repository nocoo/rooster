import { agentEvents } from '../state/chat.js'
import type { AgentStatus } from '../state/chat.js'

function StatusItem({ status }: { status: AgentStatus }) {
  const parts: string[] = []
  if (status.profile) parts.push(`profile: ${status.profile}`)
  if (status.model) parts.push(`model: ${status.model}`)
  if (status.provider) parts.push(`provider: ${status.provider}`)
  if (status.tool_count != null) parts.push(`tools: ${String(status.tool_count)}`)
  if (parts.length === 0) parts.push(status.type)

  return (
    <div class="d-flex gap-2 px-2 py-1 f6 color-fg-muted">
      <span class="Label Label--secondary Label--small">{status.type}</span>
      <span>{parts.join(' · ')}</span>
    </div>
  )
}

export function AgentStatusBar() {
  const events = agentEvents.value
  if (events.length === 0) return null

  return (
    <div class="Box rounded-1 mb-2 color-bg-subtle overflow-hidden">
      {events.map((evt, i) => (
        <StatusItem key={i} status={evt} />
      ))}
    </div>
  )
}
