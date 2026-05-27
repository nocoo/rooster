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

export interface SearchSessionsOptions {
  q: string
  limit?: number
  offset?: number
}

export interface SearchResult {
  session: Session
  snippet: string | null
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

  search(options: SearchSessionsOptions): SearchResult[] {
    const { q, limit = 20, offset = 0 } = options
    const pattern = `%${q}%`

    const rows = this.db.prepare(`
      SELECT DISTINCT s.*,
        (SELECT
          CASE
            WHEN m.content LIKE ? THEN substr(m.content, max(1, instr(m.content, ?) - 40), 120)
            ELSE substr(m.reasoning, max(1, instr(m.reasoning, ?) - 40), 120)
          END
         FROM messages m
         WHERE m.session_id = s.id
           AND (m.content LIKE ? OR m.reasoning LIKE ?)
         LIMIT 1
        ) as snippet
      FROM sessions s
      LEFT JOIN messages m ON m.session_id = s.id
      WHERE s.title LIKE ?
        OR s.preview LIKE ?
        OR s.workspace LIKE ?
        OR s.profile LIKE ?
        OR s.model LIKE ?
        OR s.provider LIKE ?
        OR s.source LIKE ?
        OR m.content LIKE ?
        OR m.reasoning LIKE ?
      ORDER BY s.last_active DESC
      LIMIT ? OFFSET ?
    `).all(pattern, q, q, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, limit, offset) as Array<Session & { snippet: string | null }>

    return rows.map((row) => {
      const { snippet, ...session } = row
      return { session, snippet }
    })
  }

  searchCount(q: string): number {
    const pattern = `%${q}%`
    const row = this.db.prepare(`
      SELECT COUNT(DISTINCT s.id) as cnt
      FROM sessions s
      LEFT JOIN messages m ON m.session_id = s.id
      WHERE s.title LIKE ?
        OR s.preview LIKE ?
        OR s.workspace LIKE ?
        OR s.profile LIKE ?
        OR s.model LIKE ?
        OR s.provider LIKE ?
        OR s.source LIKE ?
        OR m.content LIKE ?
        OR m.reasoning LIKE ?
    `).get(pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern) as { cnt: number }
    return row.cnt
  }
}
