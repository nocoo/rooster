import { describe, it, expect, afterEach } from 'vitest'
import { createDb, getDb, closeDb } from '../src/services/hermes/db.js'

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
  })

  describe('closeDb', () => {
    it('should close and reset the singleton', () => {
      getDb(':memory:')
      closeDb()
      // After close, getDb should create a new instance
      const fresh = getDb(':memory:')
      expect(fresh).toBeDefined()
    })
  })
})
