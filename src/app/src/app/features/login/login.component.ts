import { Component, inject, signal, model } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Password } from 'primeng/password';
import { Button } from 'primeng/button';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, Password, Button],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  passphrase = model('');
  submitting = signal(false);
  error = signal<string | null>(null);
  shaking = signal(false);

  async submit() {
    if (!this.passphrase() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    try {
      await firstValueFrom(this.api.login(this.passphrase()));
      await this.auth.loginComplete();
      this.router.navigate(['/dashboard']);
    } catch {
      this.error.set('Incorrect passphrase.');
      this.shaking.set(true);
    } finally {
      this.submitting.set(false);
    }
  }
}
