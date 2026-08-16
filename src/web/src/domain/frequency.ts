import type { Cents } from './money'

export type Frequency = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly'

export const FREQUENCY_MULTIPLIERS: Record<Frequency, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
}

function multiplierFor(frequency: string | null | undefined): number | null {
  if (!frequency) return null
  const key = frequency.toLowerCase() as Frequency
  return Object.hasOwn(FREQUENCY_MULTIPLIERS, key) ? FREQUENCY_MULTIPLIERS[key] : null
}

/** Annual equivalent of a recurring amount. Unknown frequency yields zero. */
export function annualise(amount: Cents, frequency: string | null | undefined): Cents {
  const multiplier = multiplierFor(frequency)
  return (multiplier === null ? 0 : amount * multiplier) as Cents
}

/**
 * Annual contribution, treating missing, zero and negative amounts as none.
 * Mirrors FrequencyHelper.NormaliseContribution.
 */
export function normaliseContribution(
  amount: Cents | null | undefined,
  frequency: string | null | undefined,
): Cents {
  if (amount === null || amount === undefined || amount <= 0) return 0 as Cents
  return annualise(amount, frequency)
}
