'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getDb } from '@/db/client'
import { completeSetup } from '@/server/services/setup'

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

  try {
    completeSetup(getDb(), parsed.data)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Setup failed.' }
  }

  redirect('/dashboard')
}
