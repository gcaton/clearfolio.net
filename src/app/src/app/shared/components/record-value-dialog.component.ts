import { Component, ChangeDetectionStrategy, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { ApiService } from '../../core/api/api.service';

@Component({
  selector: 'app-record-value-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DialogModule, InputNumber, InputText, Button],
  template: `
    <p-dialog
      header="Record Value"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '350px' }"
    >
      <div class="form-grid">
        <label>{{ entityLabel() }}</label>

        <label for="period">Period</label>
        <input pInputText id="period" [(ngModel)]="period" placeholder="e.g. FY2026-Q3" />

        <label for="value">Value</label>
        <p-inputnumber
          id="value"
          [(ngModel)]="value"
          mode="currency"
          currency="AUD"
          locale="en-AU"
        />
      </div>

      <ng-template #footer>
        <p-button label="Cancel" [text]="true" (onClick)="visible = false" />
        <p-button label="Save" (onClick)="save()" [disabled]="!period || !value" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .form-grid {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      label { font-weight: 600; font-size: 0.875rem; color: var(--p-text-color); }
    }
  `,
})
export class RecordValueDialogComponent {
  private api = inject(ApiService);

  entityId = input<string>('');
  entityType = input<string>('');
  entityLabel = input<string>('');
  currency = input<string>('AUD');

  saved = output<void>();

  visible = false;
  period = '';
  value: number | null = null;

  open(currentPeriod?: string) {
    this.period = currentPeriod ?? '';
    this.value = null;
    this.visible = true;
  }

  save() {
    if (!this.value || !this.period) return;
    this.api.upsertSnapshot({
      entityId: this.entityId(),
      entityType: this.entityType(),
      period: this.period,
      value: this.value,
      currency: this.currency(),
      notes: null,
    }).subscribe(() => {
      this.visible = false;
      this.saved.emit();
    });
  }
}
