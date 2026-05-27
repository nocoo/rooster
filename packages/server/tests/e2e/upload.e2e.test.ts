import { describe, it, expect, afterEach } from 'vitest'
import { startHarness, type E2eHarness } from './_harness.js'

describe('Upload HTTP routes (L2 e2e)', () => {
  let harness: E2eHarness | undefined

  afterEach(async () => {
    if (harness) await harness.close()
    harness = undefined
  })

  it('POST /api/upload stores a file in the os.tmpdir uploadsDir', async () => {
    harness = await startHarness()
    const form = new FormData()
    form.append('file', new File(['hello world'], 'note.txt', { type: 'text/plain' }))
    const res = await fetch(`${harness.url}/api/upload`, {
      method: 'POST',
      body: form,
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { id: string; original_name: string }
    expect(body.original_name).toBe('note.txt')
    expect(typeof body.id).toBe('string')
  })

  it('GET /api/upload/:id returns attachment metadata', async () => {
    harness = await startHarness()
    const form = new FormData()
    form.append('file', new File(['data'], 'meta.txt', { type: 'text/plain' }))
    const created = await fetch(`${harness.url}/api/upload`, { method: 'POST', body: form })
    const { id } = await created.json() as { id: string }
    const res = await fetch(`${harness.url}/api/upload/${id}`)
    expect(res.status).toBe(200)
    const body = await res.json() as { id: string; mime_type: string }
    expect(body.id).toBe(id)
    expect(body.mime_type).toBe('text/plain')
  })
})
