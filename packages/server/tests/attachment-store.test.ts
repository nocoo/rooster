import { describe, it, expect, beforeEach } from 'vitest'
import { createDb } from '../src/services/hermes/db.js'
import { AttachmentStore } from '../src/services/hermes/attachment-store.js'
import type Database from 'better-sqlite3'

describe('AttachmentStore', () => {
  let db: Database.Database
  let store: AttachmentStore

  beforeEach(() => {
    db = createDb(':memory:')
    db.prepare("INSERT INTO sessions (id, started_at, last_active) VALUES ('sess-1', '2025-01-01', '2025-01-01')").run()
    store = new AttachmentStore(db)
  })

  describe('create', () => {
    it('should create attachment with session_id', () => {
      const att = store.create({
        session_id: 'sess-1',
        original_name: 'report.pdf',
        stored_name: 'abc-123.pdf',
        mime_type: 'application/pdf',
        size: 4096,
      })
      expect(att.id).toBeDefined()
      expect(att.session_id).toBe('sess-1')
      expect(att.original_name).toBe('report.pdf')
      expect(att.stored_name).toBe('abc-123.pdf')
      expect(att.mime_type).toBe('application/pdf')
      expect(att.size).toBe(4096)
      expect(att.created_at).toBeDefined()
    })

    it('should create attachment without session_id', () => {
      const att = store.create({
        original_name: 'orphan.txt',
        stored_name: 'xyz-456.txt',
        mime_type: 'text/plain',
        size: 100,
      })
      expect(att.session_id).toBeNull()
    })
  })

  describe('get', () => {
    it('should return attachment by id', () => {
      const created = store.create({
        session_id: 'sess-1',
        original_name: 'file.txt',
        stored_name: 'stored.txt',
        mime_type: 'text/plain',
        size: 50,
      })
      const found = store.get(created.id)
      expect(found).toEqual(created)
    })

    it('should return undefined for non-existent id', () => {
      expect(store.get('non-existent')).toBeUndefined()
    })
  })

  describe('listBySession', () => {
    it('should return attachments for a session ordered by created_at', () => {
      store.create({ session_id: 'sess-1', original_name: 'a.txt', stored_name: 'a.txt', mime_type: 'text/plain', size: 1 })
      store.create({ session_id: 'sess-1', original_name: 'b.txt', stored_name: 'b.txt', mime_type: 'text/plain', size: 2 })
      const list = store.listBySession('sess-1')
      expect(list).toHaveLength(2)
      expect(list[0]?.original_name).toBe('a.txt')
      expect(list[1]?.original_name).toBe('b.txt')
    })

    it('should return empty array for session with no attachments', () => {
      expect(store.listBySession('sess-1')).toEqual([])
    })
  })

  describe('delete', () => {
    it('should delete attachment and return true', () => {
      const att = store.create({ session_id: 'sess-1', original_name: 'x.txt', stored_name: 'x.txt', mime_type: 'text/plain', size: 5 })
      expect(store.delete(att.id)).toBe(true)
      expect(store.get(att.id)).toBeUndefined()
    })

    it('should return false for non-existent id', () => {
      expect(store.delete('non-existent')).toBe(false)
    })
  })
})
