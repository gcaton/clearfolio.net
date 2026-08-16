'use client'

import { useActionState } from 'react'
import { submitLogin } from './actions'

export default function LoginPage() {
  const [state, action, pending] = useActionState(submitLogin, null)

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-6 text-lg font-semibold">Clearfolio</h1>

      <form action={action} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs">Passphrase</span>
          <input
            name="passphrase"
            type="password"
            autoFocus
            required
            aria-invalid={!!state?.error}
            aria-describedby="login-error"
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
          />
        </label>

        <p id="login-error" className="text-sm value-negative" role="alert">
          {state?.error}
        </p>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md px-3 py-2 text-sm font-medium"
          style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
