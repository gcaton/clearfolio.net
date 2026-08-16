import type { Cents } from './money'

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
 * Splits `value` across `shares` using largest-remainder allocation so the
 * per-member slices always sum to exactly `value` — independent per-member
 * rounding (e.g. `scaleCents(value, shareBp / TOTAL_BP)` for each member)
 * does not conserve the total whenever `value` isn't evenly divisible across
 * the shares. Allocation is done on the absolute value and the sign is
 * reapplied afterwards, so negative values (e.g. negative net worth) split
 * the same way positive ones do rather than drifting asymmetrically under
 * `Math.floor`.
 */
function allocate(value: Cents, shares: OwnershipShare[]): Map<string, Cents> {
  const sign = value < 0 ? -1 : 1
  const abs = Math.abs(value)

  const parts = shares.map((s) => {
    const product = abs * s.shareBp
    const floor = Math.floor(product / TOTAL_BP)
    return { memberId: s.memberId, floor, remainder: product - floor * TOTAL_BP }
  })

  let remainder = abs - parts.reduce((sum, p) => sum + p.floor, 0)

  const byRemainderDesc = [...parts].sort((a, b) => b.remainder - a.remainder)
  const result = new Map<string, number>()
  for (const p of parts) result.set(p.memberId, p.floor)

  for (let i = 0; remainder > 0 && i < byRemainderDesc.length; i++, remainder--) {
    const memberId = byRemainderDesc[i].memberId
    result.set(memberId, (result.get(memberId) ?? 0) + 1)
  }

  const signed = new Map<string, Cents>()
  for (const [memberId, amount] of result) {
    signed.set(memberId, (sign * amount) as Cents)
  }
  return signed
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
  return allocate(value, shares).get(view.memberId) ?? (0 as Cents)
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
