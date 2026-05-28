/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/preact'

describe('AdminJobsPage', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders a protocol-not-ready banner instead of pretending jobs are queryable', async () => {
    const { AdminJobsPage } = await import('../src/pages/admin/Jobs.js')
    render(<AdminJobsPage />)

    expect(screen.getByRole('heading', { name: 'Jobs' })).toBeTruthy()
    expect(screen.getByText(/Protocol not ready/i)).toBeTruthy()
    expect(screen.getByText(/does not read Hermes profile cron files/i)).toBeTruthy()
    expect(screen.getByText(/does not shell out/i)).toBeTruthy()
    expect(screen.getByText(/no jobs or cron bridge IPC action or\s+server retrieval route/i)).toBeTruthy()
  })

  it('does not render a jobs table, search input, schedule input, or any run/pause/resume/delete/create/save/enable/disable button', async () => {
    const { AdminJobsPage } = await import('../src/pages/admin/Jobs.js')
    const { container } = render(<AdminJobsPage />)

    expect(container.querySelector('table')).toBeNull()
    expect(container.querySelector('input')).toBeNull()
    expect(container.querySelector('textarea')).toBeNull()
    expect(container.querySelector('select')).toBeNull()
    expect(screen.queryByRole('button', { name: /run/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /pause/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /resume/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /create/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /enable/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /disable/i })).toBeNull()
  })

  it('renders the 4-item read-only checklist with no mutation verbs in checklist items', async () => {
    const { AdminJobsPage } = await import('../src/pages/admin/Jobs.js')
    const { container } = render(<AdminJobsPage />)

    const checklist = container.querySelector('[data-testid="admin-jobs-checklist"]')
    expect(checklist).toBeTruthy()

    const items = (checklist as HTMLElement).querySelectorAll('ol.admin-checklist > li.admin-checklist-item')
    expect(items.length).toBe(4)

    expect(screen.getByText(/bridge IPC list_jobs \/ get_job \/ list_cron_runs \/ read_cron_run actions/i)).toBeTruthy()
    expect(screen.getByText(/GET \/api\/hermes\/jobs \+ detail and cron-run routes with server-side redaction/i)).toBeTruthy()
    expect(screen.getByText(/client fetchJobs \/ fetchJob \/ fetchCronRuns \/ fetchCronRun helpers/i)).toBeTruthy()
    expect(screen.getByText(/Jobs list \/ detail \+ cron-run list \/ detail states/i)).toBeTruthy()

    const checklistText = Array.from(items).map((el) => el.textContent).join(' ')
    // Detail copy may legitimately mention nouns like "cron run", "run log", "single-run detail".
    // Per Reviewer-B constraint 6, mutation verbs are forbidden only as primary checklist intent,
    // so scope the assertion to .admin-checklist-label elements and strip noun forms ("cron-run",
    // "cron_run") before the verb check.
    const labelVerbText = Array.from(items)
      .flatMap((el) => Array.from(el.querySelectorAll('.admin-checklist-label')))
      .map((el) => el.textContent)
      .join(' ')
      .replace(/cron[-_ ]?runs?/gi, '')
    expect(/\brun\b/i.test(labelVerbText)).toBe(false)
    expect(/\bpause\b/i.test(labelVerbText)).toBe(false)
    expect(/\bresume\b/i.test(labelVerbText)).toBe(false)
    expect(/\bdelete\b/i.test(labelVerbText)).toBe(false)
    expect(/\bcreate\b/i.test(labelVerbText)).toBe(false)
    expect(/\bsave\b/i.test(labelVerbText)).toBe(false)
    expect(/\benable\b/i.test(labelVerbText)).toBe(false)
    expect(/\bdisable\b/i.test(labelVerbText)).toBe(false)
    // Sanity-check that the full checklist text was actually inspected.
    expect(checklistText.length).toBeGreaterThan(0)
  })

  it('renders a privacy/content note covering prompt content, last_error, deliver, origin chat, cron run log, PII, redaction, audit', async () => {
    const { AdminJobsPage } = await import('../src/pages/admin/Jobs.js')
    render(<AdminJobsPage />)

    const note = screen.getByText(/Privacy and content boundary/i)
    expect(note).toBeTruthy()

    const container = note.closest('p') ?? note
    const text = container.textContent
    expect(/prompt content/i.test(text)).toBe(true)
    expect(/last_error/i.test(text)).toBe(true)
    expect(/deliver target/i.test(text)).toBe(true)
    expect(/origin chat identifier/i.test(text)).toBe(true)
    expect(/cron run log/i.test(text)).toBe(true)
    expect(/PII/.test(text)).toBe(true)
    expect(/server-side redaction/i.test(text)).toBe(true)
    expect(/audit/i.test(text)).toBe(true)
  })

  it('renders a separate deferred note covering cron expression, enable/disable, pause/resume, manual run, quota, confirmation, audit/security review', async () => {
    const { AdminJobsPage } = await import('../src/pages/admin/Jobs.js')
    render(<AdminJobsPage />)

    const deferred = screen.getByText(/Schedule and execution are deferred/i)
    expect(deferred).toBeTruthy()

    const container = deferred.closest('p') ?? deferred
    const text = container.textContent
    expect(/cron expression/i.test(text)).toBe(true)
    expect(/enable \/ disable/i.test(text)).toBe(true)
    expect(/pause \/ resume/i.test(text)).toBe(true)
    expect(/manual run/i.test(text)).toBe(true)
    expect(/quota/i.test(text)).toBe(true)
    expect(/confirmation/i.test(text)).toBe(true)
    expect(/audit/i.test(text)).toBe(true)
    expect(/security review/i.test(text)).toBe(true)
  })
})
