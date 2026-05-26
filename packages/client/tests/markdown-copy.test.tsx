/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/preact'
import { Markdown } from '../src/components/Markdown.js'

vi.mock('../src/api/sessions.js', () => ({
  fetchSessions: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
  fetchMessages: vi.fn().mockResolvedValue({ messages: [] }),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  renameSession: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/ws/chat.js', () => ({
  connect: vi.fn(),
  setHandlers: vi.fn(),
  sendRun: vi.fn(),
  sendAbort: vi.fn(),
}))

describe('Markdown — copy button', () => {
  let writeTextMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('should copy code content on button click', async () => {
    const { container } = render(<Markdown content={'```js\nconst x = 1\n```'} />)
    const copyBtn = container.querySelector('.code-block-copy') as HTMLButtonElement
    expect(copyBtn).toBeTruthy()

    fireEvent.click(copyBtn)
    await vi.waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('const x = 1\n')
    })
  })

  it('should show Copied! feedback on success', async () => {
    const { container } = render(<Markdown content={'```\nhello\n```'} />)
    const copyBtn = container.querySelector('.code-block-copy') as HTMLButtonElement

    fireEvent.click(copyBtn)
    await vi.waitFor(() => {
      expect(copyBtn.textContent).toBe('Copied!')
    })
  })

  it('should show Failed feedback on clipboard error', async () => {
    writeTextMock.mockRejectedValue(new Error('Permission denied'))
    const { container } = render(<Markdown content={'```\ncode\n```'} />)
    const copyBtn = container.querySelector('.code-block-copy') as HTMLButtonElement

    fireEvent.click(copyBtn)
    await vi.waitFor(() => {
      expect(copyBtn.textContent).toBe('Failed')
    })
  })

  it('should revert button text after timeout', async () => {
    vi.useFakeTimers()
    const { container } = render(<Markdown content={'```\ncode\n```'} />)
    const copyBtn = container.querySelector('.code-block-copy') as HTMLButtonElement

    fireEvent.click(copyBtn)
    await vi.waitFor(() => {
      expect(copyBtn.textContent).toBe('Copied!')
    })

    vi.advanceTimersByTime(1500)
    expect(copyBtn.textContent).toBe('Copy')
    vi.useRealTimers()
  })

  it('should not crash when clicking non-copy elements', () => {
    const { container } = render(<Markdown content={'```js\ncode\n```'} />)
    const pre = container.querySelector('pre') as HTMLElement
    expect(pre).toBeTruthy()
    fireEvent.click(pre)
    expect(writeTextMock).not.toHaveBeenCalled()
  })

  it('should handle copy button without code element gracefully', () => {
    const { container } = render(<Markdown content={'```js\ncode\n```'} />)
    const wrapper = container.querySelector('.code-block-wrapper') as HTMLElement
    const codeEl = wrapper.querySelector('code')
    if (codeEl) codeEl.remove()
    const copyBtn = wrapper.querySelector('.code-block-copy') as HTMLButtonElement
    fireEvent.click(copyBtn)
    expect(writeTextMock).not.toHaveBeenCalled()
  })

  it('should render content without code blocks (no copy button)', () => {
    const { container } = render(<Markdown content={'just text'} />)
    expect(container.querySelector('.code-block-copy')).toBeNull()
    expect(container.textContent).toContain('just text')
  })

  it('should copy empty string when code element has no text', async () => {
    const { container } = render(<Markdown content={'```\n\n```'} />)
    const copyBtn = container.querySelector('.code-block-copy') as HTMLButtonElement
    expect(copyBtn).toBeTruthy()

    const codeEl = container.querySelector('code') as HTMLElement
    Object.defineProperty(codeEl, 'textContent', { value: '', configurable: true })

    fireEvent.click(copyBtn)
    await vi.waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('')
    })
  })

  it('should show Failed when navigator.clipboard is unavailable', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    })
    const { container } = render(<Markdown content={'```\ncode\n```'} />)
    const copyBtn = container.querySelector('.code-block-copy') as HTMLButtonElement
    fireEvent.click(copyBtn)
    expect(copyBtn.textContent).toBe('Failed')
  })

  it('should show Failed when clipboard.writeText is not a function', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: 'not-a-function' },
      writable: true,
      configurable: true,
    })
    const { container } = render(<Markdown content={'```\ncode\n```'} />)
    const copyBtn = container.querySelector('.code-block-copy') as HTMLButtonElement
    fireEvent.click(copyBtn)
    expect(copyBtn.textContent).toBe('Failed')
  })
})
