type ChecklistItem = {
  id: string
  label: string
  detail: string
}

const WIRING_CHECKLIST: ReadonlyArray<ChecklistItem> = [
  {
    id: 'bridge-action',
    label: 'bridge IPC list_skills request / response contract',
    detail:
      'Hermes agent bridge must expose a read-only list_skills action. Request: { action: "list_skills", profile?: string }. Response: { ok: true, categories: SkillCategory[], archived: SkillInfo[] }. No filesystem path, no SKILL.md raw body, no external_dirs raw value, no .hub/lock.json contents may cross the bridge boundary.',
  },
  {
    id: 'skill-schema',
    label: 'minimal SkillInfo schema (name / description / source / enabled)',
    detail:
      'Read-only v1 SkillInfo carries only name, description (first paragraph of SKILL.md frontmatter, plain text), source ("builtin" | "hub" | "local" | "external"), and enabled (boolean). Usage counters, pinned flag, dirHash modified bit, and any per-skill file listing are out of scope for the v1 contract and require a separate security review.',
  },
  {
    id: 'redaction-boundary',
    label: 'bridge-side redaction boundary (server cannot trust raw fields)',
    detail:
      'Bridge must strip absolute paths, expanded external_dirs entries, ${ENV} / ~ expansions, raw SKILL.md body content beyond the description field, and the full contents of .hub/lock.json before responding. The rooster server route must additionally re-apply a defensive redaction pass so a bridge regression cannot leak local filesystem layout, profile directory names, or credential-adjacent fields to the client.',
  },
  {
    id: 'page-states',
    label: 'read-only Skills table / detail states after route + fetchSkills() land',
    detail:
      'Once the bridge action, the GET /api/hermes/skills server route, and the client fetchSkills() helper exist, this page renders loading / error / empty / list / detail states sourced strictly from the redacted SkillInfo schema above. No mutation controls, no file tree, no skill body preview.',
  },
]

export function AdminSkillsPage() {
  return (
    <div class="admin-skills">
      <h1 class="admin-page-title">Skills</h1>
      <div class="admin-profiles-banner" role="note">
        <strong>Protocol not ready.</strong>{' '}
        Rooster does not yet have a bridge <code>list_skills</code> IPC action, a
        <code> GET /api/hermes/skills</code> server route, or a client
        <code> fetchSkills()</code> helper. This page therefore intentionally does not list,
        preview, install, toggle, pin, or otherwise manage any skill. It documents the
        exact protocol contract that must land before a read-only Skills view can ship.
      </div>

      <section class="admin-skills-checklist" data-testid="admin-skills-checklist">
        <h2 class="admin-section-title">Protocol contract</h2>
        <ol class="admin-checklist">
          {WIRING_CHECKLIST.map((item) => (
            <li key={item.id} class="admin-checklist-item">
              <div class="admin-checklist-label"><strong>{item.label}</strong></div>
              <div class="admin-checklist-detail color-fg-muted">{item.detail}</div>
            </li>
          ))}
        </ol>
        <p class="admin-skills-deferred-note color-fg-muted" role="note">
          <strong>Why this is deferred.</strong>{' '}
          Hermes today only exposes skill metadata through in-process Python helpers in
          <code> agent/skill_utils.py</code> (path-walking <code>SKILL.md</code> under
          <code> &lt;profile_dir&gt;/skills/</code>, with no JSON action surface). The Hermes
          agent bridge action list — <code>ping</code>, <code>chat</code>,
          <code> get_output</code>, <code>get_result</code>, <code>interrupt</code>,
          <code> steer</code>, <code>command</code>, <code>context_estimate</code>,
          <code> approval_respond</code>, <code>clarify_respond</code>,
          <code> compression_respond</code>, <code>get_history</code>, <code>destroy</code>,
          <code> destroy_all</code>, <code>destroy_profile</code>, <code>list</code>,
          <code> shutdown</code> — does not include any skill-related action. The reference
          <code> hermes-web-ui</code> implementation bypasses the bridge and walks
          <code> &lt;profile_dir&gt;/skills/</code> directly via <code>fs/promises</code>,
          reads <code>.bundled_manifest</code>, <code>.hub/lock.json</code>,
          <code> .usage.json</code>, and expands <code>config.skills.external_dirs</code>{' '}
          (including <code>~</code> and <code>${'${ENV}'}</code>). Rooster intentionally does
          not take that path: it would require an arbitrary filesystem walker in the server,
          path-traversal defenses for external_dirs, and a bespoke redaction layer over raw
          SKILL.md content. Until the bridge ships a real <code>list_skills</code> action,
          Rooster stays at protocol-readiness and does not return any skill data.
        </p>
        <p class="admin-skills-out-of-scope-note color-fg-muted" role="note">
          <strong>Out of scope for read-only v1 (separate security review required).</strong>{' '}
          Skill file tree listing (<code>GET /skills/:category/:skill/files</code>),
          individual skill file content reads (<code>GET /skills/&#123;*path&#125;</code>),
          toggle (<code>PUT /skills/toggle</code>), pin (<code>PUT /skills/pin</code>),
          install from hub, remove, archive / restore, and external skill directory
          registration are intentionally not part of this contract. Each of them requires
          a path-containment audit, a secret / credential exposure audit, an approvals
          blast-radius review, and a separate security review before any control ships.
        </p>
      </section>
    </div>
  )
}
