/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/preact'
import { selectedProfile } from '../src/state/settings.js'

const mockFetchProfiles = vi.fn()

vi.mock('../src/api/settings.js', () => ({
  fetchProfiles: (...args: unknown[]) => mockFetchProfiles(...args) as unknown,
  fetchModels: vi.fn().mockResolvedValue([]),
  fetchProviders: vi.fn().mockResolvedValue([]),
}))

describe('AdminProfilesPage', () => {
  beforeEach(() => {
    mockFetchProfiles.mockReset()
    selectedProfile.value = null
  })

  afterEach(() => {
    cleanup()
  })

  it('renders a read-only banner explaining the bridge protocol gap', async () => {
    mockFetchProfiles.mockResolvedValue([])
    const { AdminProfilesPage } = await import('../src/pages/admin/Profiles.js')
    render(<AdminProfilesPage />)

    expect(screen.getByText(/Read-only preview/i)).toBeTruthy()
    expect(screen.getByText(/dedicated bridge profile protocol/i)).toBeTruthy()
  })

  it('shows a loading state while fetchProfiles is pending', async () => {
    let resolveFn: (v: string[]) => void = () => {}
    mockFetchProfiles.mockReturnValue(new Promise<string[]>((resolve) => { resolveFn = resolve }))
    const { AdminProfilesPage } = await import('../src/pages/admin/Profiles.js')
    render(<AdminProfilesPage />)

    expect(screen.getByText(/Loading profiles/i)).toBeTruthy()
    resolveFn([])
  })

  it('shows an empty state when no profiles are discovered', async () => {
    mockFetchProfiles.mockResolvedValue([])
    const { AdminProfilesPage } = await import('../src/pages/admin/Profiles.js')
    render(<AdminProfilesPage />)

    await waitFor(() => {
      expect(screen.getByText(/No profiles discovered yet/i)).toBeTruthy()
    })
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('renders profiles in a real table with thead/tbody', async () => {
    mockFetchProfiles.mockResolvedValue(['default', 'coding'])
    const { AdminProfilesPage } = await import('../src/pages/admin/Profiles.js')
    const { container } = render(<AdminProfilesPage />)

    await waitFor(() => {
      expect(container.querySelector('table.admin-table thead')).toBeTruthy()
    })
    expect(container.querySelector('table.admin-table tbody')).toBeTruthy()
    const rows = container.querySelectorAll('table.admin-table tbody tr')
    expect(rows.length).toBe(2)
    expect(rows[0]?.textContent).toContain('default')
    expect(rows[1]?.textContent).toContain('coding')
  })

  it('shows an error state and lets the user retry into a successful load', async () => {
    mockFetchProfiles.mockRejectedValueOnce(new Error('network down'))
    mockFetchProfiles.mockResolvedValueOnce(['default'])
    const { AdminProfilesPage } = await import('../src/pages/admin/Profiles.js')
    render(<AdminProfilesPage />)

    await waitFor(() => {
      expect(screen.getByText(/Failed to load profiles: network down/i)).toBeTruthy()
    })

    const retry = screen.getByRole('button', { name: 'Retry' })
    fireEvent.click(retry)

    await waitFor(() => {
      expect(screen.queryByText(/Failed to load profiles/i)).toBeNull()
    })
    expect(screen.getByText('default')).toBeTruthy()
    expect(mockFetchProfiles).toHaveBeenCalledTimes(2)
  })

  it('reflects the active chat profile from the selectedProfile signal', async () => {
    selectedProfile.value = 'coding'
    mockFetchProfiles.mockResolvedValue(['default', 'coding'])
    const { AdminProfilesPage } = await import('../src/pages/admin/Profiles.js')
    render(<AdminProfilesPage />)

    expect(screen.getByText(/Currently active:/i).textContent).toContain('coding')

    await waitFor(() => {
      const codingRow = screen.getAllByRole('row').find((r) => r.textContent.includes('coding'))
      expect(codingRow?.textContent).toContain('Active in chat')
    })
  })

  it('reports "Default profile (unset)" when no selected profile', async () => {
    selectedProfile.value = null
    mockFetchProfiles.mockResolvedValue([])
    const { AdminProfilesPage } = await import('../src/pages/admin/Profiles.js')
    render(<AdminProfilesPage />)

    expect(screen.getByText(/Default profile \(unset\)/i)).toBeTruthy()
  })
})
