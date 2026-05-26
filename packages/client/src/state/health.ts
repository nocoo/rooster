import { signal } from '@preact/signals'
import { fetchHealth } from '../api/health.js'

export type BridgeStatus = 'connected' | 'unreachable' | 'unknown'

export const bridgeStatus = signal<BridgeStatus>('unknown')

let pollTimer: ReturnType<typeof setInterval> | null = null

const POLL_INTERVAL = 30_000

export async function checkHealth(): Promise<void> {
  try {
    const res = await fetchHealth()
    bridgeStatus.value = res.bridge
  } catch {
    bridgeStatus.value = 'unreachable'
  }
}

export function startHealthPolling(): void {
  if (pollTimer) return
  void checkHealth()
  pollTimer = setInterval(() => { void checkHealth() }, POLL_INTERVAL)
}

export function stopHealthPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
