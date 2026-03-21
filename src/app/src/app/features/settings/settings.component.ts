import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { InputNumber } from 'primeng/inputnumber';
import { Button } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { Accordion, AccordionContent, AccordionHeader, AccordionPanel } from 'primeng/accordion';
import { Checkbox } from 'primeng/checkbox';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { Password } from 'primeng/password';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { GoalService } from '../../core/auth/goal.service';
import { Household, Member, ExpenseCategory, CreateExpenseCategoryRequest, UpdateExpenseCategoryRequest, AssetType, CreateAssetTypeRequest, UpdateAssetTypeRequest } from '../../core/api/models';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DecimalPipe, InputText, InputNumber, Select, Button, DialogModule, ConfirmDialogModule, Tabs, TabList, Tab, TabPanels, TabPanel, Accordion, AccordionContent, AccordionHeader, AccordionPanel, Checkbox, Tag, Toast, Password],
  providers: [MessageService, ConfirmationService],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private goalService = inject(GoalService);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private confirmationService = inject(ConfirmationService);

  protected household = signal<Household | null>(null);
  protected members = signal<Member[]>([]);
  protected editingMemberId = signal<string | null>(null);
  protected editingName = '';
  protected editingEmail = '';
  protected addMemberVisible = signal(false);
  protected newMemberEmail = '';
  protected newMemberName = '';
  protected currentMember = this.auth.currentMember;
  protected deleteAllConfirmName = '';
  protected deleteAllDialogVisible = signal(false);
  protected netWorthTarget: number | null = this.goalService.goal().netWorthTarget;
  protected superTarget: number | null = this.goalService.goal().superTarget;

  protected categories = signal<ExpenseCategory[]>([]);
  protected editingCategory = signal<ExpenseCategory | null>(null);
  protected categoryDialogVisible = signal(false);
  protected categoryName = '';

  // Asset type management
  protected assetTypes = signal<AssetType[]>([]);
  protected editingAssetType = signal<AssetType | null>(null);
  protected assetTypeDialogVisible = signal(false);
  protected atName = '';
  protected atCategory = '';
  protected atLiquidity = '';
  protected atGrowthClass = '';
  protected atIsSuper = false;
  protected atIsCgtExempt = false;
  protected atDefaultReturnRate: number | null = 0;
  protected atDefaultVolatility: number | null = 0;

  protected assetCategoryOptions = [
    { label: 'Cash', value: 'cash' },
    { label: 'Investable', value: 'investable' },
    { label: 'Property', value: 'property' },
    { label: 'Retirement', value: 'retirement' },
    { label: 'Other', value: 'other' },
  ];

  protected liquidityOptions = [
    { label: 'Immediate', value: 'immediate' },
    { label: 'Short Term', value: 'short_term' },
    { label: 'Long Term', value: 'long_term' },
    { label: 'Restricted', value: 'restricted' },
  ];

  protected growthClassOptions = [
    { label: 'Defensive', value: 'defensive' },
    { label: 'Growth', value: 'growth' },
    { label: 'Mixed', value: 'mixed' },
  ];

  protected passphraseEnabled = signal(false);
  protected passphraseDialogVisible = signal(false);
  protected currentPassphrase = '';
  protected newPassphrase = '';
  protected confirmPassphrase = '';

  protected periodOptions = [
    { label: 'Financial Year (FY)', value: 'FY' },
    { label: 'Calendar Year (CY)', value: 'CY' },
  ];

  ngOnInit() {
    this.api.getHousehold().subscribe((h) => this.household.set(h));
    this.api.getMembers().subscribe((m) => this.members.set(m));
    this.loadCategories();
    this.loadAssetTypes();
    this.api.getAuthStatus().subscribe(s => this.passphraseEnabled.set(s.passphraseEnabled));
  }

  loadCategories() {
    this.api.getExpenseCategories().subscribe((cats) => {
      this.categories.set([...cats].sort((a, b) => a.sortOrder - b.sortOrder));
    });
  }

  openAddCategory() {
    this.editingCategory.set(null);
    this.categoryName = '';
    this.categoryDialogVisible.set(true);
  }

  openEditCategory(cat: ExpenseCategory) {
    this.editingCategory.set(cat);
    this.categoryName = cat.name;
    this.categoryDialogVisible.set(true);
  }

  saveCategory() {
    const editing = this.editingCategory();
    if (editing) {
      const req: UpdateExpenseCategoryRequest = { name: this.categoryName, sortOrder: editing.sortOrder };
      this.api.updateExpenseCategory(editing.id, req).subscribe(() => {
        this.categoryDialogVisible.set(false);
        this.loadCategories();
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Category updated' });
      });
    } else {
      const req: CreateExpenseCategoryRequest = { name: this.categoryName };
      this.api.createExpenseCategory(req).subscribe(() => {
        this.categoryDialogVisible.set(false);
        this.loadCategories();
        this.messageService.add({ severity: 'success', summary: 'Added', detail: 'Category added' });
      });
    }
  }

  deleteCategory(cat: ExpenseCategory) {
    if (cat.isDefault) {
      this.messageService.add({ severity: 'warn', summary: 'Cannot Delete', detail: 'Default categories cannot be deleted' });
      return;
    }
    this.confirmationService.confirm({
      message: `Delete category "${cat.name}"? This cannot be undone.`,
      header: 'Delete Category?',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.deleteExpenseCategory(cat.id).subscribe({
          next: () => {
            this.loadCategories();
            this.messageService.add({ severity: 'success', summary: 'Deleted', detail: `Category "${cat.name}" deleted` });
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Cannot Delete', detail: 'This category has existing expenses and cannot be deleted' });
          },
        });
      },
    });
  }

  moveCategoryUp(cat: ExpenseCategory) {
    const cats = this.categories();
    const idx = cats.findIndex((c) => c.id === cat.id);
    if (idx <= 0) return;
    const prev = cats[idx - 1];
    const prevOrder = prev.sortOrder;
    const catOrder = cat.sortOrder;
    this.api.updateExpenseCategory(prev.id, { name: prev.name, sortOrder: catOrder }).subscribe(() => {
      this.api.updateExpenseCategory(cat.id, { name: cat.name, sortOrder: prevOrder }).subscribe(() => {
        this.loadCategories();
      });
    });
  }

  moveCategoryDown(cat: ExpenseCategory) {
    const cats = this.categories();
    const idx = cats.findIndex((c) => c.id === cat.id);
    if (idx < 0 || idx >= cats.length - 1) return;
    const next = cats[idx + 1];
    const nextOrder = next.sortOrder;
    const catOrder = cat.sortOrder;
    this.api.updateExpenseCategory(next.id, { name: next.name, sortOrder: catOrder }).subscribe(() => {
      this.api.updateExpenseCategory(cat.id, { name: cat.name, sortOrder: nextOrder }).subscribe(() => {
        this.loadCategories();
      });
    });
  }

  loadAssetTypes() {
    this.api.getAssetTypes().subscribe((types) => {
      this.assetTypes.set([...types].sort((a, b) => a.sortOrder - b.sortOrder));
    });
  }

  openAddAssetType() {
    this.editingAssetType.set(null);
    this.atName = '';
    this.atCategory = 'cash';
    this.atLiquidity = 'immediate';
    this.atGrowthClass = 'defensive';
    this.atIsSuper = false;
    this.atIsCgtExempt = false;
    this.atDefaultReturnRate = 0;
    this.atDefaultVolatility = 0;
    this.assetTypeDialogVisible.set(true);
  }

  openEditAssetType(at: AssetType) {
    this.editingAssetType.set(at);
    this.atName = at.name;
    this.atCategory = at.category;
    this.atLiquidity = at.liquidity;
    this.atGrowthClass = at.growthClass;
    this.atIsSuper = at.isSuper;
    this.atIsCgtExempt = at.isCgtExempt;
    this.atDefaultReturnRate = at.defaultReturnRate * 100;
    this.atDefaultVolatility = at.defaultVolatility * 100;
    this.assetTypeDialogVisible.set(true);
  }

  saveAssetType() {
    const editing = this.editingAssetType();
    if (editing) {
      const req: UpdateAssetTypeRequest = {
        name: this.atName,
        category: this.atCategory,
        liquidity: this.atLiquidity,
        growthClass: this.atGrowthClass,
        isSuper: this.atIsSuper,
        isCgtExempt: this.atIsCgtExempt,
        sortOrder: editing.sortOrder,
        defaultReturnRate: (this.atDefaultReturnRate ?? 0) / 100,
        defaultVolatility: (this.atDefaultVolatility ?? 0) / 100,
      };
      this.api.updateAssetType(editing.id, req).subscribe(() => {
        this.assetTypeDialogVisible.set(false);
        this.loadAssetTypes();
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Asset type updated' });
      });
    } else {
      const req: CreateAssetTypeRequest = {
        name: this.atName,
        category: this.atCategory,
        liquidity: this.atLiquidity,
        growthClass: this.atGrowthClass,
        isSuper: this.atIsSuper,
        isCgtExempt: this.atIsCgtExempt,
        defaultReturnRate: (this.atDefaultReturnRate ?? 0) / 100,
        defaultVolatility: (this.atDefaultVolatility ?? 0) / 100,
      };
      this.api.createAssetType(req).subscribe(() => {
        this.assetTypeDialogVisible.set(false);
        this.loadAssetTypes();
        this.messageService.add({ severity: 'success', summary: 'Added', detail: 'Asset type added' });
      });
    }
  }

  deleteAssetType(at: AssetType) {
    this.confirmationService.confirm({
      message: `Delete asset type "${at.name}"? This cannot be undone.`,
      header: 'Delete Asset Type?',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.deleteAssetType(at.id).subscribe({
          next: () => {
            this.loadAssetTypes();
            this.messageService.add({ severity: 'success', summary: 'Deleted', detail: `Asset type "${at.name}" deleted` });
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Cannot Delete', detail: 'This type is in use. Reassign or remove referencing assets first.' });
          },
        });
      },
    });
  }

  moveAssetTypeUp(at: AssetType) {
    const types = this.assetTypes();
    const idx = types.findIndex((t) => t.id === at.id);
    if (idx <= 0) return;
    const prev = types[idx - 1];
    const prevOrder = prev.sortOrder;
    const atOrder = at.sortOrder;
    this.api.updateAssetType(prev.id, { ...this.assetTypeToUpdateRequest(prev), sortOrder: atOrder }).subscribe(() => {
      this.api.updateAssetType(at.id, { ...this.assetTypeToUpdateRequest(at), sortOrder: prevOrder }).subscribe(() => {
        this.loadAssetTypes();
      });
    });
  }

  moveAssetTypeDown(at: AssetType) {
    const types = this.assetTypes();
    const idx = types.findIndex((t) => t.id === at.id);
    if (idx < 0 || idx >= types.length - 1) return;
    const next = types[idx + 1];
    const nextOrder = next.sortOrder;
    const atOrder = at.sortOrder;
    this.api.updateAssetType(next.id, { ...this.assetTypeToUpdateRequest(next), sortOrder: atOrder }).subscribe(() => {
      this.api.updateAssetType(at.id, { ...this.assetTypeToUpdateRequest(at), sortOrder: nextOrder }).subscribe(() => {
        this.loadAssetTypes();
      });
    });
  }

  private assetTypeToUpdateRequest(at: AssetType): UpdateAssetTypeRequest {
    return {
      name: at.name,
      category: at.category,
      liquidity: at.liquidity,
      growthClass: at.growthClass,
      isSuper: at.isSuper,
      isCgtExempt: at.isCgtExempt,
      sortOrder: at.sortOrder,
      defaultReturnRate: at.defaultReturnRate,
      defaultVolatility: at.defaultVolatility,
    };
  }

  saveHousehold() {
    const h = this.household();
    if (!h) return;
    this.api
      .updateHousehold({
        name: h.name,
        baseCurrency: h.baseCurrency,
        preferredPeriodType: h.preferredPeriodType,
      })
      .subscribe((updated) => {
        this.household.set(updated);
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Household settings updated' });
      });
  }

  startEditMember(member: Member) {
    this.editingMemberId.set(member.id);
    this.editingName = member.displayName;
    this.editingEmail = member.email ?? '';
  }

  saveMember(member: Member) {
    this.api.updateMember(member.id, this.editingName, this.editingEmail).subscribe(() => {
      this.editingMemberId.set(null);
      this.api.getMembers().subscribe((m) => this.members.set(m));
      this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Member updated' });
    });
  }

  cancelEditMember() {
    this.editingMemberId.set(null);
  }

  openAddMember() {
    this.newMemberEmail = '';
    this.newMemberName = '';
    this.addMemberVisible.set(true);
  }

  addMember() {
    this.api.createMember(this.newMemberName, this.newMemberEmail || undefined).subscribe(() => {
      this.addMemberVisible.set(false);
      this.api.getMembers().subscribe((m) => this.members.set(m));
      this.auth.loadMembers();
      this.messageService.add({ severity: 'success', summary: 'Added', detail: 'Member added to household' });
    });
  }

  confirmDeleteMember(member: Member) {
    this.confirmationService.confirm({
      message: `This will permanently delete all assets, liabilities, and snapshots owned by ${member.displayName}. This cannot be undone.`,
      header: `Delete ${member.displayName}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.deleteMember(member.id).subscribe(() => {
          this.api.getMembers().subscribe((m) => this.members.set(m));
          this.auth.loadMembers();
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: `${member.displayName} and all their data have been deleted` });
        });
      },
    });
  }

  openDeleteAllDialog() {
    this.deleteAllConfirmName = '';
    this.deleteAllDialogVisible.set(true);
  }

  confirmDeleteAll() {
    const h = this.household();
    if (!h || this.deleteAllConfirmName !== h.name) return;
    this.api.deleteAllData().subscribe(async () => {
      await this.auth.init();
      this.router.navigate(['/setup']);
    });
  }

  exportData() {
    this.api.exportData().subscribe((data) => {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clearfolio-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  onImportFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.confirmationService.confirm({
      message: 'This will replace all current data with the imported file. This cannot be undone.',
      header: 'Import Data?',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-warning',
      accept: () => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result as string);
            this.api.importData(data).subscribe({
              next: () => {
                this.messageService.add({ severity: 'success', summary: 'Imported', detail: 'Data imported successfully' });
                this.ngOnInit();
                this.auth.loadMembers();
              },
              error: () => {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Import failed' });
              },
            });
          } catch {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Invalid JSON file' });
          }
        };
        reader.readAsText(file);
      },
    });
    (event.target as HTMLInputElement).value = '';
  }

  openSetPassphrase() {
    this.currentPassphrase = '';
    this.newPassphrase = '';
    this.confirmPassphrase = '';
    this.passphraseDialogVisible.set(true);
  }

  savePassphrase() {
    if (this.newPassphrase !== this.confirmPassphrase) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Passphrases do not match' });
      return;
    }
    this.api.setPassphrase(
      this.passphraseEnabled() ? this.currentPassphrase : null,
      this.newPassphrase
    ).subscribe({
      next: () => {
        this.passphraseEnabled.set(true);
        this.passphraseDialogVisible.set(false);
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Passphrase set' });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to set passphrase. Check your current passphrase.' });
      },
    });
  }

  removePassphrase() {
    this.confirmationService.confirm({
      message: 'Remove the passphrase? Anyone on your network will be able to access Clearfolio.',
      header: 'Remove Passphrase?',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.api.removePassphrase(this.currentPassphrase).subscribe({
          next: () => {
            this.passphraseEnabled.set(false);
            this.passphraseDialogVisible.set(false);
            this.messageService.add({ severity: 'success', summary: 'Removed', detail: 'Passphrase removed' });
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Incorrect passphrase' });
          },
        });
      },
    });
  }

  saveGoals() {
    this.goalService.setGoal({
      netWorthTarget: this.netWorthTarget,
      superTarget: this.superTarget,
    });
    this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Goals updated' });
  }
}
