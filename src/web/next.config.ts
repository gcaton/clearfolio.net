import type { NextConfig } from 'next'

// Ported from src/app/security-headers.conf (nginx), which this app replaces.
// Two deliberate additions beyond the nginx conf, both no-ops for this app's
// current behavior and standard CSP hardening: base-uri 'self' and
// form-action 'self'. Everything else matches the conf's values exactly,
// including font-src 'self' (no `data:` — the conf doesn't allow it and the
// app doesn't load any data-URI fonts).
//
// The CSP is intentionally stricter in production than in development:
// - `next dev` ships a React development build that requires `eval()` for
//   debugging features (Fast Refresh, component stacks). Without
//   'unsafe-eval' in script-src, the browser blocks it and React logs
//   "eval() is not supported in this environment". Production React never
//   calls eval(), so 'unsafe-eval' must NOT ship in the production policy.
// - `next dev` also opens a WebSocket to the dev server for Hot Module
//   Replacement. Without `ws:` in connect-src, the browser blocks that
//   connection. Production serves no such websocket, so `ws:` must not
//   ship in the production policy either.
const isDev = process.env.NODE_ENV === 'development'

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      `connect-src 'self'${isDev ? ' ws:' : ''}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  },
}

export default nextConfig
