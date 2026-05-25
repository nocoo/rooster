import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

export interface Session {
  id: string
  profile: string | null
  source: string | null
  model: string | null
  provider: string | null
  title: string | null
  started_at: string
  ended_at: string | null
  end_reason: string | null
  message_count: number
  tool_call_count: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  reasoning_tokens: number
  estimated_cost_usd: number
  preview: string | null
  last_active: string
  workspace: string | null
}

export interface CreateSessionInput {
  id?: string
  profile?: string
  source?: string
  model?: string
  provider?: string
  title?: string
  workspace?: string
}

export interface ListSessionsOptions {
  limit?: number
  offset?: number
  profile?: string
}

export class SessionStore {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  create(input: CreateSessionInput = {}): Session {
    const id = input.id ?? randomUUID()
    const now = new Date().toISOString()
    this.db.prepare(`
      INSERT INTO sessions (id, profile, source, model, provider, title, started_at, last_active, workspace)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.profile ?? null,
      input.source ?? null,
      input.model ?? null,
      input.provider ?? null,
      input.title ?? null,
      now,
      now,
      input.workspace ?? null,
    )
    return this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session
  }

  get(id: string): Session | undefined {
    return this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined
  }

  list(options: ListSessionsOptions = {}): Session[] {
    const { limit = 50, offset = 0, profile } = options
    if (profile) {
      return this.db.prepare(
        'SELECT * FROM sessions WHERE profile = ? ORDER BY last_active DESC LIMIT ? OFFSET ?',
      ).all(profile, limit, offset) as Session[]
    }
    return this.db.prepare(
      'SELECT * FROM sessions ORDER BY last_active DESC LIMIT ? OFFSET ?',
    ).all(limit, offset) as Session[]
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
    return result.changes > 0
  }

  updateLastActive(id: string): void {
    this.db.prepare('UPDATE sessions SET last_active = ? WHERE id = ?')
      .run(new Date().toISOString(), id)
  }

  updateTitle(id: string, title: string): void {
    this.db.prepare('UPDATE sessions SET title = ? WHERE id = ?').run(title, id)
  }

  updateTokens(id: string, tokens: {
    input_tokens?: number
    output_tokens?: number
    message_count?: number
    tool_call_count?: number
  }): void {
    const sets: string[] = []
    const values: unknown[] = []
    if (tokens.input_tokens !== undefined) {
      sets.push('input_tokens = input_tokens + ?')
      values.push(tokens.input_tokens)
    }
    if (tokens.output_tokens !== undefined) {
      sets.push('output_tokens = output_tokens + ?')
      values.push(tokens.output_tokens)
    }
    if (tokens.message_count !== undefined) {
      sets.push('message_count = message_count + ?')
      values.push(tokens.message_count)
    }
    if (tokens.tool_call_count !== undefined) {
      sets.push('tool_call_count = tool_call_count + ?')
      values.push(tokens.tool_call_count)
    }
    if (sets.length === 0) return
    values.push(id)
    this.db.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  }

  end(id: string, reason: string): void {
    this.db.prepare('UPDATE sessions SET ended_at = ?, end_reason = ? WHERE id = ?')
      .run(new Date().toISOString(), reason, id)
  }

  count(profile?: string): number {
    if (profile) {
      const row = this.db.prepare('SELECT COUNT(*) as cnt FROM sessions WHERE profile = ?').get(profile) as { cnt: number }
      return row.cnt
    }
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM sessions').get() as { cnt: number }
    return row.cnt
  }
}
