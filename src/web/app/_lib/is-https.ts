import { headers } from 'next/headers'

/**
 * Resolves whether the current request should be treated as HTTPS, for the
 * `Secure` cookie attribute. The app runs behind a reverse proxy in the
 * container (see AuthEndpoints.cs's `Login` handler in the prior C# API),
 * so the proxy-set `X-Forwarded-Proto` header is the signal read here.
 *
 * Next does have its own fallback notion of request scheme — `base-server.js`
 * derives `isHttps` from the raw socket's `socket.encrypted` when no
 * `x-forwarded-proto` header is present, then backfills that header before
 * the request reaches route handlers (`req.headers['x-forwarded-proto'] ??=
 * ...`). That backfill is *why* reading the header here is correct rather
 * than a gap: behind the container's reverse proxy the header always arrives
 * already set by the proxy, and in the socket-fallback case Next has already
 * written it for us. This function never needs to inspect the socket itself.
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
