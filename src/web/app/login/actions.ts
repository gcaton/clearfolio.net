'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { appSettings } from '@/db/schema'
import { createSession, verifyPassphrase } from '@/server/auth'
import { SESSION_COOKIE, sessionCookieOptions } from '@/server/session'

export async function submitLogin(_prev: unknown, formData: FormData) {
  const passphrase = String(formData.get('passphrase') ?? '')
  if (!passphrase) return { error: 'Passphrase is required.' }

  const db = getDb()
  const stored = db.select().from(appSettings)
    .where(eq(appSettings.key, 'passphrase')).get()

  if (!stored) return { error: 'No passphrase is set.' }
  if (!verifyPassphrase(passphrase, stored.value)) {
    return { error: 'Incorrect passphrase.' }
  }

  const token = createSession(db)
  const headerList = await headers()
  const isHttps =
    headerList.get('x-forwarded-proto')?.toLowerCase() === 'https'

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions(isHttps))

  redirect('/dashboard')
}
