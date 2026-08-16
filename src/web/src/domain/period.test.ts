import { describe, it, expect } from 'vitest'
import {
  periodStart, currentPeriod, previousPeriod, nextPeriod,
  sameQuarterPriorYear, previousPeriods,
} from './period'

describe('periodStart — CY', () => {
  it.each([
    ['CY2025-Q1', '2025-01-01'],
    ['CY2025-Q2', '2025-04-01'],
    ['CY2025-Q3', '2025-07-01'],
    ['CY2025-Q4', '2025-10-01'],
  ])('%s starts %s', (period, expected) => {
    expect(periodStart(period)).toBe(expected)
  })

  it('full CY starts 1 January', () => {
    expect(periodStart('CY2025')).toBe('2025-01-01')
  })
})

describe('periodStart — FY', () => {
  it.each([
    ['FY2025-Q1', '2024-07-01'],
    ['FY2025-Q2', '2024-10-01'],
    ['FY2025-Q3', '2025-01-01'],
    ['FY2025-Q4', '2025-04-01'],
  ])('%s starts %s', (period, expected) => {
    expect(periodStart(period)).toBe(expected)
  })

  it('full FY starts 1 July of the prior year', () => {
    expect(periodStart('FY2025')).toBe('2024-07-01')
  })
})

describe('periodStart — validation', () => {
  it('throws on an invalid format', () => {
    expect(() => periodStart('invalid')).toThrow(/invalid period/i)
  })

  it('throws on an out-of-range quarter', () => {
    expect(() => periodStart('CY2025-Q5')).toThrow(/invalid period/i)
  })
})

describe('previousPeriod', () => {
  it.each([
    ['CY2025-Q2', 'CY2025-Q1'],
    ['CY2025-Q1', 'CY2024-Q4'],
    ['FY2025-Q1', 'FY2024-Q4'],
    ['FY2025-Q3', 'FY2025-Q2'],
  ])('%s → %s', (input, expected) => {
    expect(previousPeriod(input)).toBe(expected)
  })

  it('decreases the year for full-year periods', () => {
    expect(previousPeriod('CY2025')).toBe('CY2024')
    expect(previousPeriod('FY2025')).toBe('FY2024')
  })
})

describe('nextPeriod', () => {
  it.each([
    ['CY2025-Q1', 'CY2025-Q2'],
    ['CY2025-Q4', 'CY2026-Q1'],
    ['FY2025-Q4', 'FY2026-Q1'],
    ['FY2025-Q2', 'FY2025-Q3'],
  ])('%s → %s', (input, expected) => {
    expect(nextPeriod(input)).toBe(expected)
  })
})

describe('sameQuarterPriorYear', () => {
  it.each([
    ['CY2025-Q3', 'CY2024-Q3'],
    ['FY2025-Q1', 'FY2024-Q1'],
    ['CY2025', 'CY2024'],
  ])('%s → %s', (input, expected) => {
    expect(sameQuarterPriorYear(input)).toBe(expected)
  })
})

describe('previousPeriods', () => {
  it('returns the chain oldest-first', () => {
    expect(previousPeriods('CY2025-Q3', 4)).toEqual([
      'CY2024-Q4', 'CY2025-Q1', 'CY2025-Q2', 'CY2025-Q3',
    ])
  })

  it('crosses the FY year boundary', () => {
    expect(previousPeriods('FY2025-Q2', 3)).toEqual([
      'FY2024-Q4', 'FY2025-Q1', 'FY2025-Q2',
    ])
  })
})

describe('roundtrip', () => {
  it.each(['CY2025-Q1', 'CY2025-Q4', 'FY2025-Q1', 'FY2025-Q4'])(
    'next then previous returns %s',
    (period) => {
      expect(previousPeriod(nextPeriod(period))).toBe(period)
    },
  )
})

