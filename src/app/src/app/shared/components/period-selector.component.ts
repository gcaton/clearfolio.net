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
    this.loadPeriods();
  }

  refresh(selectPeriod?: string) {
    this.loadPeriods(selectPeriod);
  }

  private loadPeriods(selectPeriod?: string) {
    this.api.getPeriods().subscribe((periods) => {
      this.periods.set(['ALL', ...periods]);
      const target = selectPeriod ?? (periods.length > 0 ? periods[0] : '');
      if (target && target !== this.selected) {
        this.selected = target;
        this.periodChange.emit(target);
      }
    });
  }
}
