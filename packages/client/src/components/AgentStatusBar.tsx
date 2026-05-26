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
    <div class="agent-status-item">
      <span class="Label Label--secondary Label--small">{status.type}</span>
      <span>{parts.join(' · ')}</span>
    </div>
  )
}

export function AgentStatusBar() {
  const events = agentEvents.value
  if (events.length === 0) return null

  return (
    <div class="agent-status-bar">
      {events.map((evt, i) => (
        <StatusItem key={i} status={evt} />
      ))}
    </div>
  )
}
