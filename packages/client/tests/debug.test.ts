import { describe, it, expect, beforeEach } from 'vitest'
import { debugEnabled, debugEvents, toggleDebug, pushDebugEvent, clearDebugEvents } from '../src/state/debug.js'

describe('debug state', () => {
  beforeEach(() => {
    debugEnabled.value = false
    debugEvents.value = []
  })

  it('should default to disabled', () => {
    expect(debugEnabled.value).toBe(false)
  })

  it('should toggle debug mode', () => {
    toggleDebug()
    expect(debugEnabled.value).toBe(true)
    toggleDebug()
    expect(debugEnabled.value).toBe(false)
  })

  it('should always collect events regardless of toggle state', () => {
    pushDebugEvent('test.event', { foo: 'bar' })
    expect(debugEvents.value).toHaveLength(1)
    expect(debugEvents.value[0]?.event).toBe('test.event')
  })

  it('should push events with correct payload', () => {
    pushDebugEvent('test.event', { foo: 'bar' })
    expect(debugEvents.value[0]?.payload).toEqual({ foo: 'bar' })
  })

  it('should clear events', () => {
    pushDebugEvent('a', {})
    pushDebugEvent('b', {})
    expect(debugEvents.value).toHaveLength(2)
    clearDebugEvents()
    expect(debugEvents.value).toHaveLength(0)
  })
})
