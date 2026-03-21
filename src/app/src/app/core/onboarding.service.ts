import { Injectable, inject, signal, computed } from '@angular/core';
import { ApiService } from './api/api.service';
import { GoalService } from './auth/goal.service';
import { forkJoin } from 'rxjs';

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  icon: string;
  route: string;
  complete: boolean;
}

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private api = inject(ApiService);
  private goalService = inject(GoalService);

  private _steps = signal<OnboardingStep[]>([]);
  private _dismissed = signal(this.loadDismissed());
  private _loaded = signal(false);

  readonly steps = this._steps.asReadonly();
  readonly dismissed = this._dismissed.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  readonly allComplete = computed(() =>
    this._steps().length > 0 && this._steps().every(s => s.complete)
  );

  readonly completedCount = computed(() =>
    this._steps().filter(s => s.complete).length
  );

  readonly totalCount = computed(() => this._steps().length);

  readonly visible = computed(() =>
    this._loaded() && !this._dismissed() && !this.allComplete()
  );

  check() {
    forkJoin({
      assets: this.api.getAssets(),
      liabilities: this.api.getLiabilities(),
      snapshots: this.api.getLatestSnapshots(),
    }).subscribe(({ assets, liabilities, snapshots }) => {
      const hasAssets = assets.length > 0;
      const hasLiabilities = liabilities.length > 0;
      const hasSnapshots = snapshots.length > 0;
      const hasGoal = (this.goalService.goal().netWorthTarget ?? 0) > 0;

      this._steps.set([
        {
          id: 'assets',
          label: 'Add your first asset',
          description: 'Track bank accounts, investments, property, and super',
          icon: 'pi-wallet',
          route: '/assets',
          complete: hasAssets,
        },
        {
          id: 'liabilities',
          label: 'Add your first liability',
          description: 'Track mortgages, loans, credit cards, and student loans',
          icon: 'pi-credit-card',
          route: '/liabilities',
          complete: hasLiabilities,
        },
        {
          id: 'snapshots',
          label: 'Record your first snapshot',
          description: 'Capture current values to start tracking over time',
          icon: 'pi-camera',
          route: '/snapshots',
          complete: hasSnapshots,
        },
        {
          id: 'goal',
          label: 'Set a net worth goal',
          description: 'Define a target to track your progress against',
          icon: 'pi-flag',
          route: '/settings',
          complete: hasGoal,
        },
      ]);
      this._loaded.set(true);
    });
  }

  dismiss() {
    this._dismissed.set(true);
    localStorage.setItem('clearfolio_onboarding_dismissed', 'true');
  }

  private loadDismissed(): boolean {
    return localStorage.getItem('clearfolio_onboarding_dismissed') === 'true';
  }
}
