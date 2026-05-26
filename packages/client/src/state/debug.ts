import { signal } from '@preact/signals'
import { uuid } from '../lib/uuid.js'

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
  const entry: DebugEvent = {
    id: uuid(),
    time: new Date().toISOString(),
    event,
    payload,
  }
  debugEvents.value = [...debugEvents.value, entry]
}

export function clearDebugEvents(): void {
  debugEvents.value = []
}
