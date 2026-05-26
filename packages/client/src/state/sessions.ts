import { signal, computed } from '@preact/signals'
import { fetchSessions, fetchMessages, deleteSession, renameSession } from '../api/sessions.js'
import type { Session, Message } from '../types.js'

export const sessions = signal<Session[]>([])
export const sessionsTotal = signal(0)
export const activeSessionId = signal<string | null>(null)
export const messages = signal<Message[]>([])
export const loading = signal(false)
export const error = signal<string | null>(null)

export const activeSession = computed(() =>
  sessions.value.find((s) => s.id === activeSessionId.value) ?? null,
)

export async function loadSessions(opts?: { limit?: number; offset?: number; profile?: string }): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const result = await fetchSessions(opts)
    sessions.value = result.sessions
    sessionsTotal.value = result.total
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to load sessions'
  } finally {
    loading.value = false
  }
}

export async function loadMessages(sessionId: string): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const result = await fetchMessages(sessionId)
    messages.value = result.messages
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to load messages'
  } finally {
    loading.value = false
  }
}

export function setActiveSession(id: string | null): void {
  activeSessionId.value = id
  if (id) {
    void loadMessages(id)
  } else {
    messages.value = []
  }
}

export async function removeSession(id: string): Promise<void> {
  await deleteSession(id)
  sessions.value = sessions.value.filter((s) => s.id !== id)
  sessionsTotal.value = Math.max(0, sessionsTotal.value - 1)
  if (activeSessionId.value === id) {
    activeSessionId.value = null
    messages.value = []
  }
}

export async function updateSessionTitle(id: string, title: string): Promise<void> {
  await renameSession(id, title)
  sessions.value = sessions.value.map((s) => (s.id === id ? { ...s, title } : s))
}
