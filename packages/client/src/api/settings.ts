import { api } from './client.js'

interface ProfilesResponse { profiles: string[] }
interface ModelsResponse { models: string[] }
interface ProvidersResponse { providers: string[] }

export async function fetchProfiles(): Promise<string[]> {
  const res = await api.get<ProfilesResponse>('/api/hermes/profiles')
  return res.profiles
}

export async function fetchModels(): Promise<string[]> {
  const res = await api.get<ModelsResponse>('/api/hermes/models')
  return res.models
}

export async function fetchProviders(): Promise<string[]> {
  const res = await api.get<ProvidersResponse>('/api/hermes/providers')
  return res.providers
}
