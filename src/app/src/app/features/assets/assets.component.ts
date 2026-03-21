import { Component, ChangeDetectionStrategy, inject, signal, OnInit, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
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
import { Asset, AssetType, Member, CreateAssetRequest, Quote, LatestSnapshot } from '../../core/api/models';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { RecordValueDialogComponent } from '../../shared/components/record-value-dialog.component';
import { Tooltip } from 'primeng/tooltip';
import { Divider } from 'primeng/divider';

@Component({
  selector: 'app-assets',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CurrencyPipe, DecimalPipe, TableModule, Tag, Button, DialogModule, InputText, Select, InputNumber, Textarea, ConfirmDialog, Toast, Skeleton, EmptyStateComponent, RecordValueDialogComponent, Tooltip, Divider],
  providers: [ConfirmationService, MessageService],
  templateUrl: './assets.component.html',
  styleUrl: './assets.component.scss',
})
export class AssetsComponent implements OnInit {
  private api = inject(ApiService);
  private confirmService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  protected assets = signal<Asset[]>([]);
  protected assetTypes = signal<AssetType[]>([]);
  protected members = signal<Member[]>([]);
  protected dialogVisible = signal(false);
  protected editing = signal<Asset | null>(null);
  protected quotes = signal<Record<string, Quote>>({});
  protected loading = signal(true);
  protected latestValues = signal<Map<string, LatestSnapshot>>(new Map());
  protected recordingAssetId = signal<string | null>(null);
  protected recordingLabel = signal('');
  private recordDialog = viewChild<RecordValueDialogComponent>('recordDialog');

  protected form: CreateAssetRequest = this.emptyForm();

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
    this.loadAssets();
    this.api.getAssetTypes().subscribe((d) => this.assetTypes.set(d));
    this.api.getMembers().subscribe((d) => this.members.set(d));
  }

  openNew() {
    this.form = this.emptyForm();
    this.editing.set(null);
    this.dialogVisible.set(true);
  }

  openEdit(asset: Asset) {
    this.form = {
      assetTypeId: asset.assetTypeId,
      ownerMemberId: asset.ownerMemberId,
      ownershipType: asset.ownershipType,
      jointSplit: asset.jointSplit,
      label: asset.label,
      symbol: asset.symbol,
      currency: asset.currency,
      notes: asset.notes,
      contributionAmount: asset.contributionAmount,
      contributionFrequency: asset.contributionFrequency,
      contributionEndDate: asset.contributionEndDate,
      expectedReturnRate: asset.expectedReturnRate ? asset.expectedReturnRate * 100 : null,
      expectedVolatility: asset.expectedVolatility ? asset.expectedVolatility * 100 : null,
    };
    this.editing.set(asset);
    this.dialogVisible.set(true);
  }

  save() {
    const current = this.editing();
    const payload = {
      ...this.form,
      expectedReturnRate: this.form.expectedReturnRate ? this.form.expectedReturnRate / 100 : null,
      expectedVolatility: this.form.expectedVolatility ? this.form.expectedVolatility / 100 : null,
    };
    if (current) {
      this.api.updateAsset(current.id, payload).subscribe(() => {
        this.dialogVisible.set(false);
        this.loadAssets();
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Asset updated' });
      });
    } else {
      this.api.createAsset(payload).subscribe(() => {
        this.dialogVisible.set(false);
        this.loadAssets();
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Asset created' });
      });
    }
  }

  confirmDelete(asset: Asset) {
    this.confirmService.confirm({
      message: `Are you sure you want to remove "${asset.label}"?`,
      header: 'Confirm',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.api.deleteAsset(asset.id).subscribe(() => {
          this.loadAssets();
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Asset removed' });
        });
      },
    });
  }

  refreshQuote(asset: Asset) {
    if (!asset.symbol) return;
    this.api.getQuote(asset.symbol).subscribe((q) => {
      this.quotes.update((prev) => ({ ...prev, [asset.symbol!]: q }));
    });
  }

  getQuote(symbol: string): Quote | undefined {
    return this.quotes()[symbol];
  }

  getLatestValue(assetId: string): LatestSnapshot | undefined {
    return this.latestValues().get(assetId);
  }

  openRecordValue(asset: Asset) {
    this.recordingAssetId.set(asset.id);
    this.recordingLabel.set(asset.label);
    setTimeout(() => this.recordDialog()?.open());
  }

  loadAssets() {
    this.loading.set(true);
    this.api.getAssets().subscribe((data) => {
      this.assets.set(data);
      this.loading.set(false);
      // Auto-fetch quotes for assets with symbols
      for (const asset of data) {
        if (asset.symbol) {
          this.refreshQuote(asset);
        }
      }
    });
    this.api.getLatestSnapshots().subscribe((snapshots) => {
      const map = new Map(snapshots.filter(s => s.entityType === 'asset').map(s => [s.entityId, s]));
      this.latestValues.set(map);
    });
  }

  private emptyForm(): CreateAssetRequest {
    return {
      assetTypeId: '',
      ownerMemberId: null,
      ownershipType: 'sole',
      jointSplit: 0.5,
      label: '',
      symbol: null,
      currency: 'AUD',
      notes: null,
      contributionAmount: null,
      contributionFrequency: null,
      contributionEndDate: null,
      expectedReturnRate: null,
      expectedVolatility: null,
    };
  }
}
