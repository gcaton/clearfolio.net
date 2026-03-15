import { Component, ChangeDetectionStrategy, inject, signal, output, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { ApiService } from '../../core/api/api.service';

@Component({
  selector: 'app-period-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Select],
  template: `
    <p-select
      [(ngModel)]="selected"
      [options]="periods()"
      placeholder="Select period"
      (ngModelChange)="periodChange.emit($event)"
    />
  `,
})
export class PeriodSelectorComponent implements OnInit {
  private api = inject(ApiService);
  protected periods = signal<string[]>([]);
  protected selected = '';

  periodChange = output<string>();

  ngOnInit() {
    this.api.getPeriods().subscribe((periods) => {
      this.periods.set(periods);
      if (periods.length > 0) {
        this.selected = periods[0];
        this.periodChange.emit(periods[0]);
      }
    });
  }
}
