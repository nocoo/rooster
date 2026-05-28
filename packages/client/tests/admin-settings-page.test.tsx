/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/preact'

describe('AdminSettingsPage', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders a protocol-not-ready banner instead of pretending settings are editable', async () => {
    const { AdminSettingsPage } = await import('../src/pages/admin/Settings.js')
    render(<AdminSettingsPage />)

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy()
    expect(screen.getByText(/Protocol not ready/i)).toBeTruthy()
    expect(screen.getByText(/does not read Hermes/i)).toBeTruthy()
    expect(screen.getByText(/does not shell out/i)).toBeTruthy()
    expect(screen.getByText(/has no/i)).toBeTruthy()
  })

  it('does not render forms, inputs, tables, or any save/apply/restart/reset/edit/connect/login/scan/qrcode button', async () => {
    const { AdminSettingsPage } = await import('../src/pages/admin/Settings.js')
    const { container } = render(<AdminSettingsPage />)

    expect(container.querySelector('form')).toBeNull()
    expect(container.querySelector('input')).toBeNull()
    expect(container.querySelector('textarea')).toBeNull()
    expect(container.querySelector('select')).toBeNull()
    expect(container.querySelector('table')).toBeNull()
    expect(container.querySelector('[type="checkbox"]')).toBeNull()
    expect(container.querySelector('[role="switch"]')).toBeNull()
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /apply/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /restart/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /reset/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /connect/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /login/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /scan/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /qrcode/i })).toBeNull()
  })

  it('renders the 4-item read-only checklist with no mutation verbs in checklist label primary intent', async () => {
    const { AdminSettingsPage } = await import('../src/pages/admin/Settings.js')
    const { container } = render(<AdminSettingsPage />)

    const checklist = container.querySelector('[data-testid="admin-settings-checklist"]')
    expect(checklist).toBeTruthy()

    const items = (checklist as HTMLElement).querySelectorAll('ol.admin-checklist > li.admin-checklist-item')
    expect(items.length).toBe(4)

    expect(screen.getByText(/bridge IPC get_config action with bridge-side secret redaction/i)).toBeTruthy()
    expect(screen.getByText(/GET \/api\/hermes\/config\?sections=\.\.\. with server-side redaction/i)).toBeTruthy()
    expect(screen.getByText(/client fetchConfig\(\) read helper/i)).toBeTruthy()
    expect(screen.getByText(/Settings list \/ detail states \(read-only\)/i)).toBeTruthy()

    // Per Reviewer-B constraint 6, mutation verbs are forbidden in checklist primary
    // intent (the .admin-checklist-label). Scope the assertion there; details may
    // legitimately reference what is read-only or what is being deferred.
    const labelText = Array.from(items)
      .flatMap((el) => Array.from(el.querySelectorAll('.admin-checklist-label')))
      .map((el) => el.textContent)
      .join(' ')
    expect(/\bsave\b/i.test(labelText)).toBe(false)
    expect(/\bapply\b/i.test(labelText)).toBe(false)
    expect(/\brestart\b/i.test(labelText)).toBe(false)
    expect(/\breset\b/i.test(labelText)).toBe(false)
    expect(/\bedit\b/i.test(labelText)).toBe(false)
    expect(/\bconnect\b/i.test(labelText)).toBe(false)
    expect(/\blogin\b/i.test(labelText)).toBe(false)
    expect(/\bscan\b/i.test(labelText)).toBe(false)
    expect(/\bcreate\b/i.test(labelText)).toBe(false)
    expect(/\bdelete\b/i.test(labelText)).toBe(false)
    expect(/\bupdate\b/i.test(labelText)).toBe(false)
  })

  it('renders a credentials/behavior boundary note covering 10+ messaging platforms, tokens/api keys/cookies/qrcode, approvals.mode, privacy.redact_pii, encryption-at-rest, redaction, audit, confirmation', async () => {
    const { AdminSettingsPage } = await import('../src/pages/admin/Settings.js')
    render(<AdminSettingsPage />)

    const note = screen.getByText(/Credentials and behavior boundary/i)
    expect(note).toBeTruthy()

    const container = note.closest('p') ?? note
    const text = container.textContent
    for (const platform of [
      'telegram',
      'discord',
      'slack',
      'whatsapp',
      'matrix',
      'weixin',
      'wecom',
      'feishu',
      'dingtalk',
      'qqbot',
      'platforms',
    ]) {
      expect(new RegExp(platform, 'i').test(text)).toBe(true)
    }
    expect(/tokens/i.test(text)).toBe(true)
    expect(/API keys/i.test(text)).toBe(true)
    expect(/cookies/i.test(text)).toBe(true)
    expect(/qrcode/i.test(text)).toBe(true)
    expect(/approvals\.mode/i.test(text)).toBe(true)
    expect(/privacy\.redact_pii/i.test(text)).toBe(true)
    expect(/encrypted at rest|encryption-at-rest|at rest/i.test(text)).toBe(true)
    expect(/redaction/i.test(text)).toBe(true)
    expect(/audit/i.test(text)).toBe(true)
    expect(/confirmation/i.test(text)).toBe(true)
  })

  it('renders a separate mutation/restart deferred note covering PUT /api/hermes/config, credentials route, restart flag, weixin qrcode writeback, per-section schema, secret store, restart impact, approvals/quota blast radius, security review', async () => {
    const { AdminSettingsPage } = await import('../src/pages/admin/Settings.js')
    render(<AdminSettingsPage />)

    const deferred = screen.getByText(/Mutation and restart are deferred/i)
    expect(deferred).toBeTruthy()

    const container = deferred.closest('p') ?? deferred
    const text = container.textContent
    expect(/PUT \/api\/hermes\/config/.test(text)).toBe(true)
    expect(/PUT \/api\/hermes\/config\/credentials/.test(text)).toBe(true)
    expect(/restart: true/i.test(text)).toBe(true)
    expect(/weixin qrcode/i.test(text)).toBe(true)
    expect(/per-section schema/i.test(text)).toBe(true)
    expect(/secret store/i.test(text)).toBe(true)
    expect(/encryption-at-rest|encryption at rest/i.test(text)).toBe(true)
    expect(/restart impact/i.test(text)).toBe(true)
    expect(/blast radius/i.test(text)).toBe(true)
    expect(/approvals/i.test(text)).toBe(true)
    expect(/quota/i.test(text)).toBe(true)
    expect(/security review/i.test(text)).toBe(true)
  })
})
