import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'periodLabel' })
export class PeriodLabelPipe implements PipeTransform {
  private static readonly months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  /** FY quarter start months (0-indexed): Q1=Jul, Q2=Oct, Q3=Jan, Q4=Apr */
  private static readonly fyQuarterStart: Record<string, [number, number]> = {
    'Q1': [6, -1],  // Jul (year-1) – Sep (year-1)
    'Q2': [9, -1],  // Oct (year-1) – Dec (year-1)
    'Q3': [0, 0],   // Jan (year)   – Mar (year)
    'Q4': [3, 0],   // Apr (year)   – Jun (year)
  };

  /** CY quarter start months (0-indexed) */
  private static readonly cyQuarterStart: Record<string, number> = {
    'Q1': 0,  // Jan–Mar
    'Q2': 3,  // Apr–Jun
    'Q3': 6,  // Jul–Sep
    'Q4': 9,  // Oct–Dec
  };

  transform(period: string, showDateRange = false): string {
    if (!period) return '';
    // FY2026-Q3 → FY 2026 Q3
    const match = period.match(/^(CY|FY)(\d{4})(?:-(Q[1-4]))?$/);
    if (!match) return period;
    const [, convention, yearStr, quarter] = match;
    const year = parseInt(yearStr, 10);
    const label = quarter ? `${convention} ${yearStr} ${quarter}` : `${convention} ${yearStr}`;

    if (!showDateRange) return label;

    const m = PeriodLabelPipe.months;

    if (quarter) {
      if (convention === 'FY') {
        const [startMonth, yearOffset] = PeriodLabelPipe.fyQuarterStart[quarter];
        const startYear = year + yearOffset;
        return `${label} (${m[startMonth]}\u2013${m[startMonth + 2]} ${startYear})`;
      } else {
        const startMonth = PeriodLabelPipe.cyQuarterStart[quarter];
        return `${label} (${m[startMonth]}\u2013${m[startMonth + 2]} ${year})`;
      }
    }

    // Full year range
    if (convention === 'FY') {
      return `${label} (${m[6]} ${year - 1}\u2013${m[5]} ${year})`;
    } else {
      return `${label} (${m[0]} ${year}\u2013${m[11]} ${year})`;
    }
  }
}
