import { Component, ChangeDetectionStrategy, inject, signal, model } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, InputText, Button],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss',
})
export class SetupComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  protected email = this.auth.setupEmail;
  protected displayName = model('');
  protected saving = signal(false);

  submit() {
    const name = this.displayName().trim();
    if (!name) return;
    this.saving.set(true);
    this.api.setup(name).subscribe({
      next: () => {
        // Re-init auth and wait for it to complete before navigating
        this.auth.setupComplete().then(() => {
          this.router.navigate(['/dashboard']);
        });
      },
      error: () => this.saving.set(false),
    });
  }
}
