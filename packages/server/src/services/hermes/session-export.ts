import type { Session } from './session-store.js'
import type { Message } from './message-store.js'

export function exportSession(session: Session, messages: Message[], format: 'json' | 'markdown'): string {
  if (format === 'json') {
    return JSON.stringify({
      session: {
        id: session.id,
        title: session.title,
        profile: session.profile,
        model: session.model,
        provider: session.provider,
        workspace: session.workspace,
        started_at: session.started_at,
        last_active: session.last_active,
      },
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        ...(m.reasoning ? { reasoning: m.reasoning } : {}),
        ...(m.attachments && m.attachments.length > 0 ? { attachments: m.attachments } : {}),
      })),
    }, null, 2)
  }

  return formatMarkdown(session, messages)
}

function formatMarkdown(session: Session, messages: Message[]): string {
  const lines: string[] = []

  const title = session.title || `Session ${session.id}`
  lines.push(`# ${title}`)
  lines.push('')
  lines.push(`- **ID:** ${session.id}`)
  if (session.profile) lines.push(`- **Profile:** ${session.profile}`)
  if (session.model) lines.push(`- **Model:** ${session.model}`)
  if (session.provider) lines.push(`- **Provider:** ${session.provider}`)
  if (session.workspace) lines.push(`- **Workspace:** ${session.workspace}`)
  lines.push(`- **Started:** ${session.started_at}`)
  lines.push(`- **Last active:** ${session.last_active}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  for (const msg of messages) {
    const role = msg.role === 'user' ? 'Human' : 'Agent'
    lines.push(`## ${role} — ${msg.timestamp}`)
    lines.push('')

    if (msg.reasoning) {
      lines.push('> **Reasoning:**')
      for (const rline of msg.reasoning.split('\n')) {
        lines.push(`> ${rline}`)
      }
      lines.push('')
    }

    if (msg.content) {
      lines.push(msg.content)
      lines.push('')
    }

    if (msg.attachments && msg.attachments.length > 0) {
      lines.push('**Attachments:**')
      for (const att of msg.attachments) {
        lines.push(`- ${att.original_name} (${att.mime_type}, ${String(att.size)} bytes, id: ${att.id})`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}
