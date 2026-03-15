import { Injectable, signal } from '@angular/core';

export type ViewState = 'household' | 'p1' | 'p2';

@Injectable({ providedIn: 'root' })
export class ViewStateService {
  private _view = signal<ViewState>(this.loadFromStorage());

  readonly view = this._view.asReadonly();

  setView(view: ViewState) {
    this._view.set(view);
    localStorage.setItem('clearfolio_view', view);
  }

  private loadFromStorage(): ViewState {
    const stored = localStorage.getItem('clearfolio_view');
    if (stored === 'household' || stored === 'p1' || stored === 'p2') {
      return stored;
    }
    return 'household';
  }
}
