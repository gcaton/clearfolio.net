import { Injectable, inject, signal, computed } from '@angular/core';
import { ApiService } from '../api/api.service';
import { LocaleService } from '../locale/locale.service';
import { Member } from '../api/models';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private localeService = inject(LocaleService);

  private readonly _currentMember = signal<Member | null>(null);
  private readonly _members = signal<Member[]>([]);
  private readonly _loading = signal(true);
  private readonly _setupComplete = signal(false);
  private readonly _passphraseEnabled = signal(false);
  private readonly _authenticated = signal(false);

  readonly currentMember = this._currentMember.asReadonly();
  readonly members = this._members.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly setupComplete = this._setupComplete.asReadonly();
  readonly passphraseEnabled = this._passphraseEnabled.asReadonly();
  readonly authenticated = this._authenticated.asReadonly();
  readonly isAuthenticated = computed(() => this._currentMember() !== null);

  // Legacy compat — guards check this
  readonly needsSetup = computed(() => !this._setupComplete());

  async init() {
    this._loading.set(true);
    try {
      const status = await firstValueFrom(this.api.getAuthStatus());
      this._setupComplete.set(status.setupComplete);
      this._passphraseEnabled.set(status.passphraseEnabled);
      this._authenticated.set(status.authenticated);

      if (status.setupComplete && status.authenticated) {
        const member = await firstValueFrom(this.api.getCurrentMember());
        this._currentMember.set(member);
        await this.loadMembers();
        this.localeService.init();
      } else {
        this._currentMember.set(null);
        this._members.set([]);
      }
    } catch {
      // Status endpoint should always succeed; if it fails, leave defaults
    } finally {
      this._loading.set(false);
    }
  }

  async onSetupComplete() {
    this._loading.set(true);
    await this.init();
  }

  async loginComplete() {
    this._loading.set(true);
    this._authenticated.set(true);
    try {
      const member = await firstValueFrom(this.api.getCurrentMember());
      this._currentMember.set(member);
      await this.loadMembers();
      this.localeService.init();
    } finally {
      this._loading.set(false);
    }
  }

  async loadMembers() {
    const members = await firstValueFrom(this.api.getMembers());
    this._members.set(members);
  }
}
