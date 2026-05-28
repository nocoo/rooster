/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/preact'

describe('AdminFilesPage', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders a protocol-not-ready banner instead of pretending files are browsable', async () => {
    const { AdminFilesPage } = await import('../src/pages/admin/Files.js')
    render(<AdminFilesPage />)

    expect(screen.getByRole('heading', { name: 'Files' })).toBeTruthy()
    expect(screen.getByText(/Protocol not ready/i)).toBeTruthy()
    expect(screen.getByText(/does not yet have a general filesystem browse bridge IPC action/i)).toBeTruthy()
  })

  it('does not render a file table, path input, or any read/download/delete/open button', async () => {
    const { AdminFilesPage } = await import('../src/pages/admin/Files.js')
    const { container } = render(<AdminFilesPage />)

    expect(container.querySelector('table')).toBeNull()
    expect(container.querySelector('input')).toBeNull()
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /open/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /read/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /preview/i })).toBeNull()
  })

  it('renders the 4-item read-only checklist with no write / delete entries', async () => {
    const { AdminFilesPage } = await import('../src/pages/admin/Files.js')
    const { container } = render(<AdminFilesPage />)

    const items = container.querySelectorAll('ol.admin-checklist > li.admin-checklist-item')
    expect(items.length).toBe(4)

    expect(screen.getByText(/bridge IPC list_files \/ read_file actions/i)).toBeTruthy()
    expect(screen.getByText(/GET \/api\/hermes\/files/)).toBeTruthy()
    expect(screen.getByText(/client fetchFiles\(\) helper/)).toBeTruthy()
    expect(screen.getByText(/Files list \/ preview \/ detail states/i)).toBeTruthy()

    const checklistText = Array.from(items).map((el) => el.textContent).join(' ')
    expect(/delete/i.test(checklistText)).toBe(false)
    expect(/download/i.test(checklistText)).toBe(false)
    expect(/\brename\b/i.test(checklistText)).toBe(false)
    expect(/\bwrite\b/i.test(checklistText)).toBe(false)
  })

  it('renders a separate security note covering allowlisted root, path traversal, symlink, absolute paths, and read-only first', async () => {
    const { AdminFilesPage } = await import('../src/pages/admin/Files.js')
    render(<AdminFilesPage />)

    const note = screen.getByText(/Security boundary/i)
    expect(note).toBeTruthy()

    const container = note.closest('p') ?? note
    const text = container.textContent
    expect(/allowlisted root/i.test(text)).toBe(true)
    expect(/absolute paths?/i.test(text)).toBe(true)
    expect(/symlink/i.test(text)).toBe(true)
    expect(/read-only/i.test(text)).toBe(true)
    expect(/root containment/i.test(text)).toBe(true)
    expect(/separate security review/i.test(text)).toBe(true)
  })

  it('notes that session upload attachments are intentionally out of scope (not a filesystem browser)', async () => {
    const { AdminFilesPage } = await import('../src/pages/admin/Files.js')
    render(<AdminFilesPage />)

    expect(screen.getByText(/Session upload attachments/i)).toBeTruthy()
    expect(screen.getByText(/intentionally out of scope/i)).toBeTruthy()
  })
})
