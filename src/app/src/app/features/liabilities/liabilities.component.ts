import { Component, ChangeDetectionStrategy, inject, signal, OnInit, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Button } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { InputNumber } from 'primeng/inputnumber';
import { Textarea } from 'primeng/textarea';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';
import { Skeleton } from 'primeng/skeleton';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ApiService } from '../../core/api/api.service';
import { Liability, LiabilityType, Member, CreateLiabilityRequest, LatestSnapshot } from '../../core/api/models';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { RecordValueDialogComponent } from '../../shared/components/record-value-dialog.component';
import { Tooltip } from 'primeng/tooltip';
import { DecimalPipe } from '@angular/common';
import { Divider } from 'primeng/divider';
import { CATEGORY_COLORS } from '../dashboard/chart-options';

@Component({
  selector: 'app-liabilities',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DecimalPipe, TableModule, Tag, Button, DialogModule, InputText, Select, InputNumber, Textarea, ConfirmDialog, Toast, Skeleton, EmptyStateComponent, RecordValueDialogComponent, Tooltip, Divider],
  providers: [ConfirmationService, MessageService],
  templateUrl: './liabilities.component.html',
  styleUrl: './liabilities.component.scss',
})
export class LiabilitiesComponent implements OnInit {
  private api = inject(ApiService);
  private confirmService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  protected liabilities = signal<Liability[]>([]);
  protected liabilityTypes = signal<LiabilityType[]>([]);
  protected members = signal<Member[]>([]);
  protected dialogVisible = signal(false);
  protected editing = signal<Liability | null>(null);
  protected loading = signal(true);
  protected latestValues = signal<Map<string, LatestSnapshot>>(new Map());
  protected recordingLiabilityId = signal<string | null>(null);
  protected recordingLabel = signal('');
  private recordDialog = viewChild<RecordValueDialogComponent>('recordDialog');

  protected form: CreateLiabilityRequest = this.emptyForm();

  protected ownershipOptions = [
    { label: 'Sole', value: 'sole' },
    { label: 'Joint', value: 'joint' },
  ];

  protected frequencyOptions = [
    { label: 'Weekly', value: 'weekly' },
    { label: 'Fortnightly', value: 'fortnightly' },
    { label: 'Monthly', value: 'monthly' },
    { label: 'Quarterly', value: 'quarterly' },
    { label: 'Yearly', value: 'yearly' },
  ];

  ngOnInit() {
    this.loadLiabilities();
    this.api.getLiabilityTypes().subscribe((d) => this.liabilityTypes.set(d));
    this.api.getMembers().subscribe((d) => this.members.set(d));
  }

  openNew() {
    this.form = this.emptyForm();
    this.editing.set(null);
    this.dialogVisible.set(true);
  }

  openEdit(liability: Liability) {
    this.form = {
      liabilityTypeId: liability.liabilityTypeId,
      ownerMemberId: liability.ownerMemberId,
      ownershipType: liability.ownershipType,
      jointSplit: liability.jointSplit,
      label: liability.label,
      currency: liability.currency,
      notes: liability.notes,
      repaymentAmount: liability.repaymentAmount,
      repaymentFrequency: liability.repaymentFrequency,
      repaymentEndDate: liability.repaymentEndDate,
      interestRate: liability.interestRate ? liability.interestRate * 100 : null,
    };
    this.editing.set(liability);
    this.dialogVisible.set(true);
  }

  save() {
    const current = this.editing();
    const payload = {
      ...this.form,
      interestRate: this.form.interestRate ? this.form.interestRate / 100 : null,
    };
    if (current) {
      this.api.updateLiability(current.id, payload).subscribe(() => {
        this.dialogVisible.set(false);
        this.loadLiabilities();
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Liability updated' });
      });
    } else {
      this.api.createLiability(payload).subscribe(() => {
        this.dialogVisible.set(false);
        this.loadLiabilities();
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Liability created' });
      });
    }
  }

  confirmDelete(liability: Liability) {
    this.confirmService.confirm({
      message: `Are you sure you want to remove "${liability.label}"?`,
      header: 'Confirm',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.api.deleteLiability(liability.id).subscribe(() => {
          this.loadLiabilities();
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Liability removed' });
        });
      },
    });
  }

  getLatestValue(liabilityId: string): LatestSnapshot | undefined {
    return this.latestValues().get(liabilityId);
  }

  openRecordValue(liability: Liability) {
    this.recordingLiabilityId.set(liability.id);
    this.recordingLabel.set(liability.label);
    setTimeout(() => this.recordDialog()?.open());
  }

  loadLiabilities() {
    this.loading.set(true);
    this.api.getLiabilities().subscribe((data) => {
      this.liabilities.set(data);
      this.loading.set(false);
    });
    this.api.getLatestSnapshots().subscribe((snapshots) => {
      const map = new Map(snapshots.filter(s => s.entityType === 'liability').map(s => [s.entityId, s]));
      this.latestValues.set(map);
    });
  }

  getLiabilityCategoryColor(liability: Liability): string {
    const type = this.liabilityTypes().find(t => t.id === liability.liabilityTypeId);
    return CATEGORY_COLORS[type?.category ?? ''] ?? '#94a3b8';
  }

  private emptyForm(): CreateLiabilityRequest {
    return {
      liabilityTypeId: '',
      ownerMemberId: null,
      ownershipType: 'sole',
      jointSplit: 0.5,
      label: '',
      currency: 'AUD',
      notes: null,
      repaymentAmount: null,
      repaymentFrequency: null,
      repaymentEndDate: null,
      interestRate: null,
    };
  }
}
