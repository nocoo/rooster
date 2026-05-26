/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/preact'

vi.mock('../src/ws/chat.js', () => ({
  connect: vi.fn(),
  setHandlers: vi.fn(),
  sendRun: vi.fn(),
  sendAbort: vi.fn(),
  sendResume: vi.fn(),
  connected: { value: false },
}))

vi.mock('preact-router', () => ({
  route: vi.fn(),
}))

vi.mock('../src/api/settings.js', () => ({
  fetchProfiles: vi.fn().mockResolvedValue([]),
  fetchModels: vi.fn().mockResolvedValue([]),
  fetchProviders: vi.fn().mockResolvedValue([]),
}))

vi.mock('../src/api/sessions.js', () => ({
  fetchSessions: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
  fetchMessages: vi.fn().mockResolvedValue({ messages: [] }),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  renameSession: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() })),
}))

vi.mock('../src/api/upload.js', () => ({
  uploadFile: vi.fn(),
}))

import { ChatInput } from '../src/components/ChatInput.js'
import { runStates } from '../src/state/chat.js'
import { activeSessionId } from '../src/state/sessions.js'
import { pendingAttachments, clearAttachments, addFiles } from '../src/state/attachments.js'
import { uploadFile } from '../src/api/upload.js'
import * as chatModule from '../src/state/chat.js'

const mockUploadFile = uploadFile as ReturnType<typeof vi.fn>

describe('ChatInput — attachments', () => {
  let mockSend: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    activeSessionId.value = 'test-session'
    runStates.value = {}
    clearAttachments()
    mockSend = vi.spyOn(chatModule, 'send').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('should render attach button', () => {
    render(<ChatInput />)
    expect(screen.getByLabelText('Attach file')).toBeTruthy()
  })

  it('should display pending attachments as chips', () => {
    pendingAttachments.value = [
      { localId: 'l1', original_name: 'test.txt', mime_type: 'text/plain', size: 100, status: 'ready', serverId: 'srv1' },
    ]
    render(<ChatInput />)
    expect(screen.getByText('test.txt')).toBeTruthy()
  })

  it('should show error state on failed upload', () => {
    pendingAttachments.value = [
      { localId: 'l2', original_name: 'bad.exe', mime_type: 'application/x-executable', size: 50, status: 'error', error: 'Unsupported' },
    ]
    render(<ChatInput />)
    expect(screen.getByText('Unsupported')).toBeTruthy()
  })

  it('should remove attachment on X click', () => {
    pendingAttachments.value = [
      { localId: 'l1', original_name: 'file.txt', mime_type: 'text/plain', size: 10, status: 'ready', serverId: 'srv1' },
    ]
    render(<ChatInput />)
    fireEvent.click(screen.getByLabelText('Remove file.txt'))
    expect(pendingAttachments.value).toHaveLength(0)
  })

  it('should include attachments in send call', () => {
    pendingAttachments.value = [
      { localId: 'l1', original_name: 'doc.pdf', mime_type: 'application/pdf', size: 2048, status: 'ready', serverId: 'srv-abc' },
    ]
    render(<ChatInput />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Message input')
    textarea.value = 'check this'
    fireEvent.submit(textarea.closest('form') as HTMLFormElement)
    expect(mockSend).toHaveBeenCalledWith('check this', {
      attachments: [{ id: 'srv-abc', original_name: 'doc.pdf', mime_type: 'application/pdf', size: 2048 }],
    })
  })

  it('should clear attachments after send', () => {
    pendingAttachments.value = [
      { localId: 'l1', original_name: 'a.txt', mime_type: 'text/plain', size: 5, status: 'ready', serverId: 's1' },
    ]
    render(<ChatInput />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Message input')
    textarea.value = 'go'
    fireEvent.submit(textarea.closest('form') as HTMLFormElement)
    expect(pendingAttachments.value).toHaveLength(0)
  })

  it('should disable Send while upload is in progress', () => {
    pendingAttachments.value = [
      { localId: 'l1', original_name: 'big.pdf', mime_type: 'application/pdf', size: 999, status: 'uploading' },
    ]
    render(<ChatInput />)
    const sendBtn = screen.getByText('Send')
    expect((sendBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('should call addFiles on file input change', async () => {
    mockUploadFile.mockResolvedValue({ id: 'srv-1', original_name: 'x.txt', mime_type: 'text/plain', size: 3 })
    render(<ChatInput />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['hi'], 'x.txt', { type: 'text/plain' })
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    fireEvent.change(fileInput)
    await vi.waitFor(() => {
      expect(pendingAttachments.value.some((a) => a.original_name === 'x.txt')).toBe(true)
    })
  })

  it('should set error state when upload fails', async () => {
    mockUploadFile.mockRejectedValue(new Error('Too large'))
    addFiles(new MockFileList([new File(['x'], 'fail.txt', { type: 'text/plain' })]))
    await vi.waitFor(() => {
      const entry = pendingAttachments.value.find((a) => a.original_name === 'fail.txt')
      expect(entry?.status).toBe('error')
      expect(entry?.error).toBe('Too large')
    })
  })

  it('should set generic error when non-Error is thrown', async () => {
    mockUploadFile.mockRejectedValue('string-error')
    addFiles(new MockFileList([new File(['y'], 'fail2.txt', { type: 'text/plain' })]))
    await vi.waitFor(() => {
      const entry = pendingAttachments.value.find((a) => a.original_name === 'fail2.txt')
      expect(entry?.status).toBe('error')
      expect(entry?.error).toBe('Upload failed')
    })
  })

  it('should update correct entry when multiple attachments exist', async () => {
    mockUploadFile
      .mockResolvedValueOnce({ id: 'srv-a', original_name: 'a.txt', mime_type: 'text/plain', size: 1 })
      .mockResolvedValueOnce({ id: 'srv-b', original_name: 'b.txt', mime_type: 'text/plain', size: 2 })
    addFiles(new MockFileList([
      new File(['a'], 'a.txt', { type: 'text/plain' }),
      new File(['bb'], 'b.txt', { type: 'text/plain' }),
    ]))
    await vi.waitFor(() => {
      expect(pendingAttachments.value.every((a) => a.status === 'ready')).toBe(true)
    })
    expect(pendingAttachments.value[0]?.serverId).toBe('srv-a')
    expect(pendingAttachments.value[1]?.serverId).toBe('srv-b')
  })

  it('should format KB size in chip', () => {
    pendingAttachments.value = [
      { localId: 'l1', original_name: 'mid.txt', mime_type: 'text/plain', size: 5120, status: 'ready', serverId: 's1' },
    ]
    render(<ChatInput />)
    expect(screen.getByText('5.0 KB')).toBeTruthy()
  })

  it('should format MB size in chip', () => {
    pendingAttachments.value = [
      { localId: 'l1', original_name: 'big.pdf', mime_type: 'application/pdf', size: 2 * 1024 * 1024, status: 'ready', serverId: 's1' },
    ]
    render(<ChatInput />)
    expect(screen.getByText('2.0 MB')).toBeTruthy()
  })

  it('should not add files when file input has no selection', () => {
    render(<ChatInput />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', { value: null, configurable: true })
    fireEvent.change(fileInput)
    expect(pendingAttachments.value).toHaveLength(0)
  })
})

class MockFileList {
  [index: number]: File
  private files: File[]
  constructor(files: File[]) {
    this.files = files
    files.forEach((f, i) => { this[i] = f })
  }
  get length() { return this.files.length }
  item(index: number) { return this.files[index] ?? null }
  [Symbol.iterator]() { return this.files[Symbol.iterator]() }
}
