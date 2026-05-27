import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createDb } from '../src/services/hermes/db.js'
import { SessionStore } from '../src/services/hermes/session-store.js'
import { MessageStore } from '../src/services/hermes/message-store.js'
import { AttachmentStore } from '../src/services/hermes/attachment-store.js'
import { executeBridgeRun } from '../src/services/hermes/chat-run/bridge-run.js'
import type { AgentBridgeClient, AgentBridgeChatStarted, AgentBridgeOutput, AgentBridgeResponse } from '../src/services/hermes/agent-bridge.js'
import type Database from 'better-sqlite3'

function createMockBridge(captureMessage?: { value: unknown }): AgentBridgeClient {
  let outputIndex = 0
  const outputs: Array<Partial<AgentBridgeOutput>> = [
    { delta: 'ok', output: 'ok', cursor: 1, event_cursor: 0, events: [], done: true },
  ]

  return {
    chat: (_sid: string, message: unknown) => {
      if (captureMessage) captureMessage.value = message
      return Promise.resolve({
        ok: true,
        run_id: 'run-att',
        session_id: 'sess-att',
        status: 'running',
      } satisfies AgentBridgeChatStarted)
    },
    getOutput: () => {
      const out = outputs[outputIndex] ?? outputs[outputs.length - 1]
      if (outputIndex < outputs.length - 1) outputIndex++
      return Promise.resolve({
        ok: true,
        run_id: 'run-att',
        session_id: 'sess-att',
        status: 'complete',
        delta: '',
        cursor: 0,
        output: '',
        event_cursor: 0,
        events: [],
        done: true,
        ...out,
      } satisfies AgentBridgeOutput)
    },
    interrupt: () => Promise.resolve({ ok: true } satisfies AgentBridgeResponse),
    approvalRespond: () => Promise.resolve({ ok: true } satisfies AgentBridgeResponse),
    clarifyRespond: () => Promise.resolve({ ok: true } satisfies AgentBridgeResponse),
    ping: () => Promise.resolve({ ok: true } satisfies AgentBridgeResponse),
  } as unknown as AgentBridgeClient
}

