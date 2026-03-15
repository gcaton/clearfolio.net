import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
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
import { ConfirmationService } from 'primeng/api';
import { ApiService } from '../../core/api/api.service';
import { Asset, AssetType, Member, CreateAssetRequest, Quote } from '../../core/api/models';

@Component({
  selector: 'app-assets',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DecimalPipe, TableModule, Tag, Button, DialogModule, InputText, Select, InputNumber, Textarea, ConfirmDialog],
  providers: [ConfirmationService],
  templateUrl: './assets.component.html',
  styleUrl: './assets.component.scss',
})
export class AssetsComponent implements OnInit {
  private api = inject(ApiService);
  private confirmService = inject(ConfirmationService);

  protected assets = signal<Asset[]>([]);
  protected assetTypes = signal<AssetType[]>([]);
  protected members = signal<Member[]>([]);
  protected dialogVisible = signal(false);
  protected editing = signal<Asset | null>(null);
  protected quotes = signal<Record<string, Quote>>({});

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
      });
    } else {
      this.api.createAsset(this.form).subscribe(() => {
        this.dialogVisible.set(false);
        this.loadAssets();
      });
    }
  }

  confirmDelete(asset: Asset) {
    this.confirmService.confirm({
      message: `Are you sure you want to remove "${asset.label}"?`,
      header: 'Confirm',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.api.deleteAsset(asset.id).subscribe(() => this.loadAssets());
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

  private loadAssets() {
    this.api.getAssets().subscribe((data) => {
      this.assets.set(data);
      // Auto-fetch quotes for assets with symbols
      for (const asset of data) {
        if (asset.symbol) {
          this.refreshQuote(asset);
        }
      }
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
