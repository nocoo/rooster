type ChecklistItem = {
  id: string
  label: string
  detail: string
}

const WIRING_CHECKLIST: ReadonlyArray<ChecklistItem> = [
  {
    id: 'bridge-action',
    label: 'bridge IPC list_jobs / get_job / list_cron_runs / read_cron_run actions',
    detail: 'Hermes agent bridge must expose read-only list_jobs / get_job / list_cron_runs / read_cron_run IPC actions, sourced from a persisted store that the bridge owns, subject to retention and redaction policy.',
  },
  {
    id: 'server-route',
    label: 'GET /api/hermes/jobs + detail and cron-run routes with server-side redaction',
    detail: 'Server routes that proxy the bridge actions: jobs list, single-job detail, cron-run list filtered by jobId, and single-run detail. They must apply server-side redaction so that prompt content, deliver targets, origin chat identifiers, last_error stack traces, and any cron run log content are never returned to a client unredacted, and so that secrets or tokens that appear in error output or run logs are stripped.',
  },
  {
    id: 'client-api',
    label: 'client fetchJobs / fetchJob / fetchCronRuns / fetchCronRun helpers',
    detail: 'packages/client/src/api module that calls the server routes and types the redacted responses.',
  },
  {
    id: 'page-states',
    label: 'Jobs list / detail + cron-run list / detail states',
    detail: 'Wire this page to fetchJobs / fetchJob / fetchCronRuns / fetchCronRun with loading / error / empty / list / detail UI, all sourced from the redacted server responses.',
  },
]

export function AdminJobsPage() {
  return (
    <div class="admin-jobs">
      <h1 class="admin-page-title">Jobs</h1>
      <div class="admin-profiles-banner" role="note">
        <strong>Protocol not ready.</strong>{' '}
        Rooster currently does not read Hermes profile cron files, does not shell out
        to the <code>hermes</code> CLI, and has no jobs or cron bridge IPC action or
        server retrieval route. This page therefore intentionally does not list, search,
        view, run, pause, resume, or delete any job or run history. It only shows what
        still needs to be wired up before a real read-only Jobs view can ship.
      </div>

      <section class="admin-jobs-checklist" data-testid="admin-jobs-checklist">
        <h2 class="admin-section-title">Wiring checklist</h2>
        <ol class="admin-checklist">
          {WIRING_CHECKLIST.map((item) => (
            <li key={item.id} class="admin-checklist-item">
              <div class="admin-checklist-label"><strong>{item.label}</strong></div>
              <div class="admin-checklist-detail color-fg-muted">{item.detail}</div>
            </li>
          ))}
        </ol>
        <p class="admin-jobs-privacy-note color-fg-muted" role="note">
          <strong>Privacy and content boundary.</strong>{' '}
          Jobs and cron run history carry highly sensitive content: each job stores a
          full prompt body, a deliver target, and an origin chat identifier; failed runs
          attach a last_error stack trace; cron run log content captures whatever the
          agent printed during execution, including secrets and tokens leaked into logs.
          Before any Jobs surface can ship, the server must apply server-side redaction
          so prompt content, deliver targets, origin chat identifiers, last_error
          stacks, cron run log content, and any other PII are never returned to a
          client unredacted. Every admin read against this surface must be recorded in
          an audit trail.
        </p>
        <p class="admin-jobs-deferred-note color-fg-muted" role="note">
          <strong>Schedule and execution are deferred to a separate security review.</strong>{' '}
          Cron expression validation, enable / disable, pause / resume, and manual run
          are not part of the read-only v1. Manual run in particular triggers a real
          agent invocation with quota and cost side effects, so it requires explicit
          confirmation UX, a quota check, and audit copy that makes the implications
          clear. Schedule create and update accept user-supplied cron expressions and
          therefore need a hardened parser and a separate security review before any
          mutation control ships.
        </p>
      </section>
    </div>
  )
}
