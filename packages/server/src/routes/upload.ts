import { Hono } from 'hono'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import type { AttachmentStore } from '../services/hermes/attachment-store.js'

export interface UploadRouteDeps {
  attachmentStore: AttachmentStore
  uploadsDir: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
])

const SAFE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.pdf', '.txt', '.md', '.csv', '.json',
])

function safeExtension(originalName: string): string {
  const ext = extname(originalName).toLowerCase()
  return SAFE_EXTENSIONS.has(ext) ? ext : ''
}

export function createUploadRoutes(deps: UploadRouteDeps): Hono {
  const { attachmentStore, uploadsDir } = deps
  const routes = new Hono()

  routes.post('/', async (c) => {
    const body = await c.req.parseBody()
    const file = body['file']
    if (!(file instanceof File)) {
      return c.json({ error: 'No file provided' }, 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: 'File too large (max 10 MB)' }, 413)
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return c.json({ error: `Unsupported file type: ${file.type}` }, 415)
    }

    const ext = safeExtension(file.name)
    const storedName = `${randomUUID()}${ext}`

    await mkdir(uploadsDir, { recursive: true })
    const filePath = join(uploadsDir, storedName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    const sessionId = typeof body['session_id'] === 'string' ? body['session_id'] : undefined
    const attachment = attachmentStore.create({
      original_name: file.name,
      stored_name: storedName,
      mime_type: file.type,
      size: file.size,
      ...(sessionId ? { session_id: sessionId } : {}),
    })

    return c.json({
      id: attachment.id,
      original_name: attachment.original_name,
      mime_type: attachment.mime_type,
      size: attachment.size,
    }, 201)
  })

  routes.get('/:id', (c) => {
    const attachment = attachmentStore.get(c.req.param('id'))
    if (!attachment) {
      return c.json({ error: 'Attachment not found' }, 404)
    }
    return c.json({
      id: attachment.id,
      original_name: attachment.original_name,
      mime_type: attachment.mime_type,
      size: attachment.size,
      created_at: attachment.created_at,
    })
  })

  return routes
}
