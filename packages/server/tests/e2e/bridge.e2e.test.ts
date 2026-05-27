import { describe, it, expect, afterEach } from 'vitest'
import { startHarness, createStubBridge, type E2eHarness } from './_harness.js'

describe('Bridge HTTP routes (L2 e2e)', () => {
  let harness: E2eHarness | undefined

  afterEach(async () => {
    if (harness) await harness.close()
    harness = undefined
  })

  it('GET /api/hermes/profiles returns deduped profile list from bridge', async () => {
    const bridge = createStubBridge({
      list: () => ({
        sessions: [
          { profile: 'alpha' }, { profile: 'beta' }, { profile: 'alpha' },
        ],
      }),
    })
    harness = await startHarness({ bridge })
    const res = await fetch(`${harness.url}/api/hermes/profiles`)
    expect(res.status).toBe(200)
    const body = await res.json() as { profiles: string[] }
    expect(body.profiles.sort()).toEqual(['alpha', 'beta'])
  })

  it('GET /api/hermes/models returns deduped model list from bridge', async () => {
    const bridge = createStubBridge({
      list: () => ({ sessions: [{ model: 'm-1' }, { model: 'm-2' }, { model: 'm-1' }] }),
    })
    harness = await startHarness({ bridge })
    const res = await fetch(`${harness.url}/api/hermes/models`)
    expect(res.status).toBe(200)
    const body = await res.json() as { models: string[] }
    expect(body.models.sort()).toEqual(['m-1', 'm-2'])
  })

  it('GET /api/hermes/providers returns deduped provider list from bridge', async () => {
    const bridge = createStubBridge({
      list: () => ({ sessions: [{ provider: 'p-1' }] }),
    })
    harness = await startHarness({ bridge })
    const res = await fetch(`${harness.url}/api/hermes/providers`)
    expect(res.status).toBe(200)
    const body = await res.json() as { providers: string[] }
    expect(body.providers).toEqual(['p-1'])
  })
})
