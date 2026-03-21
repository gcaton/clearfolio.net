import { Injectable, inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class KeyboardShortcutsService implements OnDestroy {
  private router = inject(Router);
  private handler = this.onKeyDown.bind(this);
  private initialized = false;
  private helpVisible = false;
  private dismissHandler: (() => void) | null = null;

  init() {
    if (this.initialized) return;
    document.addEventListener('keydown', this.handler);
    this.initialized = true;
  }

  ngOnDestroy() {
    if (this.initialized) {
      document.removeEventListener('keydown', this.handler);
      this.initialized = false;
    }
    this.hideHelp();
  }

  private onKeyDown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (this.helpVisible) {
      e.preventDefault();
      this.hideHelp();
      return;
    }

    switch (e.key) {
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
    document.body.appendChild(overlay);
    this.helpVisible = true;
  }

  private hideHelp() {
    const el = document.getElementById('keyboard-help-overlay');
    if (el) {
      el.remove();
    }
    this.helpVisible = false;
  }
}
