import { describe, it, expect, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createDb, getDb, closeDb, migrateSchema } from '../src/services/hermes/db.js'
import { MessageStore } from '../src/services/hermes/message-store.js'

describe('db', () => {
  afterEach(() => {
    closeDb()
  })

  describe('createDb', () => {
    it('should create an in-memory database with schema', () => {
      const db = createDb(':memory:')
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      ).all() as Array<{ name: string }>
      const names = tables.map((t) => t.name)
      expect(names).toContain('sessions')
      expect(names).toContain('messages')
      expect(names).toContain('session_usage')
      expect(names).toContain('chat_compression_snapshots')
      expect(names).toContain('model_context')
      db.close()
    })

    it('should set WAL journal mode for file databases', async () => {
      const fs = await import('node:fs')
      const path = `/tmp/rooster-test-wal-${String(process.pid)}.db`
      const db = createDb(path)
      const result = db.pragma('journal_mode') as Array<{ journal_mode: string }>
      expect(result[0]).toBeDefined()
      expect(result[0]?.journal_mode).toBe('wal')
      db.close()
      fs.unlinkSync(path)
      // Clean up WAL/SHM files
      try { fs.unlinkSync(path + '-wal') } catch { /* ignore */ }
      try { fs.unlinkSync(path + '-shm') } catch { /* ignore */ }
    })

    it('should enable foreign keys', () => {
      const db = createDb(':memory:')
      const result = db.pragma('foreign_keys') as Array<{ foreign_keys: number }>
      expect(result[0]).toBeDefined()
      expect(result[0]?.foreign_keys).toBe(1)
      db.close()
    })
  })

  describe('getDb', () => {
    it('should return the same instance on subsequent calls', () => {
      const a = getDb(':memory:')
      const b = getDb(':memory:')
      expect(a).toBe(b)
    })

    it('should use ROOSTER_DB_PATH env var when no path given', () => {
      closeDb()
      process.env['ROOSTER_DB_PATH'] = ':memory:'
      const instance = getDb()
      expect(instance).toBeDefined()
      delete process.env['ROOSTER_DB_PATH']
    })
  })

  describe('closeDb', () => {
    it('should close and reset the singleton', () => {
      getDb(':memory:')
      closeDb()
      const fresh = getDb(':memory:')
      expect(fresh).toBeDefined()
    })

    it('should no-op when no db is open', () => {
      closeDb()
      closeDb()
    })
  })

  describe('schema migration — attachments column', () => {
    it('should add attachments column to existing messages table that lacks it', () => {
      const db = new Database(':memory:')
      db.pragma('journal_mode = WAL')
      db.pragma('foreign_keys = ON')
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          started_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_active TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT,
          tool_call_id TEXT,
          tool_calls TEXT,
          tool_name TEXT,
          timestamp TEXT NOT NULL DEFAULT (datetime('now')),
          token_count INTEGER,
          finish_reason TEXT,
          reasoning TEXT,
          reasoning_details TEXT,
          reasoning_content TEXT,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );
      `)
      db.prepare("INSERT INTO sessions (id, started_at, last_active) VALUES ('s1', '2025-01-01', '2025-01-01')").run()

      const colsBefore = db.pragma('table_info(messages)') as Array<{ name: string }>
      expect(colsBefore.some((c) => c.name === 'attachments')).toBe(false)

      migrateSchema(db)

      const colsAfter = db.pragma('table_info(messages)') as Array<{ name: string }>
      expect(colsAfter.some((c) => c.name === 'attachments')).toBe(true)

      const store = new MessageStore(db)
      const plain = store.append({ session_id: 's1', role: 'user', content: 'plain text' })
      expect(plain.attachments).toBeNull()

      const withAtt = store.append({
        session_id: 's1',
        role: 'user',
        content: 'with file',
        attachments: [{ id: 'a1', original_name: 'f.txt', mime_type: 'text/plain', size: 10 }],
      })
      expect(withAtt.attachments).toEqual([{ id: 'a1', original_name: 'f.txt', mime_type: 'text/plain', size: 10 }])

      db.close()
    })

    it('should be idempotent when column already exists', () => {
      const db = createDb(':memory:')
      const cols = db.pragma('table_info(messages)') as Array<{ name: string }>
      expect(cols.some((c) => c.name === 'attachments')).toBe(true)
      // Running again should not throw
      migrateSchema(db)
      const colsStill = db.pragma('table_info(messages)') as Array<{ name: string }>
      expect(colsStill.some((c) => c.name === 'attachments')).toBe(true)
      db.close()
    })
  })
})
