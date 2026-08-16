import { describe, it, expect } from 'vitest'
import { cents } from './money'
import {
  TOTAL_BP, soleOwnership, jointOwnership, assertSharesValid,
  shareBpForMember, applyViewFilter, normaliseShares,
} from './ownership'

const ALICE = 'alice-id'
const BOB = 'bob-id'
const CAROL = 'carol-id'

describe('constructors', () => {
  it('sole ownership is a single full share', () => {
    expect(soleOwnership(ALICE)).toEqual([{ memberId: ALICE, shareBp: TOTAL_BP }])
  })

  it('joint ownership splits between two members', () => {
    expect(jointOwnership(ALICE, BOB, 6_000)).toEqual([
      { memberId: ALICE, shareBp: 6_000 },
      { memberId: BOB, shareBp: 4_000 },
    ])
  })

  it('joint ownership defaults to an even split', () => {
    expect(jointOwnership(ALICE, BOB, 5_000)).toEqual([
      { memberId: ALICE, shareBp: 5_000 },
      { memberId: BOB, shareBp: 5_000 },
    ])
  })
})

describe('assertSharesValid', () => {
  it('accepts shares summing to 10000', () => {
    expect(() => assertSharesValid(jointOwnership(ALICE, BOB, 3_333))).not.toThrow()
  })

  it('accepts three members — no two-person ceiling', () => {
    expect(() => assertSharesValid([
      { memberId: ALICE, shareBp: 5_000 },
      { memberId: BOB, shareBp: 3_000 },
      { memberId: CAROL, shareBp: 2_000 },
    ])).not.toThrow()
  })

  it('rejects shares that do not sum to 10000', () => {
    expect(() => assertSharesValid([{ memberId: ALICE, shareBp: 9_999 }]))
      .toThrow(/10000/)
  })

  it('rejects an empty share list', () => {
    expect(() => assertSharesValid([])).toThrow(/at least one/i)
  })

  it('rejects duplicate members', () => {
    expect(() => assertSharesValid([
      { memberId: ALICE, shareBp: 5_000 },
      { memberId: ALICE, shareBp: 5_000 },
    ])).toThrow(/duplicate/i)
  })

  it('rejects negative shares', () => {
    expect(() => assertSharesValid([
      { memberId: ALICE, shareBp: 12_000 },
      { memberId: BOB, shareBp: -2_000 },
    ])).toThrow(/negative/i)
  })
})

describe('shareBpForMember', () => {
  it('returns the member share', () => {
    expect(shareBpForMember(jointOwnership(ALICE, BOB, 6_000), BOB)).toBe(4_000)
  })

  it('returns zero for a member with no share', () => {
    expect(shareBpForMember(soleOwnership(ALICE), BOB)).toBe(0)
  })
})

describe('applyViewFilter', () => {
  const value = cents(100_000)

  it('household view returns the full value', () => {
    const shares = jointOwnership(ALICE, BOB, 6_000)
    expect(applyViewFilter(value, shares, { kind: 'household' })).toBe(100_000)
  })

  it('member view returns that member share', () => {
    const shares = jointOwnership(ALICE, BOB, 6_000)
    expect(applyViewFilter(value, shares, { kind: 'member', memberId: ALICE })).toBe(60_000)
    expect(applyViewFilter(value, shares, { kind: 'member', memberId: BOB })).toBe(40_000)
  })

  it('returns zero for a member with no share', () => {
    expect(applyViewFilter(value, soleOwnership(ALICE), { kind: 'member', memberId: BOB }))
      .toBe(0)
  })

  it('sole ownership gives the owner the full value', () => {
    expect(applyViewFilter(value, soleOwnership(ALICE), { kind: 'member', memberId: ALICE }))
      .toBe(100_000)
  })

  it('member views sum to the household view', () => {
    // Not evenly divisible across the shares, so this actually exercises the
    // rounding path — cents(100_000) would divide evenly and pass trivially.
    const unevenValue = cents(100_001)
    const shares = [
      { memberId: ALICE, shareBp: 3_333 },
      { memberId: BOB, shareBp: 3_333 },
      { memberId: CAROL, shareBp: 3_334 },
    ]
    const household = applyViewFilter(unevenValue, shares, { kind: 'household' })
    const sum =
      applyViewFilter(unevenValue, shares, { kind: 'member', memberId: ALICE }) +
      applyViewFilter(unevenValue, shares, { kind: 'member', memberId: BOB }) +
      applyViewFilter(unevenValue, shares, { kind: 'member', memberId: CAROL })
    expect(sum).toBe(household)
  })

  it('member views sum to the household view for a negative value', () => {
    const unevenValue = cents(-100_001)
    const shares = [
      { memberId: ALICE, shareBp: 3_333 },
      { memberId: BOB, shareBp: 3_333 },
      { memberId: CAROL, shareBp: 3_334 },
    ]
    const household = applyViewFilter(unevenValue, shares, { kind: 'household' })
    const sum =
      applyViewFilter(unevenValue, shares, { kind: 'member', memberId: ALICE }) +
      applyViewFilter(unevenValue, shares, { kind: 'member', memberId: BOB }) +
      applyViewFilter(unevenValue, shares, { kind: 'member', memberId: CAROL })
    expect(sum).toBe(household)
  })

  it('member views sum to the household view across a wider split with larger remainders', () => {
    const unevenValue = cents(100_007)
    const shares = [
      { memberId: 'm1', shareBp: 2_000 },
      { memberId: 'm2', shareBp: 2_000 },
      { memberId: 'm3', shareBp: 2_000 },
      { memberId: 'm4', shareBp: 2_000 },
      { memberId: 'm5', shareBp: 2_000 },
    ]
    const household = applyViewFilter(unevenValue, shares, { kind: 'household' })
    const sum = shares.reduce(
      (total, s) =>
        total + applyViewFilter(unevenValue, shares, { kind: 'member', memberId: s.memberId }),
      0,
    )
    expect(sum).toBe(household)
  })
})

describe('normaliseShares', () => {
  it('leaves valid shares untouched', () => {
    const shares = jointOwnership(ALICE, BOB, 6_000)
    expect(normaliseShares(shares)).toEqual(shares)
  })

  it('rescales after a member is removed', () => {
    const remaining = [
      { memberId: ALICE, shareBp: 6_000 },
      { memberId: BOB, shareBp: 2_000 },
    ]
    const result = normaliseShares(remaining)
    expect(result.reduce((s, r) => s + r.shareBp, 0)).toBe(TOTAL_BP)
    expect(result[0].shareBp).toBe(7_500)
    expect(result[1].shareBp).toBe(2_500)
  })

  it('gives the remainder to the largest share so the total is exact', () => {
    const result = normaliseShares([
      { memberId: ALICE, shareBp: 1 },
      { memberId: BOB, shareBp: 1 },
      { memberId: CAROL, shareBp: 1 },
    ])
    expect(result.reduce((s, r) => s + r.shareBp, 0)).toBe(TOTAL_BP)
  })

  it('throws when nothing remains to rescale', () => {
    expect(() => normaliseShares([])).toThrow(/at least one/i)
  })
})
