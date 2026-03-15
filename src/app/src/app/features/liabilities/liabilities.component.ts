import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
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
import { ConfirmationService } from 'primeng/api';
import { ApiService } from '../../core/api/api.service';
import { Liability, LiabilityType, Member, CreateLiabilityRequest } from '../../core/api/models';

@Component({
  selector: 'app-liabilities',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TableModule, Tag, Button, DialogModule, InputText, Select, InputNumber, Textarea, ConfirmDialog],
  providers: [ConfirmationService],
  templateUrl: './liabilities.component.html',
  styleUrl: './liabilities.component.scss',
})
export class LiabilitiesComponent implements OnInit {
  private api = inject(ApiService);
  private confirmService = inject(ConfirmationService);

  protected liabilities = signal<Liability[]>([]);
  protected liabilityTypes = signal<LiabilityType[]>([]);
  protected members = signal<Member[]>([]);
  protected dialogVisible = signal(false);
  protected editing = signal<Liability | null>(null);

  protected form: CreateLiabilityRequest = this.emptyForm();

  protected ownershipOptions = [
    { label: 'Sole', value: 'sole' },
    { label: 'Joint', value: 'joint' },
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
    };
    this.editing.set(liability);
    this.dialogVisible.set(true);
  }

  save() {
    const current = this.editing();
    if (current) {
      this.api.updateLiability(current.id, this.form).subscribe(() => {
        this.dialogVisible.set(false);
        this.loadLiabilities();
      });
    } else {
      this.api.createLiability(this.form).subscribe(() => {
        this.dialogVisible.set(false);
        this.loadLiabilities();
      });
    }
  }

  confirmDelete(liability: Liability) {
    this.confirmService.confirm({
      message: `Are you sure you want to remove "${liability.label}"?`,
      header: 'Confirm',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.api.deleteLiability(liability.id).subscribe(() => this.loadLiabilities());
      },
    });
  }

  private loadLiabilities() {
    this.api.getLiabilities().subscribe((data) => this.liabilities.set(data));
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
    };
  }
}
