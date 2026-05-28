type ChecklistItem = {
  id: string
  label: string
  detail: string
}

const WIRING_CHECKLIST: ReadonlyArray<ChecklistItem> = [
  {
    id: 'bridge-action',
    label: 'bridge IPC list_skills action',
    detail: 'Hermes agent bridge must expose a list_skills IPC action that returns skill metadata.',
  },
  {
    id: 'server-route',
    label: 'GET /api/hermes/skills',
    detail: 'Server route that proxies the bridge action and shapes the response for the client.',
  },
  {
    id: 'client-api',
    label: 'client fetchSkills() helper',
    detail: 'packages/client/src/api module that calls the server route and types the response.',
  },
  {
    id: 'page-states',
    label: 'Skills table / detail states',
    detail: 'Wire this page to fetchSkills() with loading / error / empty / list / detail UI.',
  },
]

export function AdminSkillsPage() {
  return (
    <div class="admin-skills">
      <h1 class="admin-page-title">Skills</h1>
      <div class="admin-profiles-banner" role="note">
        <strong>Protocol not ready.</strong>{' '}
        Rooster does not yet have a bridge skills IPC action or a server route for skills,
        so this page intentionally does not list or manage any skills. It only shows what
        still needs to be wired up before a real read-only Skills view can ship.
      </div>

      <section class="admin-skills-checklist">
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
