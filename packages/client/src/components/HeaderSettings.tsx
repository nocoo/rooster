import { profiles, models, selectedProfile, selectedModel } from '../state/settings.js'

export function HeaderSettings() {
  const profileList = profiles.value
  const modelList = models.value

  return (
    <div class="d-flex gap-2 flex-items-center">
      {profileList.length > 0 && (
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
      )}
      {modelList.length > 0 && (
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
      )}
    </div>
  )
}
