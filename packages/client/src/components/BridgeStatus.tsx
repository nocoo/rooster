import { bridgeStatus } from '../state/health.js'

const STATUS_LABELS: Record<string, string> = {
  connected: 'Connected',
  unreachable: 'Disconnected',
  unknown: 'Checking…',
}

export function BridgeStatus() {
  const status = bridgeStatus.value
  const label = STATUS_LABELS[status] ?? 'Unknown'
  const color =
    status === 'connected'
      ? 'var(--fgColor-success, var(--color-success-fg, #1a7f37))'
      : status === 'unreachable'
        ? 'var(--fgColor-danger, var(--color-danger-fg, #cf222e))'
        : 'var(--fgColor-muted, var(--color-fg-muted, #656d76))'

  return (
    <span class="bridge-status" aria-label={`Bridge status: ${label}`}>
      <span
        class="bridge-status-dot"
        style={{ backgroundColor: color }}
      />
      <span class="bridge-status-label">{label}</span>
    </span>
  )
}
