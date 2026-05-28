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
    render(<AdminSkillsPage />)

    expect(screen.getByRole('heading', { name: 'Skills' })).toBeTruthy()
    expect(screen.getByText(/Protocol not ready/i)).toBeTruthy()
    expect(screen.getByText(/does not yet have a bridge skills IPC action/i)).toBeTruthy()
  })

  it('does not render a skills table or any skill rows', async () => {
    const { AdminSkillsPage } = await import('../src/pages/admin/Skills.js')
    const { container } = render(<AdminSkillsPage />)

    expect(container.querySelector('table')).toBeNull()
  })

  it('renders the 4-item wiring checklist (bridge / route / client api / page states)', async () => {
    const { AdminSkillsPage } = await import('../src/pages/admin/Skills.js')
    const { container } = render(<AdminSkillsPage />)

    const items = container.querySelectorAll('ol.admin-checklist > li.admin-checklist-item')
    expect(items.length).toBe(4)

    expect(screen.getByText(/bridge IPC list_skills action/i)).toBeTruthy()
    expect(screen.getByText(/GET \/api\/hermes\/skills/)).toBeTruthy()
    expect(screen.getByText(/client fetchSkills\(\) helper/)).toBeTruthy()
    expect(screen.getByText(/Skills table \/ detail states/i)).toBeTruthy()
  })
})
