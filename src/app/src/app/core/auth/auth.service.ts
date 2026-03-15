import { Injectable, inject, signal, computed } from '@angular/core';
import { ApiService } from '../api/api.service';
import { Member } from '../api/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private _currentMember = signal<Member | null>(null);
  private _members = signal<Member[]>([]);
  private _loading = signal(true);

  readonly currentMember = this._currentMember.asReadonly();
  readonly members = this._members.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly isAuthenticated = computed(() => this._currentMember() !== null);

  init() {
    this.api.getCurrentMember().subscribe({
      next: (member) => {
        this._currentMember.set(member);
        this._loading.set(false);
        this.loadMembers();
      },
      error: () => {
        this._loading.set(false);
      },
    });
  }

  loadMembers() {
    this.api.getMembers().subscribe((members) => this._members.set(members));
  }
}
