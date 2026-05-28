type ChecklistItem = {
  id: string
  label: string
  detail: string
}

const WIRING_CHECKLIST: ReadonlyArray<ChecklistItem> = [
  {
    id: 'bridge-action',
    label: 'bridge IPC list_memory action',
    detail: 'Hermes agent bridge must expose a list_memory IPC action that returns memory entry metadata.',
  },
  {
    id: 'server-route',
    label: 'GET /api/hermes/memory',
    detail: 'Server route that proxies the bridge action and shapes the response for the client.',
  },
  {
    id: 'client-api',
    label: 'client fetchMemory() helper',
    detail: 'packages/client/src/api module that calls the server route and types the response.',
  },
  {
    id: 'page-states',
    label: 'Memory list / search / detail states',
    detail: 'Wire this page to fetchMemory() with loading / error / empty / list / search / detail UI.',
  },
]

export function AdminMemoryPage() {
  return (
    <div class="admin-memory">
      <h1 class="admin-page-title">Memory</h1>
      <div class="admin-profiles-banner" role="note">
        <strong>Protocol not ready.</strong>{' '}
        Rooster does not yet have a bridge memory IPC action or a server route for memory,
        so this page intentionally does not list, search, preview, or delete any memory
        entry. It only shows what still needs to be wired up before a real read-only
        Memory view can ship.
      </div>

      <section class="admin-memory-checklist">
        <h2 class="admin-section-title">Wiring checklist</h2>
        <ol class="admin-checklist">
          {WIRING_CHECKLIST.map((item) => (
            <li key={item.id} class="admin-checklist-item">
              <div class="admin-checklist-label"><strong>{item.label}</strong></div>
              <div class="admin-checklist-detail color-fg-muted">{item.detail}</div>
            </li>
          ))}
        </ol>
        <p class="admin-memory-delete-note color-fg-muted" role="note">
          <strong>Delete is deferred.</strong>{' '}
          DELETE /api/hermes/memory/:id and any delete controls must wait for a separate
          security review, an explicit confirmation UX, and copy that makes the
          irreversibility and audit trail clear. Delete is intentionally not part of the
          read-only-first checklist above.
        </p>
      </section>
    </div>
  )
}
