import { describe, it, expect, afterEach, vi } from 'vitest'
import { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from 'next/constants'
import nextConfig from './next.config'

/**
 * Guards the production CSP against a NODE_ENV-based check silently
 * reappearing. This was previously verified by a one-off manual check —
 * nowhere in the repo asserted it. See next.config.ts's top-of-file comment
 * for why this must be keyed off Next's build *phase*, not
 * `process.env.NODE_ENV`: an ambient NODE_ENV=development (a Docker base
 * image, a devcontainer, a CI step) must not cause a production build/start
 * to ship the dev CSP.
 */
describe('nextConfig — production CSP', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  async function cspFor(phase: string): Promise<string> {
    const config = nextConfig(phase)
    const rules = await config.headers!()
    const csp = rules[0].headers.find((h) => h.key === 'Content-Security-Policy')
    if (!csp) throw new Error('no CSP header returned')
    return csp.value
  }

  it.each([
    ['PHASE_PRODUCTION_BUILD', PHASE_PRODUCTION_BUILD],
    ['PHASE_PRODUCTION_SERVER', PHASE_PRODUCTION_SERVER],
  ])('%s: excludes unsafe-eval and ws:, even with NODE_ENV forced to development', async (_name, phase) => {
    vi.stubEnv('NODE_ENV', 'development')

    const csp = await cspFor(phase)

    expect(csp).not.toContain('unsafe-eval')
    expect(csp).not.toContain('ws:')
  })

  it('dev phase still allows unsafe-eval and a scoped ws: allowance', async () => {
    const csp = await cspFor('phase-development-server')

    expect(csp).toContain('unsafe-eval')
    expect(csp).toContain('ws://localhost:*')
  })
})
