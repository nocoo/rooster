type ChecklistItem = {
  id: string
  label: string
  detail: string
}

const WIRING_CHECKLIST: ReadonlyArray<ChecklistItem> = [
  {
    id: 'bridge-action',
    label: 'bridge IPC get_config action with bridge-side secret redaction',
    detail: 'Hermes agent bridge must expose a read-only get_config action that returns the requested config sections, with secrets and credentials redacted at the bridge boundary before they cross into the rooster process.',
  },
  {
    id: 'server-route',
    label: 'GET /api/hermes/config?sections=... with server-side redaction',
    detail: 'Server route that proxies the bridge action. It must apply a server-side redaction layer so that platform credentials, tokens, API keys, cookies, qrcode payloads, and any other secret material are never returned to a client unredacted, even if the bridge response accidentally regresses.',
  },
  {
    id: 'client-api',
    label: 'client fetchConfig() read helper',
    detail: 'packages/client/src/api module that calls the server route and types the redacted response. Read-only: no updateConfig, no saveCredentials.',
  },
  {
    id: 'page-states',
    label: 'Settings list / detail states (read-only)',
    detail: 'Wire this page to fetchConfig() with loading / error / empty / list / detail UI showing the current redacted values per section. No form controls, no save, no apply.',
  },
]

export function AdminSettingsPage() {
  return (
    <div class="admin-settings">
      <h1 class="admin-page-title">Settings</h1>
      <div class="admin-profiles-banner" role="note">
        <strong>Protocol not ready.</strong>{' '}
        Rooster currently does not read Hermes <code>&lt;profile_dir&gt;/config.toml</code>,
        does not shell out to the <code>hermes</code> CLI, and has no
        <code> get_config</code> / <code>set_config</code> / <code>set_credentials</code>{' '}
        bridge IPC action or <code>/api/hermes/config</code> server route. This page
        therefore intentionally does not show, edit, save, or restart any credential or
        runtime config value. It only shows what still needs to be wired up before a real
        read-only Settings view can ship.
      </div>

      <section class="admin-settings-checklist" data-testid="admin-settings-checklist">
        <h2 class="admin-section-title">Wiring checklist</h2>
        <ol class="admin-checklist">
          {WIRING_CHECKLIST.map((item) => (
            <li key={item.id} class="admin-checklist-item">
              <div class="admin-checklist-label"><strong>{item.label}</strong></div>
              <div class="admin-checklist-detail color-fg-muted">{item.detail}</div>
            </li>
          ))}
        </ol>
        <p class="admin-settings-credentials-note color-fg-muted" role="note">
          <strong>Credentials and behavior boundary.</strong>{' '}
          The Hermes config surface mixes plain product preferences with platform
          credentials for <code>telegram</code>, <code>discord</code>, <code>slack</code>,
          <code> whatsapp</code>, <code>matrix</code>, <code>weixin</code>,
          <code> wecom</code>, <code>feishu</code>, <code>dingtalk</code>,
          <code> qqbot</code>, and other <code>platforms</code> entries: bot tokens,
          API keys, cookies, and qrcode-derived sessions. It also carries behavior
          toggles like <code>approvals.mode</code> (whose <code>'off'</code> value
          disables tool-use confirmation) and <code>privacy.redact_pii</code>. Before any
          Settings surface can ship, secrets must be encrypted at rest, every read must
          apply server-side redaction so the client never receives raw token values,
          every administrative read and every behavior-toggle change must be audited,
          and any UI that surfaces these values must include an explicit confirmation UX
          before they can be revealed or changed.
        </p>
        <p class="admin-settings-deferred-note color-fg-muted" role="note">
          <strong>Mutation and restart are deferred to a separate security review.</strong>{' '}
          <code>PUT /api/hermes/config</code>, <code>PUT /api/hermes/config/credentials</code>,
          the <code>restart: true</code> flag, and the weixin qrcode credential writeback
          flow are intentionally not part of the read-only v1. Each of them requires a
          per-section schema validation layer, a secret store with encryption-at-rest, a
          documented restart impact assessment, an approvals and quota blast-radius
          analysis (changing <code>approvals.mode</code> from <code>'manual'</code> to
          <code> 'off'</code> instantly widens every subsequent chat's blast radius), and
          a separate security review before any mutation, restart, or credential-writeback
          control ships.
        </p>
      </section>
    </div>
  )
}
