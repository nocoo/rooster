/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/preact'

describe('AdminPluginsPage', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders a protocol-not-ready banner instead of pretending plugins are managed', async () => {
    const { AdminPluginsPage } = await import('../src/pages/admin/Plugins.js')
    render(<AdminPluginsPage />)

    expect(screen.getByRole('heading', { name: 'Plugins' })).toBeTruthy()
    expect(screen.getByText(/Protocol not ready/i)).toBeTruthy()
    expect(screen.getByText(/does not yet have a bridge plugins IPC action/i)).toBeTruthy()
  })

  it('does not render a plugins table, install button, or remove button', async () => {
    const { AdminPluginsPage } = await import('../src/pages/admin/Plugins.js')
    const { container } = render(<AdminPluginsPage />)

    expect(container.querySelector('table')).toBeNull()
    expect(screen.queryByRole('button', { name: /install/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull()
  })

  it('renders the 4-item read-only wiring checklist (no install/remove items)', async () => {
    const { AdminPluginsPage } = await import('../src/pages/admin/Plugins.js')
    const { container } = render(<AdminPluginsPage />)

    const items = container.querySelectorAll('ol.admin-checklist > li.admin-checklist-item')
    expect(items.length).toBe(4)

    expect(screen.getByText(/bridge IPC list_plugins action/i)).toBeTruthy()
    expect(screen.getByText(/GET \/api\/hermes\/plugins/)).toBeTruthy()
    expect(screen.getByText(/client fetchPlugins\(\) helper/)).toBeTruthy()
    expect(screen.getByText(/Plugins table \/ manifest detail states/i)).toBeTruthy()

    const allChecklistText = Array.from(items).map((el) => el.textContent).join(' ')
    expect(/install_plugin/i.test(allChecklistText)).toBe(false)
    expect(/remove_plugin/i.test(allChecklistText)).toBe(false)
  })
})
