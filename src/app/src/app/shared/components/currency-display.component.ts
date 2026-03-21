import { Component, ChangeDetectionStrategy, input, computed, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LocaleService } from '../../core/locale/locale.service';

@Component({
  selector: 'app-currency',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe],
  template: `<span [class]="cssClass()">{{ value() | currency: effectiveCurrency() : 'symbol-narrow' : '1.0-0' : effectiveLocale() }}</span>`,
  styles: `
    .positive { color: var(--p-green-600, #16a34a); }
    .negative { color: var(--p-red-600, #dc2626); }
  `,
})
export class CurrencyDisplayComponent {
  value = input.required<number>();
  currency = input<string>('');
  colorize = input<boolean>(false);

  private localeService = inject(LocaleService);
  protected effectiveCurrency = computed(() => this.currency() || this.localeService.currency());
  protected effectiveLocale = computed(() => this.localeService.locale());

  protected cssClass = computed(() => {
    if (!this.colorize()) return '';
    return this.value() >= 0 ? 'positive' : 'negative';
  });
}
