import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { TableModule } from 'primeng/table';
import { Button } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PeriodSelectorComponent } from '../../shared/components/period-selector.component';
import { PeriodLabelPipe } from '../../shared/pipes/period-label.pipe';
import { AppDatePipe } from '../../shared/pipes/app-date.pipe';
import { ApiService } from '../../core/api/api.service';
import { LocaleService } from '../../core/locale/locale.service';
import { Snapshot, CreateSnapshotRequest } from '../../core/api/models';

interface SnapshotTarget {
  id: string;
  label: string;
  entityType: 'asset' | 'liability';
  currency: string;
}

interface BulkCell {
  entityId: string;
  entityType: 'asset' | 'liability';
  period: string;
  currency: string;
  value: number | null;
}

@Component({
  selector: 'app-snapshots',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, DecimalPipe, AppDatePipe, TableModule, Button, DialogModule,
    InputText, InputNumber, Select, Textarea, Tag, Toast, ConfirmDialog,
    PeriodSelectorComponent, PeriodLabelPipe,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './snapshots.component.html',
  styleUrl: './snapshots.component.scss',
})
export class SnapshotsComponent implements OnInit {
  private api = inject(ApiService);
  private confirmService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  protected localeService = inject(LocaleService);

  private periodSelector = viewChild<PeriodSelectorComponent>('periodSelector');

  protected snapshots = signal<Snapshot[]>([]);
  protected selectedPeriod = signal('');
  protected targets = signal<SnapshotTarget[]>([]);
  protected dialogVisible = signal(false);
  protected editing = signal<Snapshot | null>(null);
  protected periods = signal<string[]>([]);

  // Bulk entry
  protected bulkVisible = signal(false);
  protected bulkPeriods = signal<string[]>([]);
  protected bulkGrid = signal<BulkCell[]>([]);
  protected bulkStartYear = 2021;
  protected bulkConvention = 'FY';
  protected bulkSaving = signal(false);

  protected conventionOptions = [
    { label: 'Financial Year', value: 'FY' },
    { label: 'Calendar Year', value: 'CY' },
  ];

  protected startYearOptions: { label: string; value: number }[] = [];

  protected form: CreateSnapshotRequest = this.emptyForm();
  protected periodOptions: string[] = [];

  protected entityTypeOptions = [
    { label: 'Asset', value: 'asset' },
    { label: 'Liability', value: 'liability' },
  ];

  protected selectedEntityType = signal<'asset' | 'liability'>('asset');

  protected filteredTargets = computed(() => {
    const type = this.selectedEntityType();
    return this.targets().filter((t) => t.entityType === type);
  });

