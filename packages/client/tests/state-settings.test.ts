import { describe, it, expect, beforeEach, vi } from 'vitest'
import { profiles, models, providers, selectedProfile, selectedModel, selectedProvider, loadSettings } from '../src/state/settings.js'

const mockFetchProfiles = vi.fn()
const mockFetchModels = vi.fn()
const mockFetchProviders = vi.fn()

vi.mock('../src/api/settings.js', () => ({
  fetchProfiles: (...args: unknown[]) => mockFetchProfiles(...args) as unknown,
  fetchModels: (...args: unknown[]) => mockFetchModels(...args) as unknown,
  fetchProviders: (...args: unknown[]) => mockFetchProviders(...args) as unknown,
}))

describe('state/settings', () => {
  beforeEach(() => {
    profiles.value = []
    models.value = []
    providers.value = []
    selectedProfile.value = null
    selectedModel.value = null
    selectedProvider.value = null
    mockFetchProfiles.mockReset()
    mockFetchModels.mockReset()
    mockFetchProviders.mockReset()
  })

  it('should load profiles, models, and providers', async () => {
    mockFetchProfiles.mockResolvedValue(['default', 'fast'])
    mockFetchModels.mockResolvedValue(['claude-3', 'gpt-4'])
    mockFetchProviders.mockResolvedValue(['anthropic', 'openai'])

    await loadSettings()

    expect(profiles.value).toEqual(['default', 'fast'])
    expect(models.value).toEqual(['claude-3', 'gpt-4'])
    expect(providers.value).toEqual(['anthropic', 'openai'])
  })

  it('should handle fetch errors gracefully', async () => {
    mockFetchProfiles.mockRejectedValue(new Error('fail'))
    mockFetchModels.mockRejectedValue(new Error('fail'))
    mockFetchProviders.mockRejectedValue(new Error('fail'))

    await loadSettings()

    expect(profiles.value).toEqual([])
    expect(models.value).toEqual([])
    expect(providers.value).toEqual([])
  })

  it('should default selections to null', () => {
    expect(selectedProfile.value).toBeNull()
    expect(selectedModel.value).toBeNull()
    expect(selectedProvider.value).toBeNull()
  })
})
