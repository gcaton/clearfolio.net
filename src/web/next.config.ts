import type { NextConfig } from 'next'
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants'

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
//   Replacement. Without a `ws:` allowance in connect-src, the browser blocks
//   that connection — scoped to localhost/127.0.0.1 rather than any origin,
//   since the dev server only ever listens locally. Production serves no
//   such websocket, so this allowance must not ship in the production
//   policy either.
//
// This is keyed off Next's build *phase* (which command is actually
// running), not `process.env.NODE_ENV`. Next's CLI only defaults
// NODE_ENV — `process.env.NODE_ENV = process.env.NODE_ENV || defaultEnv`
// (node_modules/next/dist/bin/next) — it does not override an
// already-exported value. If the ambient environment (a Docker base image,
// a devcontainer, a CI step) already exports NODE_ENV=development, `next
// build`/`next start` would leave it as `development` and a NODE_ENV-based
// check would silently ship the dev CSP — 'unsafe-eval' and ws: — in
// production. The phase passed into this function reflects which Next
// command actually invoked it, so it can't be overridden by the ambient
// environment.
export default function nextConfig(phase: string): NextConfig {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER

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
        `connect-src 'self'${isDev ? ' ws://localhost:* ws://127.0.0.1:*' : ''}`,
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    },
  ]

  return {
    output: 'standalone',
    serverExternalPackages: ['better-sqlite3'],
    async headers() {
      return [{ source: '/:path*', headers: SECURITY_HEADERS }]
    },
  }
}
