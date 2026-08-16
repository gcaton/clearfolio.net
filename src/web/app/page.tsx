import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/db/client'
import { resolveAuthState, SESSION_COOKIE } from '@/server/session'

export default async function Home() {
  const cookieStore = await cookies()
  const state = resolveAuthState(getDb(), cookieStore.get(SESSION_COOKIE)?.value ?? null)

  if (state.status === 'no-setup') redirect('/setup')
  if (state.status === 'unauthenticated') redirect('/login')
  redirect('/dashboard')
}
