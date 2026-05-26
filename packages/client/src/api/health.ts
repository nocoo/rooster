import { api } from './client.js'

export interface HealthResponse {
  status: 'ok' | 'degraded'
  timestamp: string
  bridge: 'connected' | 'unreachable'
}

export async function fetchHealth(): Promise<HealthResponse> {
  return api.get<HealthResponse>('/health')
}
