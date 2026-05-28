/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/preact'

describe('AdminSkillsPage', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders a protocol-not-ready banner instead of pretending skills are managed', async () => {
    const { AdminSkillsPage } = await import('../src/pages/admin/Skills.js')
    const { container } = render(<AdminSkillsPage />)

    expect(screen.getByRole('heading', { name: 'Skills' })).toBeTruthy()
    expect(screen.getByText(/Protocol not ready/i)).toBeTruthy()

    const banner = container.querySelector('.admin-profiles-banner')
    expect(banner).not.toBeNull()
    const bannerText = banner?.textContent ?? ''
    expect(/list_skills/.test(bannerText)).toBe(true)
    expect(/GET \/api\/hermes\/skills/.test(bannerText)).toBe(true)
    expect(/fetchSkills\(\)/.test(bannerText)).toBe(true)
  })

  it('does not render a skills table or any skill rows', async () => {
    const { AdminSkillsPage } = await import('../src/pages/admin/Skills.js')
    const { container } = render(<AdminSkillsPage />)

    expect(container.querySelector('table')).toBeNull()
  })

  it('renders the 4-item protocol contract (request/response / schema / redaction / page states)', async () => {
    const { AdminSkillsPage } = await import('../src/pages/admin/Skills.js')
    const { container } = render(<AdminSkillsPage />)

    const checklist = container.querySelector('section[data-testid="admin-skills-checklist"]')
    expect(checklist).not.toBeNull()

    const items = container.querySelectorAll(
      'section[data-testid="admin-skills-checklist"] > ol.admin-checklist > li.admin-checklist-item',
    )
    expect(items.length).toBe(4)

    const labels = Array.from(
      container.querySelectorAll(
        'section[data-testid="admin-skills-checklist"] .admin-checklist-label',
      ),
    ).map((el) => el.textContent)

    expect(labels.some((l) => /list_skills request \/ response contract/i.test(l))).toBe(true)
    expect(labels.some((l) => /minimal SkillInfo schema/i.test(l))).toBe(true)
    expect(labels.some((l) => /bridge-side redaction boundary/i.test(l))).toBe(true)
    expect(labels.some((l) => /read-only Skills table \/ detail states/i.test(l))).toBe(true)
  })

  it('pins the minimal SkillInfo schema to name / description / source / enabled only', async () => {
    const { AdminSkillsPage } = await import('../src/pages/admin/Skills.js')
    render(<AdminSkillsPage />)

    const schemaDetail = screen.getByText(/Read-only v1 SkillInfo carries only/i)
    expect(schemaDetail).toBeTruthy()
    const text = schemaDetail.textContent
    expect(/\bname\b/.test(text)).toBe(true)
    expect(/\bdescription\b/.test(text)).toBe(true)
    expect(/\bsource\b/.test(text)).toBe(true)
    expect(/\benabled\b/.test(text)).toBe(true)
    // Usage / pinned / modified are explicitly deferred.
    expect(/out of scope for the v1 contract/i.test(text)).toBe(true)
  })

  it('declares the bridge-side redaction boundary covers paths / SKILL.md body / external_dirs / .hub lock', async () => {
    const { AdminSkillsPage } = await import('../src/pages/admin/Skills.js')
    render(<AdminSkillsPage />)

    const banner = screen.getByText(/Protocol not ready/i)
    const bannerText = banner.parentElement?.textContent ?? ''
    const redaction = screen.getByText(/Bridge must strip absolute paths/i)
    const redactionText = redaction.textContent
    const combined = `${bannerText}\n${redactionText}`

    expect(/absolute paths/i.test(combined)).toBe(true)
    expect(/SKILL\.md/i.test(combined)).toBe(true)
    expect(/external_dirs/i.test(combined)).toBe(true)
    expect(/\.hub\/lock\.json/i.test(combined)).toBe(true)
    expect(/filesystem layout/i.test(redactionText)).toBe(true)
  })

  it('explains why this is deferred: Hermes bridge has no skill action and reference walks the filesystem', async () => {
    const { AdminSkillsPage } = await import('../src/pages/admin/Skills.js')
    render(<AdminSkillsPage />)

    const note = screen.getByText(/Why this is deferred/i)
    const text = note.parentElement?.textContent ?? ''

    expect(/skill_utils/i.test(text)).toBe(true)
    expect(/does not include any skill-related action/i.test(text)).toBe(true)
    expect(/hermes-web-ui/i.test(text)).toBe(true)
    expect(/bypasses the bridge/i.test(text)).toBe(true)
    expect(/Rooster intentionally does\s+not take that path/i.test(text)).toBe(true)
  })

  it('explicitly excludes file tree / read / toggle / pin / install / remove from read-only v1', async () => {
    const { AdminSkillsPage } = await import('../src/pages/admin/Skills.js')
    render(<AdminSkillsPage />)

    const note = screen.getByText(/Out of scope for read-only v1/i)
    const text = note.parentElement?.textContent ?? ''

    expect(/files/i.test(text)).toBe(true)
    expect(/toggle/i.test(text)).toBe(true)
    expect(/pin/i.test(text)).toBe(true)
    expect(/install/i.test(text)).toBe(true)
    expect(/remove/i.test(text)).toBe(true)
    expect(/separate security review/i.test(text)).toBe(true)
  })

  it('does not claim a server route, fetch helper, or any skill data has shipped', async () => {
    const { AdminSkillsPage } = await import('../src/pages/admin/Skills.js')
    const { container } = render(<AdminSkillsPage />)

    const allText = container.textContent
    // No mock / fake / placeholder skill names leaking through.
    expect(/example-skill|sample-skill|fake-skill/i.test(allText)).toBe(false)
    // No assertion of an existing endpoint.
    expect(/route is live|endpoint is live|already shipped|now available/i.test(allText)).toBe(
      false,
    )
  })
})
