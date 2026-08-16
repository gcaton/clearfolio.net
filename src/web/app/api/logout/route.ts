import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { destroySession } from '@/server/auth'
import { SESSION_COOKIE } from '@/server/session'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) destroySession(getDb(), token)
  cookieStore.delete(SESSION_COOKIE)

  return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
}
