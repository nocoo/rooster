import { useEffect, useState, useCallback } from 'preact/hooks'
import { fetchProfiles } from '../../api/settings.js'
import { selectedProfile } from '../../state/settings.js'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready', profiles: string[] }
  | { status: 'error', error: string }

export function AdminProfilesPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const profiles = await fetchProfiles()
      setState({ status: 'ready', profiles })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setState({ status: 'error', error: message })
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const active = selectedProfile.value

  return (
    <div class="admin-profiles">
      <h1 class="admin-page-title">Profiles</h1>
      <div class="admin-profiles-banner" role="note">
        <strong>Read-only preview.</strong>{' '}
        Profiles are discovered from existing bridge sessions. Create / edit / delete
        requires a dedicated bridge profile protocol that has not landed yet.
      </div>

      <section class="admin-profiles-active">
        <h2 class="admin-section-title">Currently active in chat</h2>
        {active === null
          ? <p class="color-fg-muted">Default profile (unset)</p>
          : <p>Currently active: <strong>{active}</strong></p>}
      </section>

      <section class="admin-profiles-list">
        <h2 class="admin-section-title">Profiles discovered from bridge sessions</h2>
        {state.status === 'loading' && (
          <p class="color-fg-muted" role="status">Loading profiles…</p>
        )}
        {state.status === 'error' && (
          <div class="admin-profiles-error" role="alert">
            <p>Failed to load profiles: {state.error}</p>
            <button type="button" class="btn btn-sm" onClick={() => { void load() }}>
              Retry
            </button>
          </div>
        )}
        {state.status === 'ready' && state.profiles.length === 0 && (
          <p class="color-fg-muted">No profiles discovered yet.</p>
        )}
        {state.status === 'ready' && state.profiles.length > 0 && (
          <table class="admin-table">
            <thead>
              <tr>
                <th scope="col">Profile name</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {state.profiles.map((name) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td class="color-fg-muted">
                    {name === active ? 'Active in chat' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
