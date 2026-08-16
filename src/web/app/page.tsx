import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/db/client'
import { resolveAuthState, SESSION_COOKIE } from '@/server/session'

export default async function Home() {
  // Order is load-bearing: `next build` runs before any database exists, so
  // awaiting cookies() first is what forces this route into dynamic
  // rendering and skips prerendering. Call getDb() first and the build
  // fails trying to open a database that isn't there yet.
  const cookieStore = await cookies()
  const state = resolveAuthState(getDb(), cookieStore.get(SESSION_COOKIE)?.value ?? null)

  if (state.status === 'no-setup') redirect('/setup')
  if (state.status === 'unauthenticated') redirect('/login')
  redirect('/dashboard')
}
