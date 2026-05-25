import { describe, it, expect, beforeEach } from 'vitest'
import { createDb } from '../src/services/hermes/db.js'
import { SessionStore } from '../src/services/hermes/session-store.js'
import type Database from 'better-sqlite3'
import type { Session } from '../src/services/hermes/session-store.js'

function mustGet(store: SessionStore, id: string): Session {
  const s = store.get(id)
  if (s === undefined) throw new Error(`session ${id} not found`)
  return s
}

describe('SessionStore', () => {
  let db: Database.Database
  let store: SessionStore

  beforeEach(() => {
    db = createDb(':memory:')
    store = new SessionStore(db)
  })

  describe('create', () => {
    it('should create a session with defaults', () => {
      const session = store.create()
      expect(session.id).toBeDefined()
      expect(session.profile).toBeNull()
      expect(session.message_count).toBe(0)
      expect(session.input_tokens).toBe(0)
      expect(session.started_at).toBeDefined()
      expect(session.last_active).toBeDefined()
    })

    it('should create a session with provided fields', () => {
      const session = store.create({
        id: 'test-id',
        profile: 'coding',
        source: 'web',
        model: 'claude-4',
        provider: 'anthropic',
        title: 'Test Session',
        workspace: '/tmp/test',
      })
      expect(session.id).toBe('test-id')
      expect(session.profile).toBe('coding')
      expect(session.source).toBe('web')
      expect(session.model).toBe('claude-4')
      expect(session.provider).toBe('anthropic')
      expect(session.title).toBe('Test Session')
      expect(session.workspace).toBe('/tmp/test')
    })
  })

  describe('get', () => {
    it('should return undefined for non-existent session', () => {
      expect(store.get('nonexistent')).toBeUndefined()
    })

    it('should return session by id', () => {
      store.create({ id: 'sess-1', title: 'First' })
      const session = mustGet(store, 'sess-1')
      expect(session.title).toBe('First')
    })
  })

  describe('list', () => {
    it('should return empty array when no sessions', () => {
      expect(store.list()).toEqual([])
    })

    it('should return sessions ordered by last_active desc', () => {
      store.create({ id: 'a', title: 'First' })
      store.create({ id: 'b', title: 'Second' })
      // Force distinct last_active via direct SQL
      db.prepare("UPDATE sessions SET last_active = '2020-01-01T00:00:00.000Z' WHERE id = 'a'").run()
      db.prepare("UPDATE sessions SET last_active = '2025-01-01T00:00:00.000Z' WHERE id = 'b'").run()
      const sessions = store.list()
      expect(sessions).toHaveLength(2)
      expect(sessions[0]?.id).toBe('b')
      expect(sessions[1]?.id).toBe('a')
    })

    it('should filter by profile', () => {
      store.create({ id: 'a', profile: 'coding' })
      store.create({ id: 'b', profile: 'chat' })
      store.create({ id: 'c', profile: 'coding' })
      const coding = store.list({ profile: 'coding' })
      expect(coding).toHaveLength(2)
      for (const s of coding) {
        expect(s.profile).toBe('coding')
      }
    })

    it('should respect limit and offset', () => {
      for (let i = 0; i < 10; i++) {
        store.create({ id: `s-${String(i)}` })
      }
      const page = store.list({ limit: 3, offset: 2 })
      expect(page).toHaveLength(3)
    })
  })

  describe('delete', () => {
    it('should delete an existing session', () => {
      store.create({ id: 'del-me' })
      expect(store.delete('del-me')).toBe(true)
      expect(store.get('del-me')).toBeUndefined()
    })

    it('should return false for non-existent session', () => {
      expect(store.delete('nope')).toBe(false)
    })
  })

  describe('updateLastActive', () => {
    it('should update last_active timestamp', () => {
      store.create({ id: 'active-test' })
      const before = mustGet(store, 'active-test').last_active
      store.updateLastActive('active-test')
      const after = mustGet(store, 'active-test').last_active
      expect(after).toBeDefined()
      expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime())
    })
  })

  describe('updateTitle', () => {
    it('should update session title', () => {
      store.create({ id: 'title-test', title: 'Old' })
      store.updateTitle('title-test', 'New Title')
      expect(mustGet(store, 'title-test').title).toBe('New Title')
    })
  })

  describe('updateTokens', () => {
    it('should increment token counts', () => {
      store.create({ id: 'tok-test' })
      store.updateTokens('tok-test', {
        input_tokens: 100,
        output_tokens: 50,
        message_count: 2,
        tool_call_count: 1,
      })
      const session = mustGet(store, 'tok-test')
      expect(session.input_tokens).toBe(100)
      expect(session.output_tokens).toBe(50)
      expect(session.message_count).toBe(2)
      expect(session.tool_call_count).toBe(1)
    })

    it('should accumulate on multiple calls', () => {
      store.create({ id: 'acc-test' })
      store.updateTokens('acc-test', { input_tokens: 10 })
      store.updateTokens('acc-test', { input_tokens: 20 })
      expect(mustGet(store, 'acc-test').input_tokens).toBe(30)
    })

    it('should no-op when no fields provided', () => {
      store.create({ id: 'noop-test' })
      store.updateTokens('noop-test', {})
      expect(mustGet(store, 'noop-test').input_tokens).toBe(0)
    })
  })

  describe('end', () => {
    it('should set ended_at and end_reason', () => {
      store.create({ id: 'end-test' })
      store.end('end-test', 'user_closed')
      const session = mustGet(store, 'end-test')
      expect(session.ended_at).not.toBeNull()
      expect(session.end_reason).toBe('user_closed')
    })
  })

  describe('count', () => {
    it('should return total session count', () => {
      store.create({ id: 'c1' })
      store.create({ id: 'c2' })
      expect(store.count()).toBe(2)
    })

    it('should count by profile', () => {
      store.create({ id: 'c1', profile: 'a' })
      store.create({ id: 'c2', profile: 'b' })
      store.create({ id: 'c3', profile: 'a' })
      expect(store.count('a')).toBe(2)
      expect(store.count('b')).toBe(1)
    })
  })
})
