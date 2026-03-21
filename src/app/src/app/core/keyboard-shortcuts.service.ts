import { Injectable, inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class KeyboardShortcutsService implements OnDestroy {
  private router = inject(Router);
  private handler = this.onKeyDown.bind(this);

  init() {
    document.addEventListener('keydown', this.handler);
  }

  ngOnDestroy() {
    document.removeEventListener('keydown', this.handler);
  }

  private onKeyDown(e: KeyboardEvent) {
    // Ignore when typing in inputs/textareas/selects
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // Ignore when modifier keys are held (allow user's browser shortcuts)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    switch (e.key) {
      case 'g':
        // g then wait for second key — but simpler: just use single keys
        break;
      case 'd':
        e.preventDefault();
        this.router.navigate(['/dashboard']);
        break;
      case 'a':
        e.preventDefault();
        this.router.navigate(['/assets']);
        break;
      case 'l':
        e.preventDefault();
        this.router.navigate(['/liabilities']);
        break;
      case 'c':
        e.preventDefault();
        this.router.navigate(['/cashflow']);
        break;
      case 's':
        e.preventDefault();
        this.router.navigate(['/snapshots']);
        break;
      case 'p':
        e.preventDefault();
        this.router.navigate(['/projections']);
        break;
      case 'h':
        e.preventDefault();
        this.router.navigate(['/help']);
        break;
      case '?':
        e.preventDefault();
        this.showHelp();
        break;
    }
  }

  private helpVisible = false;

  private showHelp() {
    if (this.helpVisible) {
      this.hideHelp();
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'keyboard-help-overlay';
    overlay.innerHTML = `
      <div class="kb-help-card">
        <h3>Keyboard Shortcuts</h3>
        <div class="kb-help-grid">
          <kbd>d</kbd><span>Dashboard</span>
          <kbd>a</kbd><span>Assets</span>
          <kbd>l</kbd><span>Liabilities</span>
          <kbd>c</kbd><span>Cashflow</span>
          <kbd>s</kbd><span>Snapshots</span>
          <kbd>p</kbd><span>Projections</span>
          <kbd>h</kbd><span>Help</span>
          <kbd>?</kbd><span>Toggle this help</span>
        </div>
        <p class="kb-help-hint">Press any key or click to dismiss</p>
      </div>
    `;
    overlay.addEventListener('click', () => this.hideHelp());
    document.addEventListener('keydown', () => this.hideHelp(), { once: true });
    document.body.appendChild(overlay);
    this.helpVisible = true;
  }

  private hideHelp() {
    const el = document.getElementById('keyboard-help-overlay');
    if (el) {
      el.remove();
      this.helpVisible = false;
    }
  }
}
