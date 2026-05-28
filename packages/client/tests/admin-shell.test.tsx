/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/preact'
import { activeSessionId, messages, loading } from '../src/state/sessions.js'

const mockFetchSessions = vi.fn()
const mockFetchMessages = vi.fn()

vi.mock('../src/api/sessions.js', () => ({
  fetchSessions: (...args: unknown[]) => mockFetchSessions(...args) as unknown,
  fetchMessages: (...args: unknown[]) => mockFetchMessages(...args) as unknown,
  deleteSession: vi.fn().mockResolvedValue(undefined),
  renameSession: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() })),
}))

vi.mock('../src/api/settings.js', () => ({
  fetchProfiles: vi.fn().mockResolvedValue([]),
  fetchModels: vi.fn().mockResolvedValue([]),
  fetchProviders: vi.fn().mockResolvedValue([]),
}))

vi.mock('../src/api/health.js', () => ({
  fetchHealth: vi.fn().mockResolvedValue({ status: 'ok', timestamp: '', bridge: 'connected' }),
}))

const NAV_LABELS = [
  'Overview',
  'Profiles',
  'Skills',
  'Plugins',
  'Memory',
  'Models',
  'Files',
  'Logs',
  'Jobs',
  'Settings',
]

describe('Admin shell', () => {
  beforeEach(() => {
    activeSessionId.value = null
    messages.value = []
    loading.value = false
    mockFetchSessions.mockReset()
    mockFetchSessions.mockResolvedValue({ sessions: [], total: 0 })
    mockFetchMessages.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the admin layout with sidebar + content at /admin', async () => {
    const { App } = await import('../src/pages/App.js')
    const { container } = render(<App url="/admin" />)

    expect(container.querySelector('.admin-layout')).toBeTruthy()
    expect(container.querySelector('.admin-sidebar')).toBeTruthy()
    expect(container.querySelector('.admin-content')).toBeTruthy()
  })

  it('does not render the chat session sidebar on admin routes', async () => {
    const { App } = await import('../src/pages/App.js')
    const { container } = render(<App url="/admin" />)

    expect(container.querySelector('.app-sidebar')).toBeNull()
  })

  it('renders all 10 admin nav items with icons + text', async () => {
    const { App } = await import('../src/pages/App.js')
    const { container } = render(<App url="/admin" />)

    const sidebar = container.querySelector('.admin-sidebar')
    expect(sidebar).toBeTruthy()
    const nav = within(sidebar as HTMLElement)
    for (const label of NAV_LABELS) {
      const link = nav.getByRole('link', { name: label })
      expect(link).toBeTruthy()
    }
  })

  it('marks Overview as the current page when at /admin', async () => {
    const { App } = await import('../src/pages/App.js')
    const { container } = render(<App url="/admin" />)

    const sidebar = container.querySelector('.admin-sidebar') as HTMLElement
    const nav = within(sidebar)
    const overview = nav.getByRole('link', { name: 'Overview' })
    expect(overview.getAttribute('aria-current')).toBe('page')
    expect(overview.getAttribute('href')).toBe('/admin')

    const profiles = nav.getByRole('link', { name: 'Profiles' })
    expect(profiles.getAttribute('aria-current')).toBeNull()
  })

  it('marks the matching nav item active when entering a known admin section', async () => {
    const { App } = await import('../src/pages/App.js')
    const { container } = render(<App url="/admin/profiles" />)

    const sidebar = container.querySelector('.admin-sidebar') as HTMLElement
    const nav = within(sidebar)
    const profiles = nav.getByRole('link', { name: 'Profiles' })
    expect(profiles.getAttribute('aria-current')).toBe('page')

    const overview = nav.getByRole('link', { name: 'Overview' })
    expect(overview.getAttribute('aria-current')).toBeNull()
  })

  it('renders a known section placeholder without 404 at /admin/plugins', async () => {
    const { App } = await import('../src/pages/App.js')
    render(<App url="/admin/plugins" />)

    expect(screen.getByRole('heading', { name: 'Plugins' })).toBeTruthy()
    expect(screen.getByText(/ships in a later phase/i)).toBeTruthy()
  })

  it('renders an Unknown admin section placeholder for unknown slugs', async () => {
    const { App } = await import('../src/pages/App.js')
    const { container } = render(<App url="/admin/whatever" />)

    expect(screen.getByRole('heading', { name: /Unknown admin section/i })).toBeTruthy()

    const sidebar = container.querySelector('.admin-sidebar') as HTMLElement
    const navLinks = sidebar.querySelectorAll('a.admin-nav-link')
    expect(navLinks.length).toBe(10)
    for (const link of navLinks) {
      expect(link.getAttribute('aria-current')).toBeNull()
    }
  })
})
