import { describe, it, expect, vi } from 'vitest'

const runMock = vi.fn()
vi.mock('@/db/client', () => ({
  getDb: () => ({ run: runMock }),
}))

describe('GET /api/health', () => {
  it('reports healthy when the database query succeeds', async () => {
    runMock.mockReturnValue(undefined)
    const { GET } = await import('./route')

    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'healthy' })
  })

  it('reports unhealthy with a 503 when the database query throws', async () => {
    runMock.mockImplementation(() => {
      throw new Error('database is unavailable')
    })
    const { GET } = await import('./route')

    const response = await GET()

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ status: 'unhealthy' })
  })
})
