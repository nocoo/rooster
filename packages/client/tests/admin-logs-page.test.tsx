/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/preact'

describe('AdminLogsPage', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders a protocol-not-ready banner instead of pretending logs are queryable', async () => {
    const { AdminLogsPage } = await import('../src/pages/admin/Logs.js')
    render(<AdminLogsPage />)

    expect(screen.getByRole('heading', { name: 'Logs' })).toBeTruthy()
    expect(screen.getByText(/Protocol not ready/i)).toBeTruthy()
    expect(screen.getByText(/stdout \/ stderr via pino/i)).toBeTruthy()
    expect(screen.getByText(/no persisted or retrievable log source/i)).toBeTruthy()
  })

  it('does not render a log table, search input, or any tail/stream/export/clear/download button', async () => {
    const { AdminLogsPage } = await import('../src/pages/admin/Logs.js')
    const { container } = render(<AdminLogsPage />)

    expect(container.querySelector('table')).toBeNull()
    expect(container.querySelector('input')).toBeNull()
    expect(screen.queryByRole('button', { name: /tail/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /stream/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /export/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /clear/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /purge/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
  })

  it('renders the 4-item read-only checklist with no clear / purge / delete entries', async () => {
    const { AdminLogsPage } = await import('../src/pages/admin/Logs.js')
    const { container } = render(<AdminLogsPage />)

    const items = container.querySelectorAll('ol.admin-checklist > li.admin-checklist-item')
    expect(items.length).toBe(4)

    expect(screen.getByText(/bridge IPC list_logs \/ tail_logs actions/i)).toBeTruthy()
    expect(screen.getByText(/GET \/api\/hermes\/logs with pagination \+ filters \+ server-side redaction/i)).toBeTruthy()
    expect(screen.getByText(/client fetchLogs\(\) helper/)).toBeTruthy()
    expect(screen.getByText(/Logs list \/ detail states/i)).toBeTruthy()

    const checklistText = Array.from(items).map((el) => el.textContent).join(' ')
    expect(/\bclear\b/i.test(checklistText)).toBe(false)
    expect(/\bpurge\b/i.test(checklistText)).toBe(false)
    expect(/\bdelete\b/i.test(checklistText)).toBe(false)
  })

  it('renders a privacy/retention note covering secrets, tokens, PII, retention, redaction, audit', async () => {
    const { AdminLogsPage } = await import('../src/pages/admin/Logs.js')
    render(<AdminLogsPage />)

    const note = screen.getByText(/Privacy and retention boundary/i)
    expect(note).toBeTruthy()

    const container = note.closest('p') ?? note
    const text = container.textContent
    expect(/secrets/i.test(text)).toBe(true)
    expect(/API keys/i.test(text)).toBe(true)
    expect(/tokens/i.test(text)).toBe(true)
    expect(/user message content/i.test(text)).toBe(true)
    expect(/attachment paths/i.test(text)).toBe(true)
    expect(/PII/.test(text)).toBe(true)
    expect(/redaction/i.test(text)).toBe(true)
    expect(/retention/i.test(text)).toBe(true)
    expect(/TTL/.test(text)).toBe(true)
    expect(/rotation/i.test(text)).toBe(true)
    expect(/audit/i.test(text)).toBe(true)
  })

  it('renders a separate deferred note that explicitly defers live-tail and export to a security review', async () => {
    const { AdminLogsPage } = await import('../src/pages/admin/Logs.js')
    render(<AdminLogsPage />)

    const deferred = screen.getByText(/Live-tail and export are deferred/i)
    expect(deferred).toBeTruthy()

    const container = deferred.closest('p') ?? deferred
    const text = container.textContent
    expect(/live-tail/i.test(text)).toBe(true)
    expect(/export/i.test(text)).toBe(true)
    expect(/separate security review/i.test(text)).toBe(true)
    expect(/audit/i.test(text)).toBe(true)
  })
})
