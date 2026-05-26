import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { bridgeStatus, checkHealth, startHealthPolling, stopHealthPolling } from '../src/state/health.js'

vi.mock('../src/api/health.js', () => ({
  fetchHealth: vi.fn(),
}))

import { fetchHealth } from '../src/api/health.js'

const mockFetchHealth = vi.mocked(fetchHealth)

describe('state/health', () => {
  beforeEach(() => {
    bridgeStatus.value = 'unknown'
    stopHealthPolling()
    mockFetchHealth.mockClear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    stopHealthPolling()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should set bridgeStatus to connected on success', async () => {
    mockFetchHealth.mockResolvedValue({ status: 'ok', timestamp: '', bridge: 'connected' })
    await checkHealth()
    expect(bridgeStatus.value).toBe('connected')
  })

  it('should set bridgeStatus to unreachable on fetch error', async () => {
    mockFetchHealth.mockRejectedValue(new Error('network'))
    await checkHealth()
    expect(bridgeStatus.value).toBe('unreachable')
  })

  it('should set bridgeStatus to unreachable when bridge reports unreachable', async () => {
    mockFetchHealth.mockResolvedValue({ status: 'degraded', timestamp: '', bridge: 'unreachable' })
    await checkHealth()
    expect(bridgeStatus.value).toBe('unreachable')
  })

  it('should poll periodically after startHealthPolling', async () => {
    mockFetchHealth.mockResolvedValue({ status: 'ok', timestamp: '', bridge: 'connected' })
    startHealthPolling()
    await vi.advanceTimersByTimeAsync(0)
    expect(mockFetchHealth).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(mockFetchHealth).toHaveBeenCalledTimes(2)
  })

  it('should not create duplicate timers on multiple startHealthPolling calls', async () => {
    mockFetchHealth.mockResolvedValue({ status: 'ok', timestamp: '', bridge: 'connected' })
    startHealthPolling()
    startHealthPolling()
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(mockFetchHealth).toHaveBeenCalledTimes(2)
  })

  it('should stop polling after stopHealthPolling', async () => {
    mockFetchHealth.mockResolvedValue({ status: 'ok', timestamp: '', bridge: 'connected' })
    startHealthPolling()
    await vi.advanceTimersByTimeAsync(0)
    stopHealthPolling()

    await vi.advanceTimersByTimeAsync(30_000)
    expect(mockFetchHealth).toHaveBeenCalledTimes(1)
  })

  it('should allow restart after stop', async () => {
    mockFetchHealth.mockResolvedValue({ status: 'ok', timestamp: '', bridge: 'connected' })
    startHealthPolling()
    await vi.advanceTimersByTimeAsync(0)
    stopHealthPolling()

    startHealthPolling()
    await vi.advanceTimersByTimeAsync(0)
    expect(mockFetchHealth).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(mockFetchHealth).toHaveBeenCalledTimes(3)
  })
})
