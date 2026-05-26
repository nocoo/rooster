/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/preact'
import { ReasoningBlock } from '../src/components/ReasoningBlock.js'

describe('ReasoningBlock', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render nothing when reasoning is empty and not streaming', () => {
    const { container } = render(<ReasoningBlock reasoning="" done={false} />)
    expect(container.querySelector('.reasoning-block')).toBeNull()
  })

  it('should render nothing when reasoning is empty and done', () => {
    const { container } = render(<ReasoningBlock reasoning="" done={true} />)
    expect(container.querySelector('.reasoning-block')).toBeNull()
  })

  it('should render with "Thinking…" label when streaming and not done', () => {
    render(<ReasoningBlock reasoning="step 1..." done={false} streaming={true} />)
    expect(screen.getByText('Thinking…')).toBeTruthy()
  })

  it('should render with "Reasoning" label when done', () => {
    render(<ReasoningBlock reasoning="final thought" done={true} />)
    expect(screen.getByText('Reasoning')).toBeTruthy()
  })

  it('should be open when streaming and not done', () => {
    const { container } = render(<ReasoningBlock reasoning="thinking..." done={false} streaming={true} />)
    const details = container.querySelector('details')
    expect(details?.open).toBe(true)
  })

  it('should be closed (collapsed) when done and not streaming', () => {
    const { container } = render(<ReasoningBlock reasoning="thought complete" done={true} streaming={false} />)
    const details = container.querySelector('details')
    expect(details?.open).toBe(false)
  })

  it('should display reasoning text content', () => {
    render(<ReasoningBlock reasoning="Let me think about this" done={true} />)
    expect(screen.getByText('Let me think about this')).toBeTruthy()
  })

  it('should not render when streaming with empty reasoning', () => {
    const { container } = render(<ReasoningBlock reasoning="" done={false} streaming={true} />)
    expect(container.querySelector('.reasoning-block')).toBeNull()
  })
})
