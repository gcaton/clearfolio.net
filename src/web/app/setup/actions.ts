'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getDb } from '@/db/client'
import { completeSetup } from '@/server/services/setup'
import { createSession } from '@/server/auth'
import { SESSION_COOKIE, sessionCookieOptions } from '@/server/session'
import { resolveIsHttps } from '../_lib/is-https'

const SetupSchema = z.object({
  householdName: z.string().trim().min(1, 'Household name is required.'),
  displayName: z.string().trim().min(1, 'Display name is required.'),
  secondMemberName: z.string().trim().optional(),
  baseCurrency: z.string().trim().length(3),
  locale: z.string().trim().min(2),
  preferredPeriodType: z.enum(['FY', 'CY']),
  passphrase: z.string().optional().transform((v) => (v ? v : undefined)),
})

export async function submitSetup(_prev: unknown, formData: FormData) {
  const parsed = SetupSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const db = getDb()

  try {
    completeSetup(db, parsed.data)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Setup failed.' }
  }

  // Choosing a passphrase during setup is proof of knowledge of it — at
  // least as strong as the login action's `verifyPassphrase` check — so
  // mint a session immediately rather than sending the user to /login to
  // retype what they just set. When no passphrase was supplied the app is
  // open by design (`resolveAuthState` already returns `authenticated`
  // with no session token), so mint nothing.
  if (parsed.data.passphrase) {
    const token = createSession(db)
    const isHttps = await resolveIsHttps()
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions(isHttps))
  }

  redirect('/dashboard')
}
