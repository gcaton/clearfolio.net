import { describe, it, expect, vi } from 'vitest'

const headersMock = vi.fn()
vi.mock('next/headers', () => ({
  headers: () => headersMock(),
}))

function headerList(value: string | null): { get(name: string): string | null } {
  return { get: () => value }
}

describe('resolveIsHttps', () => {
  it('is false when the header is absent', async () => {
    headersMock.mockResolvedValue(headerList(null))
    const { resolveIsHttps } = await import('./is-https')
    expect(await resolveIsHttps()).toBe(false)
  })

  it('is true for https', async () => {
    headersMock.mockResolvedValue(headerList('https'))
    const { resolveIsHttps } = await import('./is-https')
    expect(await resolveIsHttps()).toBe(true)
  })

  it('is false for http', async () => {
    headersMock.mockResolvedValue(headerList('http'))
    const { resolveIsHttps } = await import('./is-https')
    expect(await resolveIsHttps()).toBe(false)
  })

  it('is true for an uppercase HTTPS', async () => {
    headersMock.mockResolvedValue(headerList('HTTPS'))
    const { resolveIsHttps } = await import('./is-https')
    expect(await resolveIsHttps()).toBe(true)
  })

  it('is false for a chained proxy list form (pins current behaviour — a chained proxy value is not recognised)', async () => {
    // `x-forwarded-proto: https,http` is what a chain of proxies produces
    // (each one appends its hop's scheme). This function does not split the
    // list — it only matches an exact 'https' — so this case reads as
    // non-HTTPS today. That is a pinned, current behaviour, not a fix: the
    // proxy chain case is out of scope for this pass.
    headersMock.mockResolvedValue(headerList('https,http'))
    const { resolveIsHttps } = await import('./is-https')
    expect(await resolveIsHttps()).toBe(false)
  })
})
