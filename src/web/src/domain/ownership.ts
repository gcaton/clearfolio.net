import { scaleCents, type Cents } from './money'

/** Shares are basis points. All shares for one entity sum to this. */
export const TOTAL_BP = 10_000

export interface OwnershipShare {
  memberId: string
  shareBp: number
}

export type View =
  | { kind: 'household' }
  | { kind: 'member'; memberId: string }

export function soleOwnership(memberId: string): OwnershipShare[] {
  return [{ memberId, shareBp: TOTAL_BP }]
}

export function jointOwnership(
  firstMemberId: string,
  secondMemberId: string,
  firstShareBp: number,
): OwnershipShare[] {
  return [
    { memberId: firstMemberId, shareBp: firstShareBp },
    { memberId: secondMemberId, shareBp: TOTAL_BP - firstShareBp },
  ]
}

/**
 * SQLite cannot express a cross-row sum constraint, so this is the enforcement
 * point. Call it on every ownership write, inside the transaction.
 */
export function assertSharesValid(shares: OwnershipShare[]): void {
  if (shares.length === 0) {
    throw new Error('Ownership requires at least one share')
  }

  const seen = new Set<string>()
  for (const share of shares) {
    if (seen.has(share.memberId)) {
      throw new Error(`Duplicate ownership share for member ${share.memberId}`)
    }
    seen.add(share.memberId)

    if (share.shareBp < 0) {
      throw new Error(`Ownership share cannot be negative: ${share.shareBp}`)
    }
    if (!Number.isInteger(share.shareBp)) {
      throw new Error(`Ownership share must be an integer: ${share.shareBp}`)
    }
  }

  const total = shares.reduce((sum, s) => sum + s.shareBp, 0)
  if (total !== TOTAL_BP) {
    throw new Error(`Ownership shares must sum to ${TOTAL_BP}, got ${total}`)
  }
}

export function shareBpForMember(shares: OwnershipShare[], memberId: string): number {
  return shares.find((s) => s.memberId === memberId)?.shareBp ?? 0
}

/**
 * The whole view model. Household is the full value; a member view is that
 * member's share. There is no special-casing of member identity — the p1/p2
 * distinction from the previous implementation does not exist here.
 */
export function applyViewFilter(
  value: Cents,
  shares: OwnershipShare[],
  view: View,
): Cents {
  if (view.kind === 'household') return value
  const shareBp = shareBpForMember(shares, view.memberId)
  if (shareBp === 0) return 0 as Cents
  return scaleCents(value, shareBp / TOTAL_BP)
}

/**
 * Rescale shares to sum to TOTAL_BP — used after a member is deleted and their
 * ownership rows cascade away, leaving an entity under-allocated. Rounding
 * remainder goes to the largest share so the total is always exact.
 */
export function normaliseShares(shares: OwnershipShare[]): OwnershipShare[] {
  if (shares.length === 0) {
    throw new Error('Ownership requires at least one share to normalise')
  }

  const total = shares.reduce((sum, s) => sum + s.shareBp, 0)
  if (total === TOTAL_BP) return shares
  if (total === 0) {
    // No information to preserve — split evenly.
    const even = Math.floor(TOTAL_BP / shares.length)
    const rescaled = shares.map((s) => ({ ...s, shareBp: even }))
    rescaled[0].shareBp += TOTAL_BP - even * shares.length
    return rescaled
  }

  const rescaled = shares.map((s) => ({
    ...s,
    shareBp: Math.floor((s.shareBp / total) * TOTAL_BP),
  }))

  const remainder = TOTAL_BP - rescaled.reduce((sum, s) => sum + s.shareBp, 0)
  if (remainder !== 0) {
    let largestIndex = 0
    for (let i = 1; i < rescaled.length; i++) {
      if (rescaled[i].shareBp > rescaled[largestIndex].shareBp) largestIndex = i
    }
    rescaled[largestIndex].shareBp += remainder
  }

  return rescaled
}
