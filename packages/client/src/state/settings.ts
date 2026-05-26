import { signal } from '@preact/signals'
import { fetchProfiles, fetchModels, fetchProviders } from '../api/settings.js'

export const profiles = signal<string[]>([])
export const models = signal<string[]>([])
export const providers = signal<string[]>([])
export const selectedProfile = signal<string | null>(null)
export const selectedModel = signal<string | null>(null)
export const selectedProvider = signal<string | null>(null)

export async function loadSettings(): Promise<void> {
  const [p, m, prov] = await Promise.all([
    fetchProfiles().catch(() => []),
    fetchModels().catch(() => []),
    fetchProviders().catch(() => []),
  ])
  profiles.value = p
  models.value = m
  providers.value = prov
}
