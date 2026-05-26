import { describe, it, expect, vi } from 'vitest'
import { fetchProfiles, fetchModels, fetchProviders } from '../src/api/settings.js'

const mockGet = vi.fn()

vi.mock('../src/api/client.js', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args) as unknown,
  },
}))

describe('api/settings', () => {
  it('fetchProfiles should call correct endpoint', async () => {
    mockGet.mockResolvedValue({ profiles: ['a', 'b'] })
    const result = await fetchProfiles()
    expect(mockGet).toHaveBeenCalledWith('/api/hermes/profiles')
    expect(result).toEqual(['a', 'b'])
  })

  it('fetchModels should call correct endpoint', async () => {
    mockGet.mockResolvedValue({ models: ['m1'] })
    const result = await fetchModels()
    expect(mockGet).toHaveBeenCalledWith('/api/hermes/models')
    expect(result).toEqual(['m1'])
  })

  it('fetchProviders should call correct endpoint', async () => {
    mockGet.mockResolvedValue({ providers: ['openai'] })
    const result = await fetchProviders()
    expect(mockGet).toHaveBeenCalledWith('/api/hermes/providers')
    expect(result).toEqual(['openai'])
  })
})
