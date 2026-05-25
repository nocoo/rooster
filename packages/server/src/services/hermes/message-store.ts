import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

export interface Message {
  id: string
  session_id: string
  role: string
  content: string | null
  tool_call_id: string | null
  tool_calls: string | null
  tool_name: string | null
  timestamp: string
  token_count: number | null
  finish_reason: string | null
  reasoning: string | null
  reasoning_details: string | null
  reasoning_content: string | null
}

export interface AppendMessageInput {
  id?: string
  session_id: string
  role: string
  content?: string
  tool_call_id?: string
  tool_calls?: string
  tool_name?: string
  timestamp?: string
  token_count?: number
  finish_reason?: string
  reasoning?: string
  reasoning_details?: string
  reasoning_content?: string
}

export interface PaginateOptions {
  limit?: number
  before?: string // message ID cursor
  after?: string  // message ID cursor
}

export class MessageStore {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  append(input: AppendMessageInput): Message {
    const id = input.id ?? randomUUID()
    const timestamp = input.timestamp ?? new Date().toISOString()
    this.db.prepare(`
      INSERT INTO messages (id, session_id, role, content, tool_call_id, tool_calls, tool_name, timestamp, token_count, finish_reason, reasoning, reasoning_details, reasoning_content)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.session_id,
      input.role,
      input.content ?? null,
      input.tool_call_id ?? null,
      input.tool_calls ?? null,
      input.tool_name ?? null,
      timestamp,
      input.token_count ?? null,
      input.finish_reason ?? null,
      input.reasoning ?? null,
      input.reasoning_details ?? null,
      input.reasoning_content ?? null,
    )
    return this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Message
  }

  list(sessionId: string): Message[] {
    return this.db.prepare(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC, id ASC',
    ).all(sessionId) as Message[]
  }

  paginate(sessionId: string, options: PaginateOptions = {}): Message[] {
    const { limit = 50, before, after } = options
    if (after) {
      return this.db.prepare(`
        SELECT m.* FROM messages m, messages ref
        WHERE m.session_id = ? AND ref.id = ? AND ref.session_id = ?
          AND (m.timestamp > ref.timestamp OR (m.timestamp = ref.timestamp AND m.id > ref.id))
        ORDER BY m.timestamp ASC, m.id ASC LIMIT ?
      `).all(sessionId, after, sessionId, limit) as Message[]
    }
    if (before) {
      return this.db.prepare(`
        SELECT m.* FROM messages m, messages ref
        WHERE m.session_id = ? AND ref.id = ? AND ref.session_id = ?
          AND (m.timestamp < ref.timestamp OR (m.timestamp = ref.timestamp AND m.id < ref.id))
        ORDER BY m.timestamp DESC, m.id DESC LIMIT ?
      `).all(sessionId, before, sessionId, limit).reverse() as Message[]
    }
    return this.db.prepare(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC, id ASC LIMIT ?',
    ).all(sessionId, limit) as Message[]
  }

  count(sessionId: string): number {
    const row = this.db.prepare(
      'SELECT COUNT(*) as cnt FROM messages WHERE session_id = ?',
    ).get(sessionId) as { cnt: number }
    return row.cnt
  }
}
