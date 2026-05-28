type ChecklistItem = {
  id: string
  label: string
  detail: string
}

const WIRING_CHECKLIST: ReadonlyArray<ChecklistItem> = [
  {
    id: 'bridge-action',
    label: 'bridge IPC list_logs / tail_logs actions',
    detail: 'Hermes agent bridge must expose list_logs / tail_logs IPC actions that read from a persisted log source, subject to retention and redaction policy.',
  },
  {
    id: 'server-route',
    label: 'GET /api/hermes/logs with pagination + filters + server-side redaction',
    detail: 'Server route that proxies the bridge action. It must paginate, support level/time/source filters, and apply server-side redaction so secrets, API keys, tokens, session content, user messages, attachment paths, and other PII never leave the server unredacted.',
  },
  {
    id: 'client-api',
    label: 'client fetchLogs() helper',
    detail: 'packages/client/src/api module that calls the server route and types the response.',
  },
  {
    id: 'page-states',
    label: 'Logs list / detail states',
    detail: 'Wire this page to fetchLogs() with loading / error / empty / list / detail UI sourced from the redacted server response.',
  },
]

export function AdminLogsPage() {
  return (
    <div class="admin-logs">
      <h1 class="admin-page-title">Logs</h1>
      <div class="admin-profiles-banner" role="note">
        <strong>Protocol not ready.</strong>{' '}
        Rooster currently writes operational logs to stdout / stderr via pino and has
        no persisted or retrievable log source, so this page intentionally does not
        list, search, tail, stream, export, or clear any log. It only shows what still
        needs to be wired up before a real read-only Logs view can ship.
      </div>

      <section class="admin-logs-checklist">
        <h2 class="admin-section-title">Wiring checklist</h2>
        <ol class="admin-checklist">
          {WIRING_CHECKLIST.map((item) => (
            <li key={item.id} class="admin-checklist-item">
              <div class="admin-checklist-label"><strong>{item.label}</strong></div>
              <div class="admin-checklist-detail color-fg-muted">{item.detail}</div>
            </li>
          ))}
        </ol>
        <p class="admin-logs-privacy-note color-fg-muted" role="note">
          <strong>Privacy and retention boundary.</strong>{' '}
          Operational logs frequently capture secrets, API keys, tokens, session and
          user message content, attachment paths, and other PII. Before any log surface
          can ship, the server must apply redaction on write or on read so that none of
          these values are returned to a client unredacted. A retention policy with
          explicit TTL and rotation rules must be defined so that logs do not accumulate
          indefinitely on disk. Every admin read against this surface must be recorded
          in an audit trail.
        </p>
        <p class="admin-logs-deferred-note color-fg-muted" role="note">
          <strong>Live-tail and export are deferred.</strong>{' '}
          A live-tail or streaming endpoint would let an admin observe user activity in
          real time, and an export endpoint would let an admin bulk-download log content
          off the host. Both capabilities require a separate security review,
          explicit confirmation UX, and audit copy that makes the privacy implications
          clear. They are intentionally not part of the read-only-first checklist above.
        </p>
      </section>
    </div>
  )
}
