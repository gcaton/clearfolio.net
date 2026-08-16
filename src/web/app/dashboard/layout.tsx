import { getDb } from '@/db/client'
import { households } from '@/db/schema'
import { requireSession } from '@/server/session-guard'
import { AppShell } from '@/components/app-shell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireSession()

  const db = getDb()
  const household = db.select().from(households).limit(1).get()

  return <AppShell householdName={household?.name ?? ''}>{children}</AppShell>
}
