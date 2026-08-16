import { roundToCents, type Cents } from './money'

export type EntityType = 'asset' | 'liability'

export interface ProjectionEntity {
  id: string
  label: string
  category: string
  entityType: EntityType
  currentValue: Cents
  annualContribution: Cents
  returnRate: number
  volatility: number
  interestRate: number
  contributionEndDate: string | null
}

export interface ProjectionOptions {
  horizon: number
  inflationRate?: number
  /** Injected for determinism; defaults to the current UTC year. */
  startYear?: number
}

export interface CompoundYear {
  year: number
  assets: Cents
  liabilities: Cents
  netWorth: Cents
}

export interface EntityYear {
  year: number
  value: Cents
}

export interface EntityProjection {
  id: string
  label: string
  category: string
  entityType: EntityType
  years: EntityYear[]
}

export interface CompoundResult {
  horizon: number
  years: CompoundYear[]
  entities: EntityProjection[]
}

// --- shared helpers ---

function inflationDiscount(inflationRate: number, years: number): number {
  return inflationRate > 0 ? 1 / Math.pow(1 + inflationRate, years) : 1
}

/** Contributions stop after the calendar year containing the end date. */
function contributionFor(entity: ProjectionEntity, year: number): number {
  if (entity.contributionEndDate) {
    const endYear = Number(entity.contributionEndDate.slice(0, 4))
    if (Number.isFinite(endYear) && year > endYear) return 0
  }
  return entity.annualContribution
}

function defaultStartYear(): number {
  return new Date().getUTCFullYear()
}

// --- compound growth ---

export function runCompound(
  entities: ProjectionEntity[],
  options: ProjectionOptions,
): CompoundResult {
  const { horizon } = options
  const inflationRate = options.inflationRate ?? 0
  const startYear = options.startYear ?? defaultStartYear()

  const totals: { assets: number; liabilities: number }[] =
    Array.from({ length: horizon + 1 }, () => ({ assets: 0, liabilities: 0 }))

  const entityResults: EntityProjection[] = entities.map((entity) => {
    const years: EntityYear[] = []
    let value: number = entity.currentValue

    for (let y = 0; y <= horizon; y++) {
      const discount = inflationDiscount(inflationRate, y)
      years.push({ year: startYear + y, value: roundToCents(value * discount) })

      if (entity.entityType === 'asset') totals[y].assets += value
      else totals[y].liabilities += value

      if (y < horizon) {
        const contribution = contributionFor(entity, startYear + y)
        value = entity.entityType === 'asset'
          ? value * (1 + entity.returnRate) + contribution
          : Math.max(0, value * (1 + entity.interestRate) - contribution)
      }
    }

    return {
      id: entity.id,
      label: entity.label,
      category: entity.category,
      entityType: entity.entityType,
      years,
    }
  })

  const years: CompoundYear[] = totals.map((total, y) => {
    const discount = inflationDiscount(inflationRate, y)
    return {
      year: startYear + y,
      assets: roundToCents(total.assets * discount),
      liabilities: roundToCents(total.liabilities * discount),
      netWorth: roundToCents((total.assets - total.liabilities) * discount),
    }
  })

  return { horizon, years, entities: entityResults }
}

// --- scenario ---

export interface ScenarioValues {
  assets: Cents
  liabilities: Cents
  netWorth: Cents
}

export interface ScenarioYear {
  year: number
  pessimistic: ScenarioValues
  base: ScenarioValues
  optimistic: ScenarioValues
}

export interface ScenarioEntityYear {
  year: number
  pessimistic: Cents
  base: Cents
  optimistic: Cents
}

export interface ScenarioEntityProjection {
  id: string
  label: string
  category: string
  entityType: EntityType
  years: ScenarioEntityYear[]
}

export interface ScenarioResult {
  horizon: number
  years: ScenarioYear[]
  entities: ScenarioEntityProjection[]
}

/** Pessimistic and optimistic bands around the entity's base return rate. */
function scenarioRates(entity: ProjectionEntity): {
  pessimistic: number
  base: number
  optimistic: number
} {
  const base = entity.returnRate
  if (base > 0) {
    return {
      pessimistic: Math.max(base * 0.5, base - 0.03),
      base,
      optimistic: Math.min(base * 1.5, base + 0.03),
    }
  }
  return { pessimistic: base - 0.03, base, optimistic: base + 0.03 }
}