describe('executeBridgeRun — attachments', () => {
  let db: Database.Database
  let sessionStore: SessionStore
  let messageStore: MessageStore
  let attachmentStore: AttachmentStore
  let uploadsDir: string

  beforeEach(async () => {
    db = createDb(':memory:')
    sessionStore = new SessionStore(db)
    messageStore = new MessageStore(db)
    attachmentStore = new AttachmentStore(db)
    uploadsDir = await mkdtemp(join(tmpdir(), 'rooster-test-'))
  })

  afterEach(async () => {
    await rm(uploadsDir, { recursive: true, force: true })
  })

  it('should pass plain string when no attachments', async () => {
    const captured: { value: unknown } = { value: null }
    const bridge = createMockBridge(captured)
    const emitter = { emit: vi.fn() }

    await executeBridgeRun(
      { bridge, sessionStore, messageStore, attachmentStore, uploadsDir },
      { input: 'hello', session_id: 'sess-att' },
      emitter,
      new AbortController().signal,
    )

    expect(captured.value).toBe('hello')
  })

  it('should build content array with image attachment', async () => {
    const captured: { value: unknown } = { value: null }
    const bridge = createMockBridge(captured)
    const emitter = { emit: vi.fn() }

    const storedName = 'test-image.png'
    const imageData = Buffer.from([0x89, 0x50, 0x4E, 0x47])
    await writeFile(join(uploadsDir, storedName), imageData)

    sessionStore.create({ id: 'sess-att' })
    const attachment = attachmentStore.create({
      session_id: 'sess-att',
      original_name: 'screenshot.png',
      stored_name: storedName,
      mime_type: 'image/png',
      size: imageData.length,
    })

    await executeBridgeRun(
      { bridge, sessionStore, messageStore, attachmentStore, uploadsDir },
      {
        input: 'describe this',
        session_id: 'sess-att',
        attachments: [{ id: attachment.id, original_name: 'screenshot.png', mime_type: 'image/png', size: imageData.length }],
      },
      emitter,
      new AbortController().signal,
    )

    const msg = captured.value as Array<Record<string, unknown>>
    expect(Array.isArray(msg)).toBe(true)
    expect(msg).toHaveLength(2)
    expect(msg[0]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/png' } })
    expect(msg[1]).toMatchObject({ type: 'text', text: 'describe this' })
  })

  it('should build content array with PDF attachment', async () => {
    const captured: { value: unknown } = { value: null }
    const bridge = createMockBridge(captured)
    const emitter = { emit: vi.fn() }

    const storedName = 'test-doc.pdf'
    const pdfData = Buffer.from('%PDF-1.4 fake content')
    await writeFile(join(uploadsDir, storedName), pdfData)

    sessionStore.create({ id: 'sess-att' })
    const attachment = attachmentStore.create({
      session_id: 'sess-att',
      original_name: 'report.pdf',
      stored_name: storedName,
      mime_type: 'application/pdf',
      size: pdfData.length,
    })

    await executeBridgeRun(
      { bridge, sessionStore, messageStore, attachmentStore, uploadsDir },
      {
        input: 'summarize',
        session_id: 'sess-att',
        attachments: [{ id: attachment.id, original_name: 'report.pdf', mime_type: 'application/pdf', size: pdfData.length }],
      },
      emitter,
      new AbortController().signal,
    )

    const msg = captured.value as Array<Record<string, unknown>>
    expect(Array.isArray(msg)).toBe(true)
    expect(msg[0]).toMatchObject({ type: 'document', title: 'report.pdf' })
    expect(msg[1]).toMatchObject({ type: 'text', text: 'summarize' })
  })

  it('should build content array with text file attachment', async () => {
    const captured: { value: unknown } = { value: null }
    const bridge = createMockBridge(captured)
    const emitter = { emit: vi.fn() }

    const storedName = 'test-file.txt'
    const textContent = 'Hello from a text file'
    await writeFile(join(uploadsDir, storedName), textContent)

    sessionStore.create({ id: 'sess-att' })
    const attachment = attachmentStore.create({
      session_id: 'sess-att',
      original_name: 'notes.txt',
      stored_name: storedName,
      mime_type: 'text/plain',
      size: textContent.length,
    })

    await executeBridgeRun(
      { bridge, sessionStore, messageStore, attachmentStore, uploadsDir },
      {
        input: 'read this',
        session_id: 'sess-att',
        attachments: [{ id: attachment.id, original_name: 'notes.txt', mime_type: 'text/plain', size: textContent.length }],
      },
      emitter,
      new AbortController().signal,
    )

    const msg = captured.value as Array<Record<string, unknown>>
    expect(Array.isArray(msg)).toBe(true)
    expect(msg[0]).toMatchObject({ type: 'text', text: '[File: notes.txt]\nHello from a text file' })
    expect(msg[1]).toMatchObject({ type: 'text', text: 'read this' })
  })

  it('should skip attachment when id not found in store', async () => {
    const captured: { value: unknown } = { value: null }
    const bridge = createMockBridge(captured)
    const emitter = { emit: vi.fn() }

    sessionStore.create({ id: 'sess-att' })

    await executeBridgeRun(
      { bridge, sessionStore, messageStore, attachmentStore, uploadsDir },
      {
        input: 'hi',
        session_id: 'sess-att',
        attachments: [{ id: 'nonexistent-id', original_name: 'ghost.png', mime_type: 'image/png', size: 100 }],
      },
      emitter,
      new AbortController().signal,
    )

    const msg = captured.value as Array<Record<string, unknown>>
    expect(Array.isArray(msg)).toBe(true)
    expect(msg).toHaveLength(1)
    expect(msg[0]).toMatchObject({ type: 'text', text: 'hi' })
  })

  it('should fall back to plain string when attachmentStore not provided', async () => {
    const captured: { value: unknown } = { value: null }
    const bridge = createMockBridge(captured)
    const emitter = { emit: vi.fn() }

    sessionStore.create({ id: 'sess-att' })

    await executeBridgeRun(
      { bridge, sessionStore, messageStore },
      {
        input: 'hello',
        session_id: 'sess-att',
        attachments: [{ id: 'some-id', original_name: 'file.png', mime_type: 'image/png', size: 100 }],
      },
      emitter,
      new AbortController().signal,
    )

    expect(captured.value).toBe('hello')
  })
})
