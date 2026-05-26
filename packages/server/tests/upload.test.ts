import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createApp } from '../src/app.js'
import { createDb } from '../src/services/hermes/db.js'
import { AgentBridgeClient } from '../src/services/hermes/agent-bridge.js'
import type Database from 'better-sqlite3'
import { mkdtempSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import net from 'node:net'
import { unlinkSync } from 'node:fs'
import type { Hono } from 'hono'

describe('upload routes', () => {
  let app: Hono
  let db: Database.Database
  let uploadsDir: string
  let bridgeServer: net.Server
  let bridgePath: string

  beforeEach(() => {
    db = createDb(':memory:')
    uploadsDir = mkdtempSync(join(tmpdir(), 'rooster-upload-test-'))
    bridgePath = `/tmp/rooster-test-upload-bridge-${String(process.pid)}.sock`
    try { unlinkSync(bridgePath) } catch { /* ignore */ }
    bridgeServer = net.createServer((conn) => {
      let data = ''
      conn.on('data', (chunk) => {
        data += chunk.toString()
        if (data.includes('\n')) {
          conn.write(JSON.stringify({ ok: true }) + '\n')
          conn.end()
        }
      })
    })
    bridgeServer.listen(bridgePath)
    const bridge = new AgentBridgeClient({ endpoint: bridgePath })
    app = createApp({ db, bridge, uploadsDir })
  })

  afterEach(() => {
    bridgeServer.close()
    rmSync(uploadsDir, { recursive: true, force: true })
  })

  function createFormData(name: string, content: string, type: string, fileName: string): FormData {
    const blob = new Blob([content], { type })
    const form = new FormData()
    form.append(name, new File([blob], fileName, { type }))
    return form
  }

  describe('POST /api/upload', () => {
    it('should upload a valid file and return metadata', async () => {
      const form = createFormData('file', 'hello world', 'text/plain', 'test.txt')
      const res = await app.request('/api/upload', { method: 'POST', body: form })
      expect(res.status).toBe(201)
      const body = (await res.json()) as { id: string; original_name: string; mime_type: string; size: number }
      expect(body.id).toBeDefined()
      expect(body.original_name).toBe('test.txt')
      expect(body.mime_type).toBe('text/plain')
      expect(body.size).toBe(11)
    })

    it('should store file on disk with UUID name', async () => {
      const form = createFormData('file', 'data', 'text/plain', 'my-file.txt')
      await app.request('/api/upload', { method: 'POST', body: form })
      const files = readdirSync(uploadsDir)
      expect(files).toHaveLength(1)
      expect(files[0]).toMatch(/^[0-9a-f-]+\.txt$/)
    })

    it('should reject files exceeding 10 MB', async () => {
      const bigContent = 'x'.repeat(10 * 1024 * 1024 + 1)
      const blob = new Blob([bigContent], { type: 'text/plain' })
      const form = new FormData()
      form.append('file', new File([blob], 'big.txt', { type: 'text/plain' }))
      const res = await app.request('/api/upload', { method: 'POST', body: form })
      expect(res.status).toBe(413)
      const body = (await res.json()) as { error: string }
      expect(body.error).toContain('too large')
    })

    it('should reject unsupported MIME types', async () => {
      const form = createFormData('file', 'binary', 'application/x-executable', 'bad.exe')
      const res = await app.request('/api/upload', { method: 'POST', body: form })
      expect(res.status).toBe(415)
      const body = (await res.json()) as { error: string }
      expect(body.error).toContain('Unsupported file type')
    })

    it('should return 400 when no file is provided', async () => {
      const form = new FormData()
      form.append('other', 'value')
      const res = await app.request('/api/upload', { method: 'POST', body: form })
      expect(res.status).toBe(400)
    })

    it('should strip unsafe extensions', async () => {
      const form = createFormData('file', '{}', 'application/json', 'payload.json')
      await app.request('/api/upload', { method: 'POST', body: form })
      const files = readdirSync(uploadsDir)
      expect(files[0]).toMatch(/\.json$/)
    })

    it('should handle files with no extension', async () => {
      const form = createFormData('file', 'data', 'text/plain', 'noext')
      await app.request('/api/upload', { method: 'POST', body: form })
      const files = readdirSync(uploadsDir)
      expect(files[0]).toMatch(/^[0-9a-f-]+$/)
    })

    it('should associate file with session_id when provided', async () => {
      db.prepare("INSERT INTO sessions (id, started_at, last_active) VALUES (?, ?, ?)").run('sess-1', '2025-01-01', '2025-01-01')
      const blob = new Blob(['data'], { type: 'text/plain' })
      const form = new FormData()
      form.append('file', new File([blob], 'test.txt', { type: 'text/plain' }))
      form.append('session_id', 'sess-1')
      const res = await app.request('/api/upload', { method: 'POST', body: form })
      expect(res.status).toBe(201)
      const body = (await res.json()) as { id: string }
      const row = db.prepare('SELECT session_id FROM attachments WHERE id = ?').get(body.id) as { session_id: string }
      expect(row.session_id).toBe('sess-1')
    })

    it('should allow image uploads', async () => {
      const form = createFormData('file', 'fake-png', 'image/png', 'photo.png')
      const res = await app.request('/api/upload', { method: 'POST', body: form })
      expect(res.status).toBe(201)
    })

    it('should allow PDF uploads', async () => {
      const form = createFormData('file', 'fake-pdf', 'application/pdf', 'doc.pdf')
      const res = await app.request('/api/upload', { method: 'POST', body: form })
      expect(res.status).toBe(201)
    })
  })

  describe('GET /api/upload/:id', () => {
    it('should return attachment metadata by id', async () => {
      const form = createFormData('file', 'hello', 'text/plain', 'readme.txt')
      const uploadRes = await app.request('/api/upload', { method: 'POST', body: form })
      const { id } = (await uploadRes.json()) as { id: string }

      const res = await app.request(`/api/upload/${id}`)
      expect(res.status).toBe(200)
      const body = (await res.json()) as { id: string; original_name: string; mime_type: string; size: number; created_at: string }
      expect(body.id).toBe(id)
      expect(body.original_name).toBe('readme.txt')
      expect(body.created_at).toBeDefined()
    })

    it('should return 404 for non-existent attachment', async () => {
      const res = await app.request('/api/upload/nonexistent-id')
      expect(res.status).toBe(404)
    })
  })
})
