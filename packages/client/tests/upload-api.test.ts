/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { uploadFile } from '../src/api/upload.js'

describe('uploadFile', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should POST file as FormData and return result', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'att-1', original_name: 'doc.pdf', mime_type: 'application/pdf', size: 1234 }),
    })
    const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' })
    const result = await uploadFile(file)
    expect(result).toEqual({ id: 'att-1', original_name: 'doc.pdf', mime_type: 'application/pdf', size: 1234 })
    expect(fetchMock).toHaveBeenCalledWith('/api/upload', expect.objectContaining({ method: 'POST' }))
  })

  it('should include session_id in FormData when provided', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'att-2', original_name: 'a.txt', mime_type: 'text/plain', size: 5 }),
    })
    const file = new File(['hello'], 'a.txt', { type: 'text/plain' })
    await uploadFile(file, 'sess-99')
    const callArgs = fetchMock.mock.calls[0] as [string, RequestInit]
    const callBody = callArgs[1].body as FormData
    expect(callBody.get('session_id')).toBe('sess-99')
  })

  it('should throw with error message from response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 413,
      json: () => Promise.resolve({ error: 'File too large (max 10 MB)' }),
    })
    const file = new File(['x'.repeat(100)], 'big.txt', { type: 'text/plain' })
    await expect(uploadFile(file)).rejects.toThrow('File too large (max 10 MB)')
  })

  it('should throw generic message when no error field in response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    })
    const file = new File(['x'], 'a.txt', { type: 'text/plain' })
    await expect(uploadFile(file)).rejects.toThrow('Upload failed: 500')
  })
})
