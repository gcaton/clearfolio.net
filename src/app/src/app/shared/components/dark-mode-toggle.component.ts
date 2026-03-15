import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-dark-mode-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  template: `
    <p-button
      [icon]="dark() ? 'pi pi-sun' : 'pi pi-moon'"
      [rounded]="true"
      [text]="true"
      size="small"
      (onClick)="toggle()"
      [style]="{ color: 'var(--p-surface-300)' }"
    />
  `,
})
export class DarkModeToggleComponent {
  dark = signal(this.loadPreference());

  constructor() {
    this.applyTheme(this.dark());
  }

  toggle() {
    const next = !this.dark();
    this.dark.set(next);
    this.applyTheme(next);
    localStorage.setItem('clearfolio_dark', String(next));
  }

  private applyTheme(dark: boolean) {
    document.documentElement.classList.toggle('app-dark', dark);
  }

  private loadPreference(): boolean {
    const stored = localStorage.getItem('clearfolio_dark');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
