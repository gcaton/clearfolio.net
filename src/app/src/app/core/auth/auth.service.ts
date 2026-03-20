import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../api/api.service';
import { Member } from '../api/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private _currentMember = signal<Member | null>(null);
  private _members = signal<Member[]>([]);
  private _loading = signal(true);
  private _needsSetup = signal(false);
  private _setupEmail = signal<string | null>(null);

  readonly currentMember = this._currentMember.asReadonly();
  readonly members = this._members.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly isAuthenticated = computed(() => this._currentMember() !== null);
  readonly needsSetup = this._needsSetup.asReadonly();
  readonly setupEmail = this._setupEmail.asReadonly();

  init() {
    this._loading.set(true);
    this.api.getCurrentMember().subscribe({
      next: (member) => {
        this._currentMember.set(member);
        this._needsSetup.set(false);
        this._setupEmail.set(null);
        this._loading.set(false);
        this.loadMembers();
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 404 && err.error?.needsSetup) {
          this._needsSetup.set(true);
          this._setupEmail.set(err.error.email);
        }
        this._currentMember.set(null);
        this._loading.set(false);
      },
    });
  }

  /** Re-inits auth and returns a promise that resolves when loading completes. */
  setupComplete(): Promise<void> {
    return new Promise((resolve) => {
      this._loading.set(true);
      this._needsSetup.set(false);
      this.api.getCurrentMember().subscribe({
        next: (member) => {
          this._currentMember.set(member);
          this._loading.set(false);
          this.loadMembers();
          resolve();
        },
        error: () => {
          this._loading.set(false);
          resolve();
        },
      });
    });
  }

  loadMembers() {
    this.api.getMembers().subscribe((members) => this._members.set(members));
  }
}
