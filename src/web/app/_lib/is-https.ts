import { headers } from 'next/headers'

/**
 * Resolves whether the current request should be treated as HTTPS, for the
 * `Secure` cookie attribute. The app runs behind a reverse proxy in the
 * container (see AuthEndpoints.cs's `Login` handler in the prior C# API),
 * so the proxy-set `X-Forwarded-Proto` header is the signal — Next itself
 * has no independent notion of request scheme to fall back on inside a
 * server action or route handler.
 *
 * Deliberately kept in the action layer (not `@/server/session`, which is
 * framework-free) since it depends on `next/headers`. Shared by the login
 * and setup actions so the two callers of `sessionCookieOptions` resolve
 * `isHttps` identically.
 */
export async function resolveIsHttps(): Promise<boolean> {
  const headerList = await headers()
  return headerList.get('x-forwarded-proto')?.toLowerCase() === 'https'
}
