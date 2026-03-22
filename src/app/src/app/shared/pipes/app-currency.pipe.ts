import { Pipe, PipeTransform, inject } from '@angular/core';
import { LocaleService } from '../../core/locale/locale.service';

@Pipe({ name: 'appCurrency', standalone: true })
export class AppCurrencyPipe implements PipeTransform {
  private localeService = inject(LocaleService);

  transform(value: number | string | null | undefined, digitsInfo?: string): string | null {
    if (value == null) return null;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return null;
    const [minInt, fracRange] = (digitsInfo ?? '1.2-2').split('.');
    const [minFrac, maxFrac] = (fracRange ?? '2-2').split('-').map(Number);
    return new Intl.NumberFormat(this.localeService.locale(), {
      style: 'currency',
      currency: this.localeService.currency(),
      minimumIntegerDigits: parseInt(minInt) || 1,
      minimumFractionDigits: minFrac ?? 2,
      maximumFractionDigits: maxFrac ?? 2,
    }).format(num);
  }
}
