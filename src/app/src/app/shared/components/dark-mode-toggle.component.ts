import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { ToggleButton } from 'primeng/togglebutton';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dark-mode-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToggleButton, FormsModule],
  template: `
    <p-togglebutton
      [(ngModel)]="dark"
      onIcon="pi pi-moon"
      offIcon="pi pi-sun"
      (ngModelChange)="toggle($event)"
      [style]="{ width: '2.5rem', height: '2.5rem' }"
    />
  `,
})
export class DarkModeToggleComponent {
  dark = this.loadPreference();

  constructor() {
    this.applyTheme(this.dark);
  }

  toggle(dark: boolean) {
    this.applyTheme(dark);
    localStorage.setItem('clearfolio_dark', String(dark));
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
