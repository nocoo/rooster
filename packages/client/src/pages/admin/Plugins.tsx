type ChecklistItem = {
  id: string
  label: string
  detail: string
}

const WIRING_CHECKLIST: ReadonlyArray<ChecklistItem> = [
  {
    id: 'bridge-action',
    label: 'bridge IPC list_plugins action',
    detail: 'Hermes agent bridge must expose a list_plugins IPC action that returns plugin manifest metadata.',
  },
  {
    id: 'server-route',
    label: 'GET /api/hermes/plugins',
    detail: 'Server route that proxies the bridge action and shapes the response for the client.',
  },
  {
    id: 'client-api',
    label: 'client fetchPlugins() helper',
    detail: 'packages/client/src/api module that calls the server route and types the response.',
  },
  {
    id: 'page-states',
    label: 'Plugins table / manifest detail states',
    detail: 'Wire this page to fetchPlugins() with loading / error / empty / list / manifest detail UI. Install / remove are deferred to a later phase and require a separate security review.',
  },
]

export function AdminPluginsPage() {
  return (
    <div class="admin-plugins">
      <h1 class="admin-page-title">Plugins</h1>
      <div class="admin-profiles-banner" role="note">
        <strong>Protocol not ready.</strong>{' '}
        Rooster does not yet have a bridge plugins IPC action or a server route for plugins,
        so this page intentionally does not list, install, or remove any plugin. It only
        shows what still needs to be wired up before a real read-only Plugins view can ship.
      </div>

      <section class="admin-plugins-checklist">
        <h2 class="admin-section-title">Wiring checklist</h2>
        <ol class="admin-checklist">
          {WIRING_CHECKLIST.map((item) => (
            <li key={item.id} class="admin-checklist-item">
              <div class="admin-checklist-label"><strong>{item.label}</strong></div>
              <div class="admin-checklist-detail color-fg-muted">{item.detail}</div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
