import { profiles, models, providers, selectedProfile, selectedModel, selectedProvider } from '../state/settings.js'

export function HeaderSettings() {
  const profileList = profiles.value
  const modelList = models.value
  const providerList = providers.value

  return (
    <div class="header-settings">
      <select
        class="form-select form-select-sm"
        aria-label="Profile"
        value={selectedProfile.value ?? ''}
        onChange={(e) => {
          const v = (e.target as HTMLSelectElement).value
          selectedProfile.value = v || null
        }}
      >
        <option value="">Default profile</option>
        {profileList.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <select
        class="form-select form-select-sm"
        aria-label="Model"
        value={selectedModel.value ?? ''}
        onChange={(e) => {
          const v = (e.target as HTMLSelectElement).value
          selectedModel.value = v || null
        }}
      >
        <option value="">Default model</option>
        {modelList.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select
        class="form-select form-select-sm"
        aria-label="Provider"
        value={selectedProvider.value ?? ''}
        onChange={(e) => {
          const v = (e.target as HTMLSelectElement).value
          selectedProvider.value = v || null
        }}
      >
        <option value="">Default provider</option>
        {providerList.map((prov) => (
          <option key={prov} value={prov}>{prov}</option>
        ))}
      </select>
    </div>
  )
}
