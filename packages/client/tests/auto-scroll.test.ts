import { describe, it, expect } from 'vitest'
import { isNearBottom, scrollToBottom } from '../src/lib/auto-scroll.js'

function mockElement(scrollHeight: number, scrollTop: number, clientHeight: number): Element {
  return { scrollHeight, scrollTop, clientHeight } as unknown as Element
}

describe('isNearBottom', () => {
  it('returns true when scrolled to exact bottom', () => {
    const el = mockElement(1000, 600, 400)
    expect(isNearBottom(el)).toBe(true)
  })

  it('returns true when within default threshold (64px)', () => {
    const el = mockElement(1000, 550, 400)
    expect(isNearBottom(el)).toBe(true)
  })

  it('returns true when distance equals threshold exactly', () => {
    const el = mockElement(1000, 536, 400)
    expect(isNearBottom(el)).toBe(true)
  })

  it('returns false when beyond threshold', () => {
    const el = mockElement(1000, 535, 400)
    expect(isNearBottom(el)).toBe(false)
  })

  it('respects custom threshold', () => {
    const el = mockElement(1000, 500, 400)
    expect(isNearBottom(el, 100)).toBe(true)
    expect(isNearBottom(el, 99)).toBe(false)
  })

  it('returns true when content fits without scrolling', () => {
    const el = mockElement(400, 0, 400)
    expect(isNearBottom(el)).toBe(true)
  })
})

describe('scrollToBottom', () => {
  it('sets scrollTop to scrollHeight - clientHeight', () => {
    const el = mockElement(1000, 0, 400)
    scrollToBottom(el)
    expect(el.scrollTop).toBe(600)
  })

  it('handles already-at-bottom case', () => {
    const el = mockElement(1000, 600, 400)
    scrollToBottom(el)
    expect(el.scrollTop).toBe(600)
  })
})
