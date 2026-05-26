export interface Session {
  id: string
  title?: string
  profile?: string
  model?: string
  provider?: string
  source?: string
  started_at: string
  last_active: string
}

export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

export interface SessionListResponse {
  sessions: Session[]
  total: number
}

export interface MessageListResponse {
  messages: Message[]
}

export interface PaginatedMessagesResponse {
  messages: Message[]
  total: number
}
