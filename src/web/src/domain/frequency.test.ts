import { describe, it, expect } from 'vitest'
import { cents } from './money'
import { annualise, normaliseContribution } from './frequency'

describe('normaliseContribution', () => {
  it.each([
    ['weekly', 52],
    ['fortnightly', 26],
    ['monthly', 12],
    ['quarterly', 4],
    ['yearly', 1],
  ])('%s multiplies by %i', (frequency, multiplier) => {
    expect(normaliseContribution(cents(10_000), frequency)).toBe(10_000 * multiplier)
  })

  it('returns zero for a null amount', () => {
    expect(normaliseContribution(null, 'monthly')).toBe(0)
  })

  it('returns zero for a zero amount', () => {
    expect(normaliseContribution(cents(0), 'monthly')).toBe(0)
  })

  it('returns zero for a negative amount', () => {
    expect(normaliseContribution(cents(-10_000), 'monthly')).toBe(0)
  })

  it('returns zero for a null frequency', () => {
    expect(normaliseContribution(cents(10_000), null)).toBe(0)
  })

  it('returns zero for an unknown frequency', () => {
    expect(normaliseContribution(cents(10_000), 'biannually')).toBe(0)
  })

  it('matches frequency case-insensitively', () => {
    expect(normaliseContribution(cents(10_000), 'Monthly')).toBe(120_000)
  })
})

describe('annualise', () => {
  it('multiplies by the frequency', () => {
    expect(annualise(cents(50_000), 'quarterly')).toBe(200_000)
  })

  it('returns zero for an unknown frequency', () => {
    expect(annualise(cents(50_000), 'never')).toBe(0)
  })

  it('annualises negative amounts, unlike normaliseContribution', () => {
    expect(annualise(cents(-1_000), 'yearly')).toBe(-1_000)
  })
})