describe('currentPeriod', () => {
  it.each([
    [new Date(Date.UTC(2025, 7, 15)), 'FY2026-Q1'],  // August → FY starts in July
    [new Date(Date.UTC(2025, 10, 15)), 'FY2026-Q2'], // November
    [new Date(Date.UTC(2025, 1, 15)), 'FY2025-Q3'],  // February
    [new Date(Date.UTC(2025, 4, 15)), 'FY2025-Q4'],  // May
  ])('FY for %s', (today, expected) => {
    expect(currentPeriod('FY', today)).toBe(expected)
  })

  it.each([
    [new Date(Date.UTC(2025, 1, 15)), 'CY2025-Q1'],
    [new Date(Date.UTC(2025, 4, 15)), 'CY2025-Q2'],
    [new Date(Date.UTC(2025, 7, 15)), 'CY2025-Q3'],
    [new Date(Date.UTC(2025, 10, 15)), 'CY2025-Q4'],
  ])('CY for %s', (today, expected) => {
    expect(currentPeriod('CY', today)).toBe(expected)
  })

  // Boundary coverage: only mid-quarter months were exercised above, so an
  // off-by-one at the FY year-roll (month >= 7) or any quarter cut-over
  // would previously have survived unnoticed. Each pair below straddles one
  // boundary on consecutive calendar days.
  describe('boundaries — FY', () => {
    it.each([
      // [date, expected, boundary description]
      [new Date(Date.UTC(2025, 5, 30)), 'FY2025-Q4', 'June 30 — day before the FY year roll'],
      [new Date(Date.UTC(2025, 6, 1)), 'FY2026-Q1', 'July 1 — the FY year roll'],
      [new Date(Date.UTC(2025, 8, 30)), 'FY2026-Q1', 'Sep 30 — day before Q1→Q2'],
      [new Date(Date.UTC(2025, 9, 1)), 'FY2026-Q2', 'Oct 1 — Q1→Q2 cut-over'],
      [new Date(Date.UTC(2025, 11, 31)), 'FY2026-Q2', 'Dec 31 — day before Q2→Q3'],
      [new Date(Date.UTC(2026, 0, 1)), 'FY2026-Q3', 'Jan 1 — Q2→Q3 cut-over (calendar year rolls, FY does not)'],
      [new Date(Date.UTC(2026, 2, 31)), 'FY2026-Q3', 'Mar 31 — day before Q3→Q4'],
      [new Date(Date.UTC(2026, 3, 1)), 'FY2026-Q4', 'Apr 1 — Q3→Q4 cut-over'],
    ])('%s → %s (%s)', (today, expected) => {
      expect(currentPeriod('FY', today)).toBe(expected)
    })
  })

  describe('boundaries — CY', () => {
    it.each([
      [new Date(Date.UTC(2025, 5, 30)), 'CY2025-Q2', 'June 30 — day before Q2→Q3'],
      [new Date(Date.UTC(2025, 6, 1)), 'CY2025-Q3', 'July 1 — Q2→Q3 cut-over'],
      [new Date(Date.UTC(2025, 8, 30)), 'CY2025-Q3', 'Sep 30 — day before Q3→Q4'],
      [new Date(Date.UTC(2025, 9, 1)), 'CY2025-Q4', 'Oct 1 — Q3→Q4 cut-over'],
      [new Date(Date.UTC(2025, 11, 31)), 'CY2025-Q4', 'Dec 31 — day before the year roll'],
      [new Date(Date.UTC(2026, 0, 1)), 'CY2026-Q1', 'Jan 1 — the year roll'],
      [new Date(Date.UTC(2026, 2, 31)), 'CY2026-Q1', 'Mar 31 — day before Q1→Q2'],
      [new Date(Date.UTC(2026, 3, 1)), 'CY2026-Q2', 'Apr 1 — Q1→Q2 cut-over'],
    ])('%s → %s (%s)', (today, expected) => {
      expect(currentPeriod('CY', today)).toBe(expected)
    })
  })
})
