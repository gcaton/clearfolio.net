import { Component, ChangeDetectionStrategy, inject, signal, model } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { Select } from 'primeng/select';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, InputText, Button, SelectButton, Select],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss',
})
export class SetupComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  protected householdName = model('My Household');
  protected displayName = model('');
  protected currency = model('AUD');
  protected periodType = model('FY');
  protected locale = model('en-AU');
  protected saving = signal(false);

  protected periodOptions = [
    { label: 'Financial Year (FY)', value: 'FY' },
    { label: 'Calendar Year (CY)', value: 'CY' },
  ];

  protected localeOptions = [
    { label: 'Australia (en-AU)', value: 'en-AU' },
    { label: 'United States (en-US)', value: 'en-US' },
    { label: 'United Kingdom (en-GB)', value: 'en-GB' },
    { label: 'New Zealand (en-NZ)', value: 'en-NZ' },
    { label: 'Canada (en-CA)', value: 'en-CA' },
    { label: 'Ireland (en-IE)', value: 'en-IE' },
  ];

  async submit() {
    const name = this.displayName().trim();
    if (!name) return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.setup(
        name,
        this.householdName().trim() || undefined,
        this.currency() || undefined,
        this.periodType() || undefined,
        this.locale() || undefined
      ));
      await this.auth.onSetupComplete();
      this.router.navigate(['/dashboard']);
    } catch {
      this.saving.set(false);
    }
  }
}
