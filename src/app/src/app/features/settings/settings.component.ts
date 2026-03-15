import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { InputNumber } from 'primeng/inputnumber';
import { Button } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { GoalService } from '../../core/auth/goal.service';
import { Household, Member } from '../../core/api/models';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, InputText, InputNumber, Select, Button, DialogModule, Tabs, TabList, Tab, TabPanels, TabPanel, Tag, Toast],
  providers: [MessageService],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private goalService = inject(GoalService);
  private messageService = inject(MessageService);

  protected household = signal<Household | null>(null);
  protected members = signal<Member[]>([]);
  protected editingMemberId = signal<string | null>(null);
  protected editingName = '';
  protected editingEmail = '';
  protected addMemberVisible = signal(false);
  protected newMemberEmail = '';
  protected newMemberName = '';
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

  saveGoals() {
    this.goalService.setGoal({
      netWorthTarget: this.netWorthTarget,
      superTarget: this.superTarget,
    });
    this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Goals updated' });
  }
}
