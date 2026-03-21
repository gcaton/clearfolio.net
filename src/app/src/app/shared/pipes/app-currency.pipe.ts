import { Pipe, PipeTransform, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LocaleService } from '../../core/locale/locale.service';

@Pipe({ name: 'appCurrency', standalone: true })
export class AppCurrencyPipe implements PipeTransform {
  private currencyPipe = new CurrencyPipe('en');
  private localeService = inject(LocaleService);

  transform(value: number | string | null | undefined, digitsInfo?: string): string | null {
    return this.currencyPipe.transform(
      value,
      this.localeService.currency(),
      'symbol',
      digitsInfo ?? '1.2-2',
      this.localeService.locale()
    );
  }
}
