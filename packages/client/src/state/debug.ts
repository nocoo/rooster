import { signal } from '@preact/signals'

export interface DebugEvent {
  id: string
  time: string
  event: string
  payload: unknown
}

export const debugEnabled = signal(false)
export const debugEvents = signal<DebugEvent[]>([])

export function toggleDebug(): void {
  debugEnabled.value = !debugEnabled.value
}

export function pushDebugEvent(event: string, payload: unknown): void {
  if (!debugEnabled.value) return
  const entry: DebugEvent = {
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    event,
    payload,
  }
  debugEvents.value = [...debugEvents.value, entry]
}

export function clearDebugEvents(): void {
  debugEvents.value = []
}
