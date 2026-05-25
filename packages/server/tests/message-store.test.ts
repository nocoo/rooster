import { describe, it, expect, beforeEach } from 'vitest'
import { createDb } from '../src/services/hermes/db.js'
import { MessageStore } from '../src/services/hermes/message-store.js'
import type Database from 'better-sqlite3'

describe('MessageStore', () => {
  let db: Database.Database
  let store: MessageStore

  beforeEach(() => {
    db = createDb(':memory:')
    db.prepare("INSERT INTO sessions (id, started_at, last_active) VALUES ('sess-1', '2025-01-01', '2025-01-01')").run()
    store = new MessageStore(db)
  })

  describe('append', () => {
    it('should append a message with defaults', () => {
      const msg = store.append({ session_id: 'sess-1', role: 'user', content: 'hello' })
      expect(msg.id).toBeDefined()
      expect(msg.session_id).toBe('sess-1')
      expect(msg.role).toBe('user')
      expect(msg.content).toBe('hello')
      expect(msg.timestamp).toBeDefined()
    })

    it('should append a message with all fields', () => {
      const msg = store.append({
        id: 'msg-1',
        session_id: 'sess-1',
        role: 'assistant',
        content: 'response',
        tool_call_id: 'tc-1',
        tool_calls: '[{"id":"tc-1"}]',
        tool_name: 'read_file',
        timestamp: '2025-01-01T00:00:00Z',
        token_count: 100,
        finish_reason: 'stop',
        reasoning: 'thinking...',
        reasoning_details: 'details',
        reasoning_content: 'content',
      })
      expect(msg.id).toBe('msg-1')
      expect(msg.tool_call_id).toBe('tc-1')
      expect(msg.tool_name).toBe('read_file')
      expect(msg.token_count).toBe(100)
      expect(msg.finish_reason).toBe('stop')
    })
  })

  describe('list', () => {
    it('should return empty array for session with no messages', () => {
      expect(store.list('sess-1')).toEqual([])
    })

    it('should return messages ordered by timestamp ASC', () => {
      store.append({ session_id: 'sess-1', role: 'user', content: 'first', timestamp: '2025-01-01T00:00:01Z' })
      store.append({ session_id: 'sess-1', role: 'assistant', content: 'second', timestamp: '2025-01-01T00:00:02Z' })
      const msgs = store.list('sess-1')
      expect(msgs).toHaveLength(2)
      expect(msgs[0]?.content).toBe('first')
      expect(msgs[1]?.content).toBe('second')
    })
  })

  describe('paginate', () => {
    beforeEach(() => {
      for (let i = 1; i <= 10; i++) {
        store.append({
          session_id: 'sess-1',
          role: 'user',
          content: `msg-${String(i)}`,
          timestamp: `2025-01-01T00:00:${String(i).padStart(2, '0')}Z`,
        })
      }
    })

    it('should return first page with default limit', () => {
      const msgs = store.paginate('sess-1')
      expect(msgs).toHaveLength(10)
    })

    it('should respect limit', () => {
      const msgs = store.paginate('sess-1', { limit: 3 })
      expect(msgs).toHaveLength(3)
      expect(msgs[0]?.content).toBe('msg-1')
    })

    it('should paginate with after cursor', () => {
      const msgs = store.paginate('sess-1', { after: '2025-01-01T00:00:05Z', limit: 3 })
      expect(msgs).toHaveLength(3)
      expect(msgs[0]?.content).toBe('msg-6')
    })

    it('should paginate with before cursor', () => {
      const msgs = store.paginate('sess-1', { before: '2025-01-01T00:00:05Z', limit: 3 })
      expect(msgs).toHaveLength(3)
      expect(msgs[0]?.content).toBe('msg-2')
      expect(msgs[2]?.content).toBe('msg-4')
    })
  })

  describe('count', () => {
    it('should return 0 for empty session', () => {
      expect(store.count('sess-1')).toBe(0)
    })

    it('should return message count', () => {
      store.append({ session_id: 'sess-1', role: 'user', content: 'a' })
      store.append({ session_id: 'sess-1', role: 'assistant', content: 'b' })
      expect(store.count('sess-1')).toBe(2)
    })
  })

  describe('cascade delete', () => {
    it('should delete messages when session is deleted', () => {
      store.append({ session_id: 'sess-1', role: 'user', content: 'hello' })
      store.append({ session_id: 'sess-1', role: 'assistant', content: 'hi' })
      expect(store.count('sess-1')).toBe(2)
      db.prepare('DELETE FROM sessions WHERE id = ?').run('sess-1')
      expect(store.count('sess-1')).toBe(0)
    })
  })
})
