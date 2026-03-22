import { Pipe, PipeTransform, inject } from '@angular/core';
import { LocaleService } from '../../core/locale/locale.service';

const FORMAT_MAP: Record<string, Intl.DateTimeFormatOptions> = {
  mediumDate: { year: 'numeric', month: 'short', day: 'numeric' },
  shortDate: { year: 'numeric', month: 'numeric', day: 'numeric' },
  longDate: { year: 'numeric', month: 'long', day: 'numeric' },
};

@Pipe({ name: 'appDate', standalone: true })
export class AppDatePipe implements PipeTransform {
  private localeService = inject(LocaleService);

  transform(value: string | number | Date | null | undefined, format?: string): string | null {
    if (value == null) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return null;
    const options = FORMAT_MAP[format ?? 'mediumDate'] ?? FORMAT_MAP['mediumDate'];
    return new Intl.DateTimeFormat(this.localeService.locale(), options).format(date);
  }
}
