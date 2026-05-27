/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/preact'
import { SessionList } from '../src/components/SessionList.js'
import {
  sessions,
  activeSessionId,
  messages,
  searchQuery,
  searchResults,
  searchTotal,
  searchLoading,
  searchError,
} from '../src/state/sessions.js'

const mockSearchSessions = vi.fn()

vi.mock('../src/api/sessions.js', () => ({
  fetchSessions: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
  fetchMessages: vi.fn().mockResolvedValue({ messages: [] }),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  renameSession: vi.fn().mockResolvedValue(undefined),
  searchSessions: (...args: unknown[]) => mockSearchSessions(...args) as unknown,
  getExportUrl: (id: string, format: string) => `/api/hermes/sessions/${id}/export?format=${format}`,
}))

const mockRoute = vi.fn()
vi.mock('preact-router', () => ({
  route: (...args: unknown[]) => mockRoute(...args) as unknown,
}))

describe('SessionList', () => {
  beforeEach(() => {
    sessions.value = []
    activeSessionId.value = null
    messages.value = []
    searchQuery.value = ''
    searchResults.value = []
    searchTotal.value = 0
    searchLoading.value = false
    searchError.value = null
    mockRoute.mockClear()
    mockSearchSessions.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('should show empty message when no sessions', () => {
    render(<SessionList />)
    expect(screen.getByText('No sessions yet')).toBeTruthy()
  })

  it('should render session items', () => {
    sessions.value = [
      { id: 's1', title: 'First Session', started_at: '2025-01-01', last_active: new Date().toISOString() },
      { id: 's2', started_at: '2025-01-02', last_active: new Date().toISOString() },
    ]

    render(<SessionList />)
    expect(screen.getByText('First Session')).toBeTruthy()
    expect(screen.getByText('Chat s2')).toBeTruthy()
  })

  it('should navigate to /session/:id on click', () => {
    sessions.value = [
      { id: 's1', title: 'Test', started_at: '2025-01-01', last_active: new Date().toISOString() },
    ]

    render(<SessionList />)
    fireEvent.click(screen.getByText('Test'))
    expect(mockRoute).toHaveBeenCalledWith('/session/s1')
  })

  it('should highlight active session', () => {
    sessions.value = [
      { id: 's1', title: 'Active', started_at: '2025-01-01', last_active: new Date().toISOString() },
    ]
    activeSessionId.value = 's1'

    const { container } = render(<SessionList />)
    const activeItem = container.querySelector('.session-item--active')
    expect(activeItem).toBeTruthy()
  })

  it('should remove session on delete button click', async () => {
    sessions.value = [
      { id: 's1', title: 'To Delete', started_at: '2025-01-01', last_active: new Date().toISOString() },
      { id: 's2', title: 'Keep', started_at: '2025-01-02', last_active: new Date().toISOString() },
    ]

    render(<SessionList />)
    const deleteButtons = screen.getAllByLabelText('Delete session')
    const firstBtn = deleteButtons[0]
    if (firstBtn) fireEvent.click(firstBtn)

    // Wait for async removeSession to complete
    await new Promise((r) => { setTimeout(r, 10) })

    expect(sessions.value).toHaveLength(1)
    expect(sessions.value[0]?.id).toBe('s2')
  })

  it('should display relative time for recent sessions', () => {
    const now = new Date()
    sessions.value = [
      { id: 's1', title: 'Recent', started_at: '2025-01-01', last_active: now.toISOString() },
    ]

    render(<SessionList />)
    expect(screen.getByText('just now')).toBeTruthy()
  })

  it('should display hours for sessions older than 60 min', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    sessions.value = [
      { id: 's1', title: 'Older', started_at: '2025-01-01', last_active: twoHoursAgo.toISOString() },
    ]

    render(<SessionList />)
    expect(screen.getByText('2h ago')).toBeTruthy()
  })

  it('should render search input', () => {
    render(<SessionList />)
    expect(screen.getByPlaceholderText('Search sessions…')).toBeTruthy()
  })

  it('should show search results when query is active', () => {
    searchQuery.value = 'hello'
    searchResults.value = [
      { session: { id: 's1', title: 'Match', started_at: '2025-01-01', last_active: new Date().toISOString() }, snippet: 'hello world' },
    ]
    searchTotal.value = 1

    render(<SessionList />)
    expect(screen.getByText('Match')).toBeTruthy()
    expect(screen.getByText('hello world')).toBeTruthy()
    expect(screen.getByText('1 results')).toBeTruthy()
  })

  it('should show no results message for empty search', () => {
    searchQuery.value = 'xyz'
    searchResults.value = []
    searchTotal.value = 0

    render(<SessionList />)
    expect(screen.getByText('No results found')).toBeTruthy()
  })

  it('should show loading state during search', () => {
    searchQuery.value = 'test'
    searchLoading.value = true

    render(<SessionList />)
    expect(screen.getByText('Searching…')).toBeTruthy()
  })

  it('should show error state on search failure', () => {
    searchQuery.value = 'test'
    searchError.value = 'Network error'

    render(<SessionList />)
    expect(screen.getByText('Network error')).toBeTruthy()
  })

  it('should hide normal list when searching', () => {
    sessions.value = [
      { id: 's1', title: 'Normal', started_at: '2025-01-01', last_active: new Date().toISOString() },
    ]
    searchQuery.value = 'something'
    searchResults.value = []

    render(<SessionList />)
    expect(screen.queryByText('Normal')).toBeNull()
  })

  it('should navigate to session on search result click', () => {
    searchQuery.value = 'hello'
    searchResults.value = [
      { session: { id: 's1', title: 'Result', started_at: '2025-01-01', last_active: new Date().toISOString() }, snippet: null },
    ]

    render(<SessionList />)
    fireEvent.click(screen.getByText('Result'))
    expect(mockRoute).toHaveBeenCalledWith('/session/s1')
  })

  it('should clear search when Clear button is clicked', () => {
    searchQuery.value = 'hello'
    searchResults.value = [
      { session: { id: 's1', title: 'Result', started_at: '2025-01-01', last_active: new Date().toISOString() }, snippet: null },
    ]

    render(<SessionList />)
    fireEvent.click(screen.getByText('Clear'))
    expect(searchQuery.value).toBe('')
    expect(searchResults.value).toHaveLength(0)
  })

  it('should have export buttons on session items', () => {
    sessions.value = [
      { id: 's1', title: 'Export Me', started_at: '2025-01-01', last_active: new Date().toISOString() },
    ]

    render(<SessionList />)
    expect(screen.getByLabelText('Export JSON')).toBeTruthy()
    expect(screen.getByLabelText('Export Markdown')).toBeTruthy()
  })

  it('should trigger download on export JSON click', () => {
    sessions.value = [
      { id: 's1abcdef', title: 'Export', started_at: '2025-01-01', last_active: new Date().toISOString() },
    ]

    const { container } = render(<SessionList />)
    const btn = container.querySelector('[aria-label="Export JSON"]') as HTMLElement
    expect(() => { fireEvent.click(btn) }).not.toThrow()
  })

  it('should trigger download on export Markdown click', () => {
    sessions.value = [
      { id: 's1abcdef', title: 'Export', started_at: '2025-01-01', last_active: new Date().toISOString() },
    ]

    const { container } = render(<SessionList />)
    const btn = container.querySelector('[aria-label="Export Markdown"]') as HTMLElement
    expect(() => { fireEvent.click(btn) }).not.toThrow()
  })

  it('should call performSearch on input change', async () => {
    mockSearchSessions.mockResolvedValue({ results: [], total: 0 })

    render(<SessionList />)
    const input = screen.getByPlaceholderText('Search sessions…')
    fireEvent.input(input, { target: { value: 'hello' } })

    await new Promise((r) => { setTimeout(r, 10) })
    expect(mockSearchSessions).toHaveBeenCalledWith('hello')
  })
})
