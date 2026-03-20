import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { InputNumber } from 'primeng/inputnumber';
import { Button } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { GoalService } from '../../core/auth/goal.service';
import { Household, Member } from '../../core/api/models';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, InputText, InputNumber, Select, Button, DialogModule, ConfirmDialogModule, Tabs, TabList, Tab, TabPanels, TabPanel, Tag, Toast],
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

  protected periodOptions = [
    { label: 'Financial Year (FY)', value: 'FY' },
    { label: 'Calendar Year (CY)', value: 'CY' },
  ];

  ngOnInit() {
    this.api.getHousehold().subscribe((h) => this.household.set(h));
    this.api.getMembers().subscribe((m) => this.members.set(m));
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
    this.editingEmail = member.email;
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
    this.api.createMember(this.newMemberEmail, this.newMemberName).subscribe(() => {
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
    this.api.deleteAllData().subscribe(() => {
      this.auth.init();
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

  saveGoals() {
    this.goalService.setGoal({
      netWorthTarget: this.netWorthTarget,
      superTarget: this.superTarget,
    });
    this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Goals updated' });
  }
}
