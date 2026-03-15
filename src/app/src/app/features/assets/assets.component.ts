import { Component, ChangeDetectionStrategy, inject, signal, OnInit, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
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

@Component({
  selector: 'app-assets',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DecimalPipe, TableModule, Tag, Button, DialogModule, InputText, Select, InputNumber, Textarea, ConfirmDialog, Toast, Skeleton, EmptyStateComponent, RecordValueDialogComponent, Tooltip],
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
    };
    this.editing.set(asset);
    this.dialogVisible.set(true);
  }

  save() {
    const current = this.editing();
    if (current) {
      this.api.updateAsset(current.id, this.form).subscribe(() => {
        this.dialogVisible.set(false);
        this.loadAssets();
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Asset updated' });
      });
    } else {
      this.api.createAsset(this.form).subscribe(() => {
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
    };
  }
}
