import { Component, ChangeDetectionStrategy, input, computed, inject } from '@angular/core';
import { LocaleService } from '../../core/locale/locale.service';

@Component({
  selector: 'app-currency',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="cssClass()">{{ formatted() }}</span>`,
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

  protected formatted = computed(() =>
    new Intl.NumberFormat(this.localeService.locale(), {
      style: 'currency',
      currency: this.effectiveCurrency(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(this.value())
  );

  protected cssClass = computed(() => {
    if (!this.colorize()) return '';
    return this.value() >= 0 ? 'positive' : 'negative';
  });
}
