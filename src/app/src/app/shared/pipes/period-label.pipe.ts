import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'periodLabel' })
export class PeriodLabelPipe implements PipeTransform {
  private static readonly quarterLabels: Record<string, string> = {
    'Q1': 'Q1',
    'Q2': 'Q2',
    'Q3': 'Q3',
    'Q4': 'Q4',
  };

  transform(period: string): string {
    if (!period) return '';
    // FY2026-Q3 → FY 2026 Q3
    const match = period.match(/^(CY|FY)(\d{4})(?:-(Q[1-4]))?$/);
    if (!match) return period;
    const [, convention, year, quarter] = match;
    return quarter ? `${convention} ${year} ${quarter}` : `${convention} ${year}`;
  }
}
