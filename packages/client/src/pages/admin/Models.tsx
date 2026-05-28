import { useEffect, useState, useCallback } from 'preact/hooks'
import { fetchModels, fetchProviders } from '../../api/settings.js'
import { selectedModel, selectedProvider } from '../../state/settings.js'

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'ready', data: T }
  | { status: 'error', error: string }

function useLoad<T>(fetcher: () => Promise<T>): [LoadState<T>, () => void] {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const data = await fetcher()
      setState({ status: 'ready', data })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setState({ status: 'error', error: message })
    }
  }, [fetcher])

  useEffect(() => { void load() }, [load])

  return [state, () => { void load() }]
}

export function AdminModelsPage() {
  const [modelsState, retryModels] = useLoad(fetchModels)
  const [providersState, retryProviders] = useLoad(fetchProviders)

  const activeModel = selectedModel.value
  const activeProvider = selectedProvider.value

  return (
    <div class="admin-models">
      <h1 class="admin-page-title">Models &amp; providers</h1>
      <div class="admin-profiles-banner" role="note">
        <strong>Read-only preview.</strong>{' '}
        Models and providers shown here come from the bridge session fallback. Marking
        a model or provider enabled, persisting a default, editing entries, or managing
        secret fields requires a dedicated bridge config protocol that has not landed yet.
      </div>

      <section class="admin-models-active">
        <h2 class="admin-section-title">Currently active in chat</h2>
        <p>
          Model:{' '}
          {activeModel === null
            ? <span class="color-fg-muted">(unset)</span>
            : <strong>{activeModel}</strong>}
        </p>
        <p>
          Provider:{' '}
          {activeProvider === null
            ? <span class="color-fg-muted">(unset)</span>
            : <strong>{activeProvider}</strong>}
        </p>
      </section>

      <section class="admin-models-list" data-testid="admin-models-section">
        <h2 class="admin-section-title">Models discovered from bridge sessions</h2>
        {modelsState.status === 'loading' && (
          <p class="color-fg-muted" role="status">Loading models…</p>
        )}
        {modelsState.status === 'error' && (
          <div class="admin-profiles-error" role="alert">
            <p>Failed to load models: {modelsState.error}</p>
            <button type="button" class="btn btn-sm" onClick={retryModels}>
              Retry models
            </button>
          </div>
        )}
        {modelsState.status === 'ready' && modelsState.data.length === 0 && (
          <p class="color-fg-muted">No models discovered yet.</p>
        )}
        {modelsState.status === 'ready' && modelsState.data.length > 0 && (
          <table class="admin-table">
            <thead>
              <tr>
                <th scope="col">Model name</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {modelsState.data.map((name) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td class="color-fg-muted">
                    {name === activeModel ? 'Active in chat' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section class="admin-providers-list" data-testid="admin-providers-section">
        <h2 class="admin-section-title">Providers discovered from bridge sessions</h2>
        {providersState.status === 'loading' && (
          <p class="color-fg-muted" role="status">Loading providers…</p>
        )}
        {providersState.status === 'error' && (
          <div class="admin-profiles-error" role="alert">
            <p>Failed to load providers: {providersState.error}</p>
            <button type="button" class="btn btn-sm" onClick={retryProviders}>
              Retry providers
            </button>
          </div>
        )}
        {providersState.status === 'ready' && providersState.data.length === 0 && (
          <p class="color-fg-muted">No providers discovered yet.</p>
        )}
        {providersState.status === 'ready' && providersState.data.length > 0 && (
          <table class="admin-table">
            <thead>
              <tr>
                <th scope="col">Provider name</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {providersState.data.map((name) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td class="color-fg-muted">
                    {name === activeProvider ? 'Active in chat' : '—'}
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
