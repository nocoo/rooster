import { api } from './client.js'
import type {
  Session,
  SessionListResponse,
  MessageListResponse,
  PaginatedMessagesResponse,
  SearchResponse,
} from '../types.js'

export async function fetchSessions(opts?: {
  limit?: number
  offset?: number
  profile?: string
}): Promise<SessionListResponse> {
  const params = new URLSearchParams()
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit))
  if (opts?.offset !== undefined) params.set('offset', String(opts.offset))
  if (opts?.profile) params.set('profile', opts.profile)
  const qs = params.toString()
  return api.get<SessionListResponse>(`/api/hermes/sessions${qs ? `?${qs}` : ''}`)
}

export async function fetchSession(id: string): Promise<Session> {
  return api.get<Session>(`/api/hermes/sessions/${id}`)
}

export async function deleteSession(id: string): Promise<void> {
  await api.del(`/api/hermes/sessions/${id}`)
}

export async function renameSession(id: string, title: string): Promise<void> {
  await api.post(`/api/hermes/sessions/${id}/rename`, { title })
}

export async function fetchMessages(sessionId: string): Promise<MessageListResponse> {
  return api.get<MessageListResponse>(`/api/hermes/sessions/conversations/${sessionId}/messages`)
}

export async function fetchMessagesPaginated(
  sessionId: string,
  opts?: { limit?: number; before?: string; after?: string },
): Promise<PaginatedMessagesResponse> {
  const params = new URLSearchParams()
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit))
  if (opts?.before) params.set('before', opts.before)
  if (opts?.after) params.set('after', opts.after)
  const qs = params.toString()
  return api.get<PaginatedMessagesResponse>(
    `/api/hermes/sessions/conversations/${sessionId}/messages/paginated${qs ? `?${qs}` : ''}`,
  )
}

export async function searchSessions(q: string, opts?: {
  limit?: number
  offset?: number
}): Promise<SearchResponse> {
  const params = new URLSearchParams()
  params.set('q', q)
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit))
  if (opts?.offset !== undefined) params.set('offset', String(opts.offset))
  return api.get<SearchResponse>(`/api/hermes/search/sessions?${params.toString()}`)
}

export function getExportUrl(sessionId: string, format: 'json' | 'markdown'): string {
  return `/api/hermes/sessions/${sessionId}/export?format=${format}`
}
