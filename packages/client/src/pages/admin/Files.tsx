type ChecklistItem = {
  id: string
  label: string
  detail: string
}

const WIRING_CHECKLIST: ReadonlyArray<ChecklistItem> = [
  {
    id: 'bridge-action',
    label: 'bridge IPC list_files / read_file actions',
    detail: 'Hermes agent bridge must expose list_files / read_file IPC actions that operate on configured allowlisted roots and return file metadata.',
  },
  {
    id: 'server-route',
    label: 'GET /api/hermes/files with allowlisted root + traversal hardening',
    detail: 'Server route that proxies the bridge action. It must never accept client absolute paths; every path arrives relative to a configured allowlisted root and is resolved + checked for root containment before any disk access.',
  },
  {
    id: 'client-api',
    label: 'client fetchFiles() helper',
    detail: 'packages/client/src/api module that calls the server route and types the response.',
  },
  {
    id: 'page-states',
    label: 'Files list / preview / detail states',
    detail: 'Wire this page to fetchFiles() with loading / error / empty / list / preview / detail UI, all sourced from allowlisted roots.',
  },
]

export function AdminFilesPage() {
  return (
    <div class="admin-files">
      <h1 class="admin-page-title">Files</h1>
      <div class="admin-profiles-banner" role="note">
        <strong>Protocol not ready.</strong>{' '}
        Rooster does not yet have a general filesystem browse bridge IPC action or a
        server route for files, so this page intentionally does not list, read, preview,
        download, or delete any file. It only shows what still needs to be wired up
        before a real read-only Files view can ship.
      </div>

      <section class="admin-files-checklist">
        <h2 class="admin-section-title">Wiring checklist</h2>
        <ol class="admin-checklist">
          {WIRING_CHECKLIST.map((item) => (
            <li key={item.id} class="admin-checklist-item">
              <div class="admin-checklist-label"><strong>{item.label}</strong></div>
              <div class="admin-checklist-detail color-fg-muted">{item.detail}</div>
            </li>
          ))}
        </ol>
        <p class="admin-files-security-note color-fg-muted" role="note">
          <strong>Security boundary.</strong>{' '}
          When the bridge and server routes land, the server must never accept client
          absolute paths. All paths arrive relative to a configured allowlisted root.
          The server normalizes and resolves every incoming path, then enforces strict
          root containment, rejecting <code>..</code> escapes, symlink escape, and
          absolute paths. Following symlinks out of the allowlisted root is disallowed.
          The first protocol version is read-only first: list and read metadata only.
          Any write, rename, or delete capability requires a separate security review,
          explicit confirmation UX, and audit trail copy before any UI control ships.
        </p>
        <p class="admin-files-scope-note color-fg-muted" role="note">
          Session upload attachments already have <code>POST /api/upload</code> and
          <code>GET /api/upload/:id</code> plumbing, but global attachment listing is not
          the same product surface as filesystem browsing and is intentionally out of
          scope here.
        </p>
      </section>
    </div>
  )
}
