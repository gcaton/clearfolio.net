import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-net-worth-change',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DecimalPipe],
  template: `
    @if (change() !== null) {
      <span class="change-badge" [class]="direction()">
        <i [class]="'pi ' + (isUp() ? 'pi-arrow-up' : 'pi-arrow-down')"></i>
        {{ absChange() | currency: 'AUD' : 'symbol-narrow' : '1.0-0' }}
        @if (percent() !== null) {
          ({{ absPercent() | number: '1.1-1' }}%)
        }
      </span>
    }
  `,
  styles: `
    .change-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.8125rem;
      font-weight: 600;
      padding: 0.25rem 0.5rem;
      border-radius: 1rem;
    }
    .up {
      color: var(--p-green-700, #15803d);
      background: var(--p-green-50, #f0fdf4);
    }
    .down {
      color: var(--p-red-700, #b91c1c);
      background: var(--p-red-50, #fef2f2);
    }
  `,
})
export class NetWorthChangeComponent {
  change = input.required<number | null>();
  percent = input.required<number | null>();

  protected isUp = computed(() => (this.change() ?? 0) >= 0);
  protected direction = computed(() => this.isUp() ? 'up' : 'down');
  protected absChange = computed(() => Math.abs(this.change() ?? 0));
  protected absPercent = computed(() => Math.abs(this.percent() ?? 0));
}