export function runScenario(
  entities: ProjectionEntity[],
  options: ProjectionOptions,
): ScenarioResult {
  const { horizon } = options
  const inflationRate = options.inflationRate ?? 0
  const startYear = options.startYear ?? defaultStartYear()

  interface Totals { assets: number; liabilities: number }
  const totals: { pessimistic: Totals; base: Totals; optimistic: Totals }[] =
    Array.from({ length: horizon + 1 }, () => ({
      pessimistic: { assets: 0, liabilities: 0 },
      base: { assets: 0, liabilities: 0 },
      optimistic: { assets: 0, liabilities: 0 },
    }))

  const entityResults: ScenarioEntityProjection[] = entities.map((entity) => {
    const rates = scenarioRates(entity)
    const years: ScenarioEntityYear[] = []
    let pessimistic: number = entity.currentValue
    let base: number = entity.currentValue
    let optimistic: number = entity.currentValue

    for (let y = 0; y <= horizon; y++) {
      const discount = inflationDiscount(inflationRate, y)
      years.push({
        year: startYear + y,
        pessimistic: roundToCents(pessimistic * discount),
        base: roundToCents(base * discount),
        optimistic: roundToCents(optimistic * discount),
      })

      const bucket = entity.entityType === 'asset' ? 'assets' : 'liabilities'
      totals[y].pessimistic[bucket] += pessimistic
      totals[y].base[bucket] += base
      totals[y].optimistic[bucket] += optimistic

      if (y < horizon) {
        const contribution = contributionFor(entity, startYear + y)
        if (entity.entityType === 'asset') {
          pessimistic = pessimistic * (1 + rates.pessimistic) + contribution
          base = base * (1 + rates.base) + contribution
          optimistic = optimistic * (1 + rates.optimistic) + contribution
        } else {
          const rate = entity.interestRate
          pessimistic = Math.max(0, pessimistic * (1 + rate) - contribution)
          base = Math.max(0, base * (1 + rate) - contribution)
          optimistic = Math.max(0, optimistic * (1 + rate) - contribution)
        }
      }
    }

    return {
      id: entity.id,
      label: entity.label,
      category: entity.category,
      entityType: entity.entityType,
      years,
    }
  })

  const years: ScenarioYear[] = totals.map((total, y) => {
    const discount = inflationDiscount(inflationRate, y)
    const toValues = (t: Totals): ScenarioValues => ({
      assets: roundToCents(t.assets * discount),
      liabilities: roundToCents(t.liabilities * discount),
      netWorth: roundToCents((t.assets - t.liabilities) * discount),
    })
    return {
      year: startYear + y,
      pessimistic: toValues(total.pessimistic),
      base: toValues(total.base),
      optimistic: toValues(total.optimistic),
    }
  })

  return { horizon, years, entities: entityResults }
}

// --- Monte Carlo ---

export interface Percentiles {
  year: number
  p10: Cents
  p25: Cents
  p50: Cents
  p75: Cents
  p90: Cents
}

export interface MonteCarloEntityProjection {
  id: string
  label: string
  category: string
  entityType: EntityType
  years: Percentiles[]
}

export interface MonteCarloResult {
  horizon: number
  simulations: number
  years: Percentiles[]
  entities: MonteCarloEntityProjection[]
}

export interface MonteCarloOptions extends ProjectionOptions {
  simulations?: number
  /** Injected for determinism; defaults to Math.random. */
  random?: () => number
}

/** Box-Muller transform. */
function sampleNormal(random: () => number, mean: number, stdDev: number): number {
  const u1 = 1 - random()
  const u2 = 1 - random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + stdDev * z
}

/** Linear interpolation between the two nearest ranks of a sorted array. */
function percentile(sorted: number[], p: number): number {
  const index = p * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  const frac = index - lower
  return sorted[lower] * (1 - frac) + sorted[upper] * frac
}

function percentilesFor(values: number[], year: number, discount: number): Percentiles {
  const sorted = [...values].sort((a, b) => a - b)
  return {
    year,
    p10: roundToCents(percentile(sorted, 0.10) * discount),
    p25: roundToCents(percentile(sorted, 0.25) * discount),
    p50: roundToCents(percentile(sorted, 0.50) * discount),
    p75: roundToCents(percentile(sorted, 0.75) * discount),
    p90: roundToCents(percentile(sorted, 0.90) * discount),
  }
}

export function runMonteCarlo(
  entities: ProjectionEntity[],
  options: MonteCarloOptions,
): MonteCarloResult {
  const { horizon } = options
  const inflationRate = options.inflationRate ?? 0
  const startYear = options.startYear ?? defaultStartYear()
  const random = options.random ?? Math.random
  const simulations = Math.min(10_000, Math.max(100, options.simulations ?? 1_000))

  const netWorthByYear: number[][] =
    Array.from({ length: horizon + 1 }, () => new Array<number>(simulations).fill(0))

  const entityValuesByYear: number[][][] = entities.map(() =>
    Array.from({ length: horizon + 1 }, () => new Array<number>(simulations).fill(0)),
  )

  for (let sim = 0; sim < simulations; sim++) {
    for (let e = 0; e < entities.length; e++) {
      const entity = entities[e]
      let value: number = entity.currentValue

      for (let y = 0; y <= horizon; y++) {
        entityValuesByYear[e][y][sim] = value
        netWorthByYear[y][sim] += entity.entityType === 'asset' ? value : -value

        if (y < horizon) {
          const contribution = contributionFor(entity, startYear + y)
          if (entity.entityType === 'asset') {
            // Convert geometric (CAGR) to arithmetic mean before sampling.
            const arithmeticMean =
              entity.returnRate + (entity.volatility * entity.volatility) / 2
            const sampled = sampleNormal(random, arithmeticMean, entity.volatility)
            value = Math.max(0, value * (1 + sampled) + contribution)
          } else {
            value = Math.max(0, value * (1 + entity.interestRate) - contribution)
          }
        }
      }
    }
  }

  const years = netWorthByYear.map((values, y) =>
    percentilesFor(values, startYear + y, inflationDiscount(inflationRate, y)),
  )

  const entityProjections: MonteCarloEntityProjection[] = entities.map((entity, e) => ({
    id: entity.id,
    label: entity.label,
    category: entity.category,
    entityType: entity.entityType,
    years: entityValuesByYear[e].map((values, y) =>
      percentilesFor(values, startYear + y, inflationDiscount(inflationRate, y)),
    ),
  }))

  return { horizon, simulations, years, entities: entityProjections }
}
