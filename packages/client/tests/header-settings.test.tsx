/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/preact'
import { HeaderSettings } from '../src/components/HeaderSettings.js'
import { profiles, models, providers, selectedProfile, selectedModel, selectedProvider } from '../src/state/settings.js'

vi.mock('../src/api/settings.js', () => ({
  fetchProfiles: vi.fn().mockResolvedValue([]),
  fetchModels: vi.fn().mockResolvedValue([]),
  fetchProviders: vi.fn().mockResolvedValue([]),
}))

describe('HeaderSettings', () => {
  beforeEach(() => {
    profiles.value = []
    models.value = []
    providers.value = []
    selectedProfile.value = null
    selectedModel.value = null
    selectedProvider.value = null
  })

  afterEach(() => {
    cleanup()
  })

  it('should render selectors with only default options when lists are empty', () => {
    render(<HeaderSettings />)
    expect(screen.getByLabelText('Profile')).toBeTruthy()
    expect(screen.getByLabelText('Model')).toBeTruthy()
    expect(screen.getByLabelText('Provider')).toBeTruthy()
    expect(screen.getByText('Default profile')).toBeTruthy()
    expect(screen.getByText('Default model')).toBeTruthy()
    expect(screen.getByText('Default provider')).toBeTruthy()
  })

  it('should render profile selector when profiles available', () => {
    profiles.value = ['default', 'fast']
    render(<HeaderSettings />)
    expect(screen.getByLabelText('Profile')).toBeTruthy()
    expect(screen.getByText('default')).toBeTruthy()
    expect(screen.getByText('fast')).toBeTruthy()
  })

  it('should render model selector when models available', () => {
    models.value = ['claude-3', 'gpt-4']
    render(<HeaderSettings />)
    expect(screen.getByLabelText('Model')).toBeTruthy()
    expect(screen.getByText('claude-3')).toBeTruthy()
    expect(screen.getByText('gpt-4')).toBeTruthy()
  })

  it('should render provider selector when providers available', () => {
    providers.value = ['anthropic', 'openai']
    render(<HeaderSettings />)
    expect(screen.getByLabelText('Provider')).toBeTruthy()
    expect(screen.getByText('anthropic')).toBeTruthy()
    expect(screen.getByText('openai')).toBeTruthy()
  })

  it('should update selectedProfile on change', () => {
    profiles.value = ['default', 'fast']
    render(<HeaderSettings />)
    const select = screen.getByLabelText('Profile')
    fireEvent.change(select, { target: { value: 'fast' } })
    expect(selectedProfile.value).toBe('fast')
  })

  it('should set selectedProfile to null when default selected', () => {
    profiles.value = ['default']
    selectedProfile.value = 'default'
    render(<HeaderSettings />)
    const select = screen.getByLabelText('Profile')
    fireEvent.change(select, { target: { value: '' } })
    expect(selectedProfile.value).toBeNull()
  })

  it('should update selectedModel on change', () => {
    models.value = ['claude-3', 'gpt-4']
    render(<HeaderSettings />)
    const select = screen.getByLabelText('Model')
    fireEvent.change(select, { target: { value: 'gpt-4' } })
    expect(selectedModel.value).toBe('gpt-4')
  })

  it('should set selectedModel to null when default selected', () => {
    models.value = ['claude-3']
    selectedModel.value = 'claude-3'
    render(<HeaderSettings />)
    const select = screen.getByLabelText('Model')
    fireEvent.change(select, { target: { value: '' } })
    expect(selectedModel.value).toBeNull()
  })

  it('should update selectedProvider on change', () => {
    providers.value = ['anthropic', 'openai']
    render(<HeaderSettings />)
    const select = screen.getByLabelText('Provider')
    fireEvent.change(select, { target: { value: 'openai' } })
    expect(selectedProvider.value).toBe('openai')
  })

  it('should set selectedProvider to null when default selected', () => {
    providers.value = ['anthropic']
    selectedProvider.value = 'anthropic'
    render(<HeaderSettings />)
    const select = screen.getByLabelText('Provider')
    fireEvent.change(select, { target: { value: '' } })
    expect(selectedProvider.value).toBeNull()
  })
})
