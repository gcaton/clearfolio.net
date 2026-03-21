import { Component, ChangeDetectionStrategy, input, computed, signal, effect } from '@angular/core';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-currency',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe],
  template: `<span [class]="cssClass()">{{ displayValue() | currency: currency() : 'symbol-narrow' : '1.0-0' }}</span>`,
  styles: `
    :host { display: inline; }
    .positive { color: var(--p-green-600, #16a34a); }
    .negative { color: var(--p-red-600, #dc2626); }
  `,
})
export class CurrencyDisplayComponent {
  value = input.required<number>();
  currency = input<string>('AUD');
  colorize = input<boolean>(false);

  protected displayValue = signal(0);
  private animationFrame = 0;

  constructor() {
    effect(() => {
      const target = this.value();
      this.animateTo(target);
    });
  }

  protected cssClass = computed(() => {
    if (!this.colorize()) return '';
    return this.value() >= 0 ? 'positive' : 'negative';
  });

  private animateTo(target: number) {
    cancelAnimationFrame(this.animationFrame);
    const start = this.displayValue();
    const diff = target - start;

    // Skip animation for first load (from 0) or tiny changes
    if (start === 0 || Math.abs(diff) < 1) {
      this.displayValue.set(target);
      return;
    }

    const duration = 400;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      this.displayValue.set(Math.round(start + diff * eased));

      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(step);
      } else {
        this.displayValue.set(target);
      }
    };

    this.animationFrame = requestAnimationFrame(step);
  }
}
