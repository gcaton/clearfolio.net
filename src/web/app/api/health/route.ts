import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getDb } from '@/db/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    getDb().run(sql`SELECT 1`)
    return NextResponse.json({ status: 'healthy' })
  } catch {
    return NextResponse.json({ status: 'unhealthy' }, { status: 503 })
  }
}
