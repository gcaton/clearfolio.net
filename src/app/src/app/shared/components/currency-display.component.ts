import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-currency',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe],
  template: `<span [class]="cssClass()">{{ value() | currency: currency() : 'symbol-narrow' : '1.0-0' }}</span>`,
  styles: `
    .positive { color: var(--p-green-600, #16a34a); }
    .negative { color: var(--p-red-600, #dc2626); }
  `,
})
export class CurrencyDisplayComponent {
  value = input.required<number>();
  currency = input<string>('AUD');
  colorize = input<boolean>(false);

  protected cssClass = computed(() => {
    if (!this.colorize()) return '';
    return this.value() >= 0 ? 'positive' : 'negative';
  });
}
