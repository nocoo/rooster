import { describe, it, expect, beforeEach, vi } from 'vitest'
import { profiles, models, selectedProfile, selectedModel, loadSettings } from '../src/state/settings.js'

const mockFetchProfiles = vi.fn()
const mockFetchModels = vi.fn()

vi.mock('../src/api/settings.js', () => ({
  fetchProfiles: (...args: unknown[]) => mockFetchProfiles(...args) as unknown,
  fetchModels: (...args: unknown[]) => mockFetchModels(...args) as unknown,
  fetchProviders: vi.fn().mockResolvedValue([]),
}))

describe('state/settings', () => {
  beforeEach(() => {
    profiles.value = []
    models.value = []
    selectedProfile.value = null
    selectedModel.value = null
    mockFetchProfiles.mockReset()
    mockFetchModels.mockReset()
  })

  it('should load profiles and models', async () => {
    mockFetchProfiles.mockResolvedValue(['default', 'fast'])
    mockFetchModels.mockResolvedValue(['claude-3', 'gpt-4'])

    await loadSettings()

    expect(profiles.value).toEqual(['default', 'fast'])
    expect(models.value).toEqual(['claude-3', 'gpt-4'])
  })

  it('should handle fetch errors gracefully', async () => {
    mockFetchProfiles.mockRejectedValue(new Error('fail'))
    mockFetchModels.mockRejectedValue(new Error('fail'))

    await loadSettings()

    expect(profiles.value).toEqual([])
    expect(models.value).toEqual([])
  })

  it('should default selections to null', () => {
    expect(selectedProfile.value).toBeNull()
    expect(selectedModel.value).toBeNull()
  })
})
