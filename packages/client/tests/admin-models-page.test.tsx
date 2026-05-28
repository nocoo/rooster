/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/preact'
import { selectedModel, selectedProvider } from '../src/state/settings.js'

const mockFetchModels = vi.fn()
const mockFetchProviders = vi.fn()

vi.mock('../src/api/settings.js', () => ({
  fetchProfiles: vi.fn().mockResolvedValue([]),
  fetchModels: (...args: unknown[]) => mockFetchModels(...args) as unknown,
  fetchProviders: (...args: unknown[]) => mockFetchProviders(...args) as unknown,
}))

function modelsSection(container: Element): HTMLElement {
  return container.querySelector('[data-testid="admin-models-section"]') as HTMLElement
}

function providersSection(container: Element): HTMLElement {
  return container.querySelector('[data-testid="admin-providers-section"]') as HTMLElement
}

describe('AdminModelsPage', () => {
  beforeEach(() => {
    mockFetchModels.mockReset()
    mockFetchProviders.mockReset()
    selectedModel.value = null
    selectedProvider.value = null
  })

  afterEach(() => {
    cleanup()
  })

  it('renders a read-only banner explaining the bridge protocol gap', async () => {
    mockFetchModels.mockResolvedValue([])
    mockFetchProviders.mockResolvedValue([])
    const { AdminModelsPage } = await import('../src/pages/admin/Models.js')
    const { container } = render(<AdminModelsPage />)

    expect(screen.getByText(/Read-only preview/i)).toBeTruthy()
    expect(screen.getByText(/dedicated bridge config protocol/i)).toBeTruthy()
    expect(container.querySelector('.admin-profiles-banner')).toBeTruthy()
  })

  it('shows loading state for both sections while fetches are pending', async () => {
    mockFetchModels.mockReturnValue(new Promise<string[]>(() => {}))
    mockFetchProviders.mockReturnValue(new Promise<string[]>(() => {}))
    const { AdminModelsPage } = await import('../src/pages/admin/Models.js')
    render(<AdminModelsPage />)

    expect(screen.getByText(/Loading models/i)).toBeTruthy()
    expect(screen.getByText(/Loading providers/i)).toBeTruthy()
  })

  it('shows empty state for each section independently', async () => {
    mockFetchModels.mockResolvedValue([])
    mockFetchProviders.mockResolvedValue([])
    const { AdminModelsPage } = await import('../src/pages/admin/Models.js')
    const { container } = render(<AdminModelsPage />)

    await waitFor(() => {
      expect(screen.getByText(/No models discovered yet/i)).toBeTruthy()
    })
    expect(screen.getByText(/No providers discovered yet/i)).toBeTruthy()
    expect(container.querySelector('table')).toBeNull()
  })

  it('renders models and providers in separate tables with thead/tbody', async () => {
    mockFetchModels.mockResolvedValue(['gpt-4', 'claude-opus-4'])
    mockFetchProviders.mockResolvedValue(['openai', 'anthropic'])
    const { AdminModelsPage } = await import('../src/pages/admin/Models.js')
    const { container } = render(<AdminModelsPage />)

    await waitFor(() => {
      expect(modelsSection(container).querySelector('table.admin-table tbody')).toBeTruthy()
    })

    const modelsRows = modelsSection(container).querySelectorAll('table tbody tr')
    expect(modelsRows.length).toBe(2)
    expect(modelsRows[0]?.textContent).toContain('gpt-4')

    const providersRows = providersSection(container).querySelectorAll('table tbody tr')
    expect(providersRows.length).toBe(2)
    expect(providersRows[0]?.textContent).toContain('openai')
  })

  it('renders providers table even when models fetch fails (cross-isolation)', async () => {
    mockFetchModels.mockRejectedValue(new Error('models offline'))
    mockFetchProviders.mockResolvedValue(['openai'])
    const { AdminModelsPage } = await import('../src/pages/admin/Models.js')
    const { container } = render(<AdminModelsPage />)

    await waitFor(() => {
      expect(within(modelsSection(container)).getByText(/Failed to load models: models offline/i)).toBeTruthy()
    })

    expect(modelsSection(container).querySelector('.admin-profiles-error')).toBeTruthy()
    expect(within(providersSection(container)).queryByRole('alert')).toBeNull()
    const providersRows = providersSection(container).querySelectorAll('table tbody tr')
    expect(providersRows.length).toBe(1)
    expect(providersRows[0]?.textContent).toContain('openai')
  })

  it('renders models table even when providers fetch fails (cross-isolation)', async () => {
    mockFetchModels.mockResolvedValue(['gpt-4'])
    mockFetchProviders.mockRejectedValue(new Error('providers offline'))
    const { AdminModelsPage } = await import('../src/pages/admin/Models.js')
    const { container } = render(<AdminModelsPage />)

    await waitFor(() => {
      expect(within(providersSection(container)).getByText(/Failed to load providers: providers offline/i)).toBeTruthy()
    })

    expect(providersSection(container).querySelector('.admin-profiles-error')).toBeTruthy()
    expect(within(modelsSection(container)).queryByRole('alert')).toBeNull()
    const modelsRows = modelsSection(container).querySelectorAll('table tbody tr')
    expect(modelsRows.length).toBe(1)
    expect(modelsRows[0]?.textContent).toContain('gpt-4')
  })

  it('retry models only re-fetches models, not providers', async () => {
    mockFetchModels.mockRejectedValueOnce(new Error('boom'))
    mockFetchModels.mockResolvedValueOnce(['gpt-4'])
    mockFetchProviders.mockResolvedValue(['openai'])
    const { AdminModelsPage } = await import('../src/pages/admin/Models.js')
    const { container } = render(<AdminModelsPage />)

    await waitFor(() => {
      expect(within(modelsSection(container)).getByText(/Failed to load models/i)).toBeTruthy()
    })
    expect(mockFetchModels).toHaveBeenCalledTimes(1)
    expect(mockFetchProviders).toHaveBeenCalledTimes(1)

    const retry = within(modelsSection(container)).getByRole('button', { name: 'Retry models' })
    fireEvent.click(retry)

    await waitFor(() => {
      expect(within(modelsSection(container)).queryByText(/Failed to load models/i)).toBeNull()
    })
    expect(within(modelsSection(container)).getByText('gpt-4')).toBeTruthy()
    expect(mockFetchModels).toHaveBeenCalledTimes(2)
    expect(mockFetchProviders).toHaveBeenCalledTimes(1)
  })

  it('retry providers only re-fetches providers, not models', async () => {
    mockFetchModels.mockResolvedValue(['gpt-4'])
    mockFetchProviders.mockRejectedValueOnce(new Error('boom'))
    mockFetchProviders.mockResolvedValueOnce(['openai'])
    const { AdminModelsPage } = await import('../src/pages/admin/Models.js')
    const { container } = render(<AdminModelsPage />)

    await waitFor(() => {
      expect(within(providersSection(container)).getByText(/Failed to load providers/i)).toBeTruthy()
    })
    expect(mockFetchModels).toHaveBeenCalledTimes(1)
    expect(mockFetchProviders).toHaveBeenCalledTimes(1)

    const retry = within(providersSection(container)).getByRole('button', { name: 'Retry providers' })
    fireEvent.click(retry)

    await waitFor(() => {
      expect(within(providersSection(container)).queryByText(/Failed to load providers/i)).toBeNull()
    })
    expect(within(providersSection(container)).getByText('openai')).toBeTruthy()
    expect(mockFetchModels).toHaveBeenCalledTimes(1)
    expect(mockFetchProviders).toHaveBeenCalledTimes(2)
  })

  it('reflects active model and provider from signals', async () => {
    selectedModel.value = 'claude-opus-4'
    selectedProvider.value = 'anthropic'
    mockFetchModels.mockResolvedValue(['gpt-4', 'claude-opus-4'])
    mockFetchProviders.mockResolvedValue(['openai', 'anthropic'])
    const { AdminModelsPage } = await import('../src/pages/admin/Models.js')
    const { container } = render(<AdminModelsPage />)

    expect(screen.getByText(/Model:/).textContent).toContain('claude-opus-4')
    expect(screen.getByText(/Provider:/).textContent).toContain('anthropic')

    await waitFor(() => {
      const modelRow = within(modelsSection(container))
        .getAllByRole('row')
        .find((r) => r.textContent.includes('claude-opus-4'))
      expect(modelRow?.textContent).toContain('Active in chat')
    })
    const providerRow = within(providersSection(container))
      .getAllByRole('row')
      .find((r) => r.textContent.includes('anthropic'))
    expect(providerRow?.textContent).toContain('Active in chat')
  })

  it('reports "(unset)" for both when no signal value is selected', async () => {
    selectedModel.value = null
    selectedProvider.value = null
    mockFetchModels.mockResolvedValue([])
    mockFetchProviders.mockResolvedValue([])
    const { AdminModelsPage } = await import('../src/pages/admin/Models.js')
    render(<AdminModelsPage />)

    const unsetEls = screen.getAllByText(/\(unset\)/i)
    expect(unsetEls.length).toBe(2)
  })
})
