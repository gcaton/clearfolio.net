import { describe, it, expect } from 'vitest'
import {
  cents, fromDollars, toDollars, addCents, subCents,
  scaleCents, roundToCents, formatCents,
} from './money'

describe('cents', () => {
  it('accepts integers', () => {
    expect(cents(1234)).toBe(1234)
  })

  it('rejects non-integers', () => {
    expect(() => cents(12.5)).toThrow(/integer/i)
  })

  it('rejects non-finite values', () => {
    expect(() => cents(NaN)).toThrow()
    expect(() => cents(Infinity)).toThrow()
  })
})

describe('dollar conversion', () => {
  it('converts dollars to cents', () => {
    expect(fromDollars(100)).toBe(10_000)
    expect(fromDollars(1.99)).toBe(199)
  })

  it('rounds fractional cents half-up', () => {
    expect(fromDollars(0.005)).toBe(1)
  })

  it('converts cents back to dollars', () => {
    expect(toDollars(cents(10_000))).toBe(100)
    expect(toDollars(cents(199))).toBe(1.99)
  })
})

describe('arithmetic', () => {
  it('adds', () => {
    expect(addCents(cents(100), cents(250), cents(1))).toBe(351)
  })

  it('adds nothing to zero', () => {
    expect(addCents()).toBe(0)
  })

  it('subtracts, allowing negatives', () => {
    expect(subCents(cents(100), cents(250))).toBe(-150)
  })

  it('scales and rounds half-up', () => {
    expect(scaleCents(cents(10_000), 0.5)).toBe(5_000)
    expect(scaleCents(cents(101), 0.5)).toBe(51)
  })
})

describe('roundToCents', () => {
  it('rounds a float to whole cents', () => {
    expect(roundToCents(9_708_737.86)).toBe(9_708_738)
  })

  it('rounds halves up, not to even', () => {
    expect(roundToCents(2.5)).toBe(3)
    expect(roundToCents(3.5)).toBe(4)
  })
})

describe('formatCents', () => {
  it('formats AUD in en-AU', () => {
    expect(formatCents(cents(123_456), 'en-AU', 'AUD')).toBe('$1,234.56')
  })

  it('formats negatives', () => {
    expect(formatCents(cents(-5_000), 'en-AU', 'AUD')).toBe('-$50.00')
  })
})
