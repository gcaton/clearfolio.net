export type PeriodConvention = 'FY' | 'CY'
export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'

const PERIOD_PATTERN = /^(CY|FY)(\d{4})(?:-(Q[1-4]))?$/

interface ParsedPeriod {
  convention: PeriodConvention
  year: number
  quarter: Quarter | null
}

function parse(period: string): ParsedPeriod {
  const match = PERIOD_PATTERN.exec(period)
  if (!match) throw new Error(`Invalid period format: ${period}`)
  return {
    convention: match[1] as PeriodConvention,
    year: Number(match[2]),
    quarter: (match[3] as Quarter | undefined) ?? null,
  }
}

function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** First day of the given period, as an ISO YYYY-MM-DD date. */
export function periodStart(period: string): string {
  const { convention, year, quarter } = parse(period)

  if (convention === 'FY') {
    switch (quarter) {
      case 'Q1': return isoDate(year - 1, 7, 1)
      case 'Q2': return isoDate(year - 1, 10, 1)
      case 'Q3': return isoDate(year, 1, 1)
      case 'Q4': return isoDate(year, 4, 1)
      default: return isoDate(year - 1, 7, 1) // full FY starts July, prior year
    }
  }

  switch (quarter) {
    case 'Q1': return isoDate(year, 1, 1)
    case 'Q2': return isoDate(year, 4, 1)
    case 'Q3': return isoDate(year, 7, 1)
    case 'Q4': return isoDate(year, 10, 1)
    default: return isoDate(year, 1, 1)
  }
}

/** `today` is injectable so callers and tests are deterministic. */
export function currentPeriod(
  convention: PeriodConvention,
  today: Date = new Date(),
): string {
  const year = today.getUTCFullYear()
  const month = today.getUTCMonth() + 1 // 1-12

  if (convention === 'FY') {
    const fyYear = month >= 7 ? year + 1 : year
    const quarter =
      month >= 7 && month <= 9 ? 'Q1' :
      month >= 10 ? 'Q2' :
      month <= 3 ? 'Q3' : 'Q4'
    return `FY${fyYear}-${quarter}`
  }

  const quarter =
    month <= 3 ? 'Q1' :
    month <= 6 ? 'Q2' :
    month <= 9 ? 'Q3' : 'Q4'
  return `CY${year}-${quarter}`
}

export function previousPeriod(period: string): string {
  const { convention, year, quarter } = parse(period)
  if (quarter === null) return `${convention}${year - 1}`

  switch (quarter) {
    case 'Q1': return `${convention}${year - 1}-Q4`
    case 'Q2': return `${convention}${year}-Q1`
    case 'Q3': return `${convention}${year}-Q2`
    case 'Q4': return `${convention}${year}-Q3`
  }
}

export function nextPeriod(period: string): string {
  const { convention, year, quarter } = parse(period)
  if (quarter === null) return `${convention}${year + 1}`

  switch (quarter) {
    case 'Q1': return `${convention}${year}-Q2`
    case 'Q2': return `${convention}${year}-Q3`
    case 'Q3': return `${convention}${year}-Q4`
    case 'Q4': return `${convention}${year + 1}-Q1`
  }
}

export function sameQuarterPriorYear(period: string): string {
  const { convention, year, quarter } = parse(period)
  return `${convention}${year - 1}${quarter ? `-${quarter}` : ''}`
}

/** `count` periods ending at `period`, oldest first. */
export function previousPeriods(period: string, count: number): string[] {
  const periods: string[] = []
  let current = period
  for (let i = 0; i < count; i++) {
    periods.push(current)
    current = previousPeriod(current)
  }
  return periods.reverse()
}
