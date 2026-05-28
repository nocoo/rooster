/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/preact'

describe('AdminMemoryPage', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders a protocol-not-ready banner instead of pretending memory is managed', async () => {
    const { AdminMemoryPage } = await import('../src/pages/admin/Memory.js')
    render(<AdminMemoryPage />)

    expect(screen.getByRole('heading', { name: 'Memory' })).toBeTruthy()
    expect(screen.getByText(/Protocol not ready/i)).toBeTruthy()
    expect(screen.getByText(/does not yet have a bridge memory IPC action/i)).toBeTruthy()
  })

  it('does not render a memory table, delete button, or search input', async () => {
    const { AdminMemoryPage } = await import('../src/pages/admin/Memory.js')
    const { container } = render(<AdminMemoryPage />)

    expect(container.querySelector('table')).toBeNull()
    expect(container.querySelector('input')).toBeNull()
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /search/i })).toBeNull()
  })

  it('renders the 4-item read-only checklist and a separate delete-deferred security note', async () => {
    const { AdminMemoryPage } = await import('../src/pages/admin/Memory.js')
    const { container } = render(<AdminMemoryPage />)

    const items = container.querySelectorAll('ol.admin-checklist > li.admin-checklist-item')
    expect(items.length).toBe(4)

    expect(screen.getByText(/bridge IPC list_memory action/i)).toBeTruthy()
    expect(screen.getByText(/GET \/api\/hermes\/memory/)).toBeTruthy()
    expect(screen.getByText(/client fetchMemory\(\) helper/)).toBeTruthy()
    expect(screen.getByText(/Memory list \/ search \/ detail states/i)).toBeTruthy()

    const checklistText = Array.from(items).map((el) => el.textContent).join(' ')
    expect(/delete/i.test(checklistText)).toBe(false)

    expect(screen.getByText(/Delete is deferred/i)).toBeTruthy()
    expect(screen.getByText(/security review/i)).toBeTruthy()
    expect(screen.getByText(/irreversibility/i)).toBeTruthy()
  })
})
