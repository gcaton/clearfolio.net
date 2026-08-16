'use client'

import { useActionState } from 'react'
import { submitSetup } from './actions'

const FIELD = 'w-full rounded-md border px-3 py-2 text-sm'
const FIELD_STYLE = { borderColor: 'var(--border)', background: 'var(--surface-raised)' }

export default function SetupPage() {
  const [state, action, pending] = useActionState(submitSetup, null)

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-1 text-lg font-semibold">Welcome to Clearfolio</h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        A few details to set up your household.
      </p>

      <form action={action} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs">Household name</span>
          <input name="householdName" required className={FIELD} style={FIELD_STYLE} />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs">Your name</span>
          <input name="displayName" required className={FIELD} style={FIELD_STYLE} />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs">
            Partner name <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
          </span>
          <input name="secondMemberName" className={FIELD} style={FIELD_STYLE} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs">Currency</span>
            <input name="baseCurrency" defaultValue="AUD" required className={FIELD} style={FIELD_STYLE} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs">Locale</span>
            <input name="locale" defaultValue="en-AU" required className={FIELD} style={FIELD_STYLE} />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs">Period type</span>
          <select name="preferredPeriodType" defaultValue="FY" className={FIELD} style={FIELD_STYLE}>
            <option value="FY">Financial year (July–June)</option>
            <option value="CY">Calendar year (January–December)</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs">
            Passphrase <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
          </span>
          <input
            name="passphrase"
            type="password"
            minLength={8}
            className={FIELD}
            style={FIELD_STYLE}
          />
          <span className="mt-1 block text-xs" style={{ color: 'var(--text-muted)' }}>
            Leave blank to run without a sign-in prompt. Minimum 8 characters.
          </span>
        </label>

        {state?.error && (
          <p className="text-sm value-negative" role="alert">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md px-3 py-2 text-sm font-medium"
          style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
        >
          {pending ? 'Setting up…' : 'Create household'}
        </button>
      </form>
    </main>
  )
}
