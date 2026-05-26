/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/preact'
import { BridgeStatus } from '../src/components/BridgeStatus.js'
import { bridgeStatus } from '../src/state/health.js'

vi.mock('../src/api/health.js', () => ({
  fetchHealth: vi.fn().mockResolvedValue({ status: 'ok', timestamp: '', bridge: 'connected' }),
}))

describe('BridgeStatus', () => {
  beforeEach(() => {
    bridgeStatus.value = 'unknown'
  })

  afterEach(() => {
    cleanup()
  })

  it('should show Checking when unknown', () => {
    render(<BridgeStatus />)
    expect(screen.getByText('Checking…')).toBeTruthy()
  })

  it('should show Connected when connected', () => {
    bridgeStatus.value = 'connected'
    render(<BridgeStatus />)
    expect(screen.getByText('Connected')).toBeTruthy()
  })

  it('should show Disconnected when unreachable', () => {
    bridgeStatus.value = 'unreachable'
    render(<BridgeStatus />)
    expect(screen.getByText('Disconnected')).toBeTruthy()
  })

  it('should have appropriate aria-label', () => {
    bridgeStatus.value = 'connected'
    render(<BridgeStatus />)
    expect(screen.getByLabelText('Bridge status: Connected')).toBeTruthy()
  })
})
