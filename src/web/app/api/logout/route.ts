import { cookies } from 'next/headers'
import { getDb } from '@/db/client'
import { destroySession } from '@/server/auth'
import { SESSION_COOKIE } from '@/server/session'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) destroySession(getDb(), token)
  cookieStore.delete(SESSION_COOKIE)

  // Relative Location — building from `request.url` would carry whatever
  // host the reverse proxy forwarded, which may be an internal container
  // hostname rather than what the browser should navigate to.
  return new Response(null, { status: 303, headers: { Location: '/login' } })
}
