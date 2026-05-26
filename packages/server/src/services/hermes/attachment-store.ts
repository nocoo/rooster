import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

export interface Attachment {
  id: string
  session_id: string | null
  original_name: string
  stored_name: string
  mime_type: string
  size: number
  created_at: string
}

export interface CreateAttachmentInput {
  session_id?: string
  original_name: string
  stored_name: string
  mime_type: string
  size: number
}

export class AttachmentStore {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  create(input: CreateAttachmentInput): Attachment {
    const id = randomUUID()
    this.db.prepare(`
      INSERT INTO attachments (id, session_id, original_name, stored_name, mime_type, size)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, input.session_id ?? null, input.original_name, input.stored_name, input.mime_type, input.size)
    return this.db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as Attachment
  }

  get(id: string): Attachment | undefined {
    return this.db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as Attachment | undefined
  }

  listBySession(sessionId: string): Attachment[] {
    return this.db.prepare(
      'SELECT * FROM attachments WHERE session_id = ? ORDER BY created_at ASC',
    ).all(sessionId) as Attachment[]
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM attachments WHERE id = ?').run(id)
    return result.changes > 0
  }
}
