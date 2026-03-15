import { Injectable, signal } from '@angular/core';

export interface Goal {
  netWorthTarget: number | null;
  superTarget: number | null;
}

@Injectable({ providedIn: 'root' })
export class GoalService {
  private _goal = signal<Goal>(this.load());

  readonly goal = this._goal.asReadonly();

  setGoal(goal: Goal) {
    this._goal.set(goal);
    localStorage.setItem('clearfolio_goals', JSON.stringify(goal));
  }

  private load(): Goal {
    const stored = localStorage.getItem('clearfolio_goals');
    if (stored) {
      try { return JSON.parse(stored); } catch { /* ignore */ }
    }
    return { netWorthTarget: null, superTarget: null };
  }
}