  constructor() {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= currentYear - 10; y--) {
      this.startYearOptions.push({ label: String(y), value: y });
    }
  }

  ngOnInit() {
    this.api.getPeriods().subscribe((p) => this.periods.set(p));
    this.loadTargets();
    this.api.getHousehold().subscribe((h) => {
      const convention = h.preferredPeriodType || 'FY';
      this.bulkConvention = convention;
      this.periodOptions = this.buildPeriodRange(convention, new Date().getFullYear() - 4).reverse();
    });
  }

  onPeriodChange(period: string) {
    this.selectedPeriod.set(period);
    this.loadSnapshots();
  }

  onEntityTypeChange(type: 'asset' | 'liability') {
    this.selectedEntityType.set(type);
    this.form.entityId = '';
  }

  openNew() {
    this.form = this.emptyForm();
    this.form.period = this.selectedPeriod() || '';
    this.selectedEntityType.set('asset');
    this.editing.set(null);
    this.dialogVisible.set(true);
  }

  openEdit(snapshot: Snapshot) {
    this.form = {
      entityId: snapshot.entityId,
      entityType: snapshot.entityType as 'asset' | 'liability',
      period: snapshot.period,
      value: snapshot.value,
      currency: snapshot.currency,
      notes: snapshot.notes,
    };
    this.editing.set(snapshot);
    this.dialogVisible.set(true);
  }

  save() {
    const current = this.editing();
    if (current) {
      this.api.updateSnapshot(current.id, {
        value: this.form.value,
        currency: this.form.currency,
        notes: this.form.notes,
      }).subscribe(() => {
        this.dialogVisible.set(false);
        this.loadSnapshots();
      });
    } else {
      const savedPeriod = this.form.period;
      this.api.upsertSnapshot(this.form).subscribe(() => {
        this.dialogVisible.set(false);
        if (!this.selectedPeriod()) {
          this.selectedPeriod.set(savedPeriod);
          this.periodSelector()?.refresh(savedPeriod);
        } else {
          this.loadSnapshots();
        }
        this.api.getPeriods().subscribe((p) => this.periods.set(p));
      });
    }
  }

  confirmDelete(snapshot: Snapshot) {
    this.confirmService.confirm({
      message: 'Delete this snapshot?',
      header: 'Confirm',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.api.deleteSnapshot(snapshot.id).subscribe(() => this.loadSnapshots());
      },
    });
  }

  getTargetLabel(entityId: string): string {
    return this.targets().find((t) => t.id === entityId)?.label ?? entityId;
  }

  protected bulkDirty = computed(() => this.bulkGrid().some(c => c.value !== null && c.value > 0));

  closeBulk() {
    if (this.bulkDirty()) {
      this.confirmService.confirm({
        message: 'You have unsaved values. Discard changes?',
        header: 'Unsaved Changes',
        icon: 'pi pi-exclamation-triangle',
        accept: () => this.bulkVisible.set(false),
      });
    } else {
      this.bulkVisible.set(false);
    }
  }

  // Bulk entry
  openBulk() {
    this.bulkVisible.set(true);
    this.generateBulkGrid();
  }

  generateBulkGrid() {
    const periods = this.buildPeriodRange(this.bulkConvention, this.bulkStartYear);
    this.bulkPeriods.set(periods);

    const targets = this.targets();

    // Fetch all existing snapshots to pre-populate the grid
    this.api.getSnapshots({}).subscribe((existing) => {
      const lookup = new Map<string, number>();
      for (const s of existing) {
        lookup.set(`${s.entityId}|${s.period}`, s.value);
      }

      const grid: BulkCell[] = [];
      for (const target of targets) {
        for (const period of periods) {
          grid.push({
            entityId: target.id,
            entityType: target.entityType,
            period,
            currency: target.currency,
            value: lookup.get(`${target.id}|${period}`) ?? null,
          });
        }
      }
      this.bulkGrid.set(grid);
    });
  }

  getBulkCell(entityId: string, period: string): BulkCell | undefined {
    return this.bulkGrid().find((c) => c.entityId === entityId && c.period === period);
  }

  saveBulk() {
    const cells = this.bulkGrid().filter((c) => c.value !== null && c.value > 0);
    if (cells.length === 0) return;

    this.bulkSaving.set(true);

    const requests = cells.map((c) =>
      this.api.upsertSnapshot({
        entityId: c.entityId,
        entityType: c.entityType,
        period: c.period,
        value: c.value!,
        currency: c.currency,
        notes: null,
      })
    );

    forkJoin(requests).subscribe({
      next: () => {
        this.bulkSaving.set(false);
        this.bulkVisible.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Saved',
          detail: `${cells.length} snapshots recorded`,
        });
        this.loadSnapshots();
        this.api.getPeriods().subscribe((p) => this.periods.set(p));
      },
      error: () => {
        this.bulkSaving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Some snapshots failed to save',
        });
      },
    });
  }

  private buildPeriodRange(convention: string, startYear: number): string[] {
    const periods: string[] = [];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    let fyEnd: number;
    let currentQ: number;

    if (convention === 'FY') {
      fyEnd = currentMonth >= 7 ? currentYear + 1 : currentYear;
      currentQ = currentMonth >= 7 && currentMonth <= 9 ? 1
        : currentMonth >= 10 && currentMonth <= 12 ? 2
        : currentMonth >= 1 && currentMonth <= 3 ? 3 : 4;

      for (let year = startYear; year <= fyEnd; year++) {
        for (let q = 1; q <= 4; q++) {
          if (year === fyEnd && q > currentQ) break;
          periods.push(`FY${year}-Q${q}`);
        }
      }
    } else {
      currentQ = Math.ceil(currentMonth / 3);
      for (let year = startYear; year <= currentYear; year++) {
        for (let q = 1; q <= 4; q++) {
          if (year === currentYear && q > currentQ) break;
          periods.push(`CY${year}-Q${q}`);
        }
      }
    }

    return periods;
  }

  private loadSnapshots() {
    const period = this.selectedPeriod();
    if (!period) return;
    const params = period === 'ALL' ? {} : { period };
    this.api.getSnapshots(params).subscribe((d) => this.snapshots.set(d));
  }

  private loadTargets() {
    this.api.getAssets().subscribe((assets) => {
      this.api.getLiabilities().subscribe((liabilities) => {
        const t: SnapshotTarget[] = [
          ...assets.map((a) => ({ id: a.id, label: a.label, entityType: 'asset' as const, currency: a.currency })),
          ...liabilities.map((l) => ({ id: l.id, label: l.label, entityType: 'liability' as const, currency: l.currency })),
        ];
        this.targets.set(t);
      });
    });
  }

  private emptyForm(): CreateSnapshotRequest {
    return {
      entityId: '',
      entityType: 'asset',
      period: '',
      value: 0,
      currency: this.localeService.currency(),
      notes: null,
    };
  }
}
