import { Component, ChangeDetectionStrategy, inject, input, output, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { Button } from 'primeng/button';
import { ApiService } from '../../core/api/api.service';

@Component({
  selector: 'app-record-value-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DialogModule, InputNumber, Select, Button],
  template: `
    <p-dialog
      header="Record Value"
      [(visible)]="dialogVisible"
      [modal]="true"
      [style]="{ width: '350px' }"
    >
      <div class="form-grid">
        <label>{{ entityLabel() }}</label>

        <label for="rvPeriod">Period</label>
        <p-select
          id="rvPeriod"
          [(ngModel)]="period"
          [options]="periodOptions"
          placeholder="Select period"
        />

        <label for="rvValue">Value</label>
        <p-inputnumber
          id="rvValue"
          [(ngModel)]="value"
          mode="currency"
          currency="AUD"
          locale="en-AU"
        />
      </div>

      <ng-template #footer>
        <p-button label="Cancel" [text]="true" (onClick)="dialogVisible.set(false)" />
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
export class RecordValueDialogComponent implements OnInit {
  private api = inject(ApiService);

  entityId = input<string>('');
  entityType = input<string>('');
  entityLabel = input<string>('');
  currency = input<string>('AUD');

  saved = output<void>();

  dialogVisible = signal(false);
  period = '';
  value: number | null = null;
  periodOptions: string[] = [];

  ngOnInit() {
    this.api.getHousehold().subscribe((h) => {
      const convention = h.preferredPeriodType || 'FY';
      this.periodOptions = this.buildPeriodOptions(convention);
    });
  }

  private buildPeriodOptions(convention: string): string[] {
    const periods: string[] = [];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const startYear = currentYear - 4;

    if (convention === 'FY') {
      const fyEnd = currentMonth >= 7 ? currentYear + 1 : currentYear;
      const currentQ = currentMonth >= 7 && currentMonth <= 9 ? 1
        : currentMonth >= 10 && currentMonth <= 12 ? 2
        : currentMonth >= 1 && currentMonth <= 3 ? 3 : 4;

      for (let year = startYear; year <= fyEnd; year++) {
        for (let q = 1; q <= 4; q++) {
          if (year === fyEnd && q > currentQ) break;
          periods.push(`FY${year}-Q${q}`);
        }
      }
    } else {
      const currentQ = Math.ceil(currentMonth / 3);
      for (let year = startYear; year <= currentYear; year++) {
        for (let q = 1; q <= 4; q++) {
          if (year === currentYear && q > currentQ) break;
          periods.push(`CY${year}-Q${q}`);
        }
      }
    }

    return periods.reverse();
  }

  open(currentPeriod?: string) {
    this.period = currentPeriod ?? '';
    this.value = null;
    this.dialogVisible.set(true);
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
      this.dialogVisible.set(false);
      this.saved.emit();
    });
  }
}
