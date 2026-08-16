import { describe, it, expect } from 'vitest'
import { cents } from './money'
import {
  runCompound, runScenario, runMonteCarlo, type ProjectionEntity,
} from './projection'

const START_YEAR = 2026

function makeAsset(overrides: Partial<ProjectionEntity> = {}): ProjectionEntity {
  return {
    id: 'asset-1',
    label: 'Test Asset',
    category: 'Investment',
    entityType: 'asset',
    currentValue: cents(10_000_000), // $100,000
    annualContribution: cents(0),
    returnRate: 0.07,
    volatility: 0.15,
    interestRate: 0,
    contributionEndDate: null,
    ...overrides,
  }
}

function makeLiability(overrides: Partial<ProjectionEntity> = {}): ProjectionEntity {
  return {
    id: 'liability-1',
    label: 'Test Loan',
    category: 'Mortgage',
    entityType: 'liability',
    currentValue: cents(5_000_000), // $50,000
    annualContribution: cents(1_000_000), // $10,000
    returnRate: 0,
    volatility: 0,
    interestRate: 0.05,
    contributionEndDate: null,
    ...overrides,
  }
}

/** Deterministic uniform source for Monte Carlo tests. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

describe('runCompound', () => {
  it('grows a single asset at its return rate', () => {
    const asset = makeAsset({ currentValue: cents(10_000_000), returnRate: 0.10 })
    const result = runCompound([asset], { horizon: 3, startYear: START_YEAR })

    expect(result.years).toHaveLength(4) // year 0 plus 3
    expect(result.years[0].assets).toBe(10_000_000)
    expect(result.years[1].assets).toBe(11_000_000)
    expect(result.years[2].assets).toBe(12_100_000)
    expect(result.years[3].assets).toBe(13_310_000)
  })

  it('adds contributions after growth', () => {
    const asset = makeAsset({
      currentValue: cents(10_000_000),
      returnRate: 0.10,
      annualContribution: cents(1_000_000),
    })
    const result = runCompound([asset], { horizon: 1, startYear: START_YEAR })

    expect(result.years[0].assets).toBe(10_000_000)
    expect(result.years[1].assets).toBe(12_000_000) // 100k * 1.10 + 10k
  })

  it('decreases a liability with payments', () => {
    const liability = makeLiability({
      currentValue: cents(5_000_000),
      annualContribution: cents(1_000_000),
      interestRate: 0.05,
    })
    const result = runCompound([liability], { horizon: 1, startYear: START_YEAR })

    expect(result.years[0].liabilities).toBe(5_000_000)
    expect(result.years[1].liabilities).toBe(4_250_000) // 50k * 1.05 - 10k
  })

  it('floors a liability at zero', () => {
    const liability = makeLiability({
      currentValue: cents(500_000),
      annualContribution: cents(1_000_000),
      interestRate: 0,
    })
    const result = runCompound([liability], { horizon: 1, startYear: START_YEAR })

    expect(result.years[1].liabilities).toBe(0)
  })

  it('reports net worth as assets minus liabilities', () => {
    const asset = makeAsset({ currentValue: cents(10_000_000), returnRate: 0 })
    const liability = makeLiability({
      currentValue: cents(4_000_000),
      annualContribution: cents(0),
      interestRate: 0,
    })
    const result = runCompound([asset, liability], { horizon: 1, startYear: START_YEAR })

    expect(result.years[0].netWorth).toBe(6_000_000)
  })

  it('discounts future values by inflation', () => {
    const asset = makeAsset({ currentValue: cents(10_000_000), returnRate: 0 })
    const result = runCompound([asset], {
      horizon: 1, inflationRate: 0.03, startYear: START_YEAR,
    })

    expect(result.years[0].assets).toBe(10_000_000) // year 0 undiscounted
    expect(result.years[1].assets).toBe(9_708_738)  // 100,000 / 1.03
  })

  it('stops contributions after the end date year', () => {
    const asset = makeAsset({
      currentValue: cents(10_000_000),
      returnRate: 0,
      annualContribution: cents(1_000_000),
      contributionEndDate: `${START_YEAR}-12-31`,
    })
    const result = runCompound([asset], { horizon: 2, startYear: START_YEAR })

    expect(result.years[1].assets).toBe(11_000_000) // contribution applies
    expect(result.years[2].assets).toBe(11_000_000) // contribution stopped
  })

  it('returns only current values at horizon zero', () => {
    const asset = makeAsset({ currentValue: cents(5_000_000) })
    const result = runCompound([asset], { horizon: 0, startYear: START_YEAR })

    expect(result.years).toHaveLength(1)
    expect(result.years[0].assets).toBe(5_000_000)
  })

  it('returns zeroes for no entities', () => {
    const result = runCompound([], { horizon: 2, startYear: START_YEAR })

    expect(result.years).toHaveLength(3)
    expect(result.years[0].netWorth).toBe(0)
    expect(result.years[2].netWorth).toBe(0)
  })

  it('returns per-entity projections', () => {
    const asset = makeAsset({ currentValue: cents(5_000_000), returnRate: 0.10 })
    const result = runCompound([asset], { horizon: 2, startYear: START_YEAR })

    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].label).toBe('Test Asset')
    expect(result.entities[0].entityType).toBe('asset')
    expect(result.entities[0].years).toHaveLength(3)
  })
})

describe('runScenario', () => {
  it('base case matches the compound projection', () => {
    const asset = makeAsset({ currentValue: cents(10_000_000), returnRate: 0.07 })
    const compound = runCompound([asset], { horizon: 3, startYear: START_YEAR })
    const scenario = runScenario([asset], { horizon: 3, startYear: START_YEAR })

    for (let i = 0; i <= 3; i++) {
      expect(scenario.years[i].base.assets).toBe(compound.years[i].assets)
    }
  })

  it('orders pessimistic below base below optimistic', () => {
    const asset = makeAsset({ currentValue: cents(10_000_000), returnRate: 0.07 })
    const result = runScenario([asset], { horizon: 5, startYear: START_YEAR })

    for (let i = 1; i <= 5; i++) {
      expect(result.years[i].pessimistic.assets).toBeLessThan(result.years[i].base.assets)
      expect(result.years[i].base.assets).toBeLessThan(result.years[i].optimistic.assets)
    }
  })

  it('declines a liability in every scenario when payments exceed interest', () => {
    const liability = makeLiability({
      currentValue: cents(10_000_000),
      annualContribution: cents(2_000_000),
      interestRate: 0.05,
    })
    const result = runScenario([liability], { horizon: 3, startYear: START_YEAR })

    for (let i = 1; i <= 3; i++) {
      expect(result.years[i].base.liabilities).toBeLessThan(result.years[0].base.liabilities)
    }
  })
})

describe('runMonteCarlo', () => {
  it('returns the expected structure', () => {
    const result = runMonteCarlo([makeAsset()], {
      horizon: 5, simulations: 100, startYear: START_YEAR, random: seededRandom(1),
    })

    expect(result.horizon).toBe(5)
    expect(result.years).toHaveLength(6)
    expect(result.simulations).toBe(100)
  })

  it('has all percentiles equal to the current value at year zero', () => {
    const asset = makeAsset({ currentValue: cents(10_000_000) })
    const result = runMonteCarlo([asset], {
      horizon: 3, simulations: 500, startYear: START_YEAR, random: seededRandom(2),
    })

    expect(result.years[0].p10).toBe(10_000_000)
    expect(result.years[0].p50).toBe(10_000_000)
    expect(result.years[0].p90).toBe(10_000_000)
  })

  it('orders percentiles', () => {
    const result = runMonteCarlo([makeAsset()], {
      horizon: 5, simulations: 1000, startYear: START_YEAR, random: seededRandom(3),
    })

    for (let i = 1; i <= 5; i++) {
      const y = result.years[i]
      expect(y.p10).toBeLessThanOrEqual(y.p25)
      expect(y.p25).toBeLessThanOrEqual(y.p50)
      expect(y.p50).toBeLessThanOrEqual(y.p75)
      expect(y.p75).toBeLessThanOrEqual(y.p90)
    }
  })

  it('clamps simulations to a minimum of 100', () => {
    const result = runMonteCarlo([makeAsset()], {
      horizon: 1, simulations: 10, startYear: START_YEAR, random: seededRandom(4),
    })
    expect(result.simulations).toBe(100)
  })

  it('clamps simulations to a maximum of 10000', () => {
    const result = runMonteCarlo([makeAsset()], {
      horizon: 1, simulations: 99_999, startYear: START_YEAR, random: seededRandom(5),
    })
    expect(result.simulations).toBe(10_000)
  })

  it('is deterministic at zero volatility', () => {
    const asset = makeAsset({
      currentValue: cents(10_000_000), returnRate: 0.10, volatility: 0,
    })
    const result = runMonteCarlo([asset], {
      horizon: 2, simulations: 200, startYear: START_YEAR, random: seededRandom(6),
    })

    expect(result.years[1].p10).toBe(result.years[1].p90)
    expect(result.years[2].p10).toBe(result.years[2].p90)
  })

  it('pins an exact p50 for a fixed seed (discriminates the CAGR-to-arithmetic conversion)', () => {
    // Guards the `+ volatility^2 / 2` geometric-to-arithmetic conversion in
    // sampleNormal's mean. With volatility 0.15 this term is 0.01125,
    // comparable in size to the 0.07 base return rate, so deleting it moves
    // this pinned value. The zero-volatility test above cannot catch that —
    // the term is multiplied by volatility^2, so it vanishes there by
    // construction.
    const asset = makeAsset({
      currentValue: cents(10_000_000), returnRate: 0.07, volatility: 0.15,
    })
    const result = runMonteCarlo([asset], {
      horizon: 5, simulations: 500, startYear: START_YEAR, random: seededRandom(42),
    })

    expect(result.years[5].p50).toBe(14_053_535)
  })

  it('is reproducible for a given seed', () => {
    const options = {
      horizon: 3, simulations: 200, startYear: START_YEAR,
    }
    const a = runMonteCarlo([makeAsset()], { ...options, random: seededRandom(7) })
    const b = runMonteCarlo([makeAsset()], { ...options, random: seededRandom(7) })

    expect(a.years).toEqual(b.years)
  })
})
