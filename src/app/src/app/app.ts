import { Component, ChangeDetectionStrategy, inject, computed, signal, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SelectButton } from 'primeng/selectbutton';
import { Drawer } from 'primeng/drawer';
import { Button } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { AuthService } from './core/auth/auth.service';
import { ViewStateService, ViewState } from './core/auth/view-state.service';
import { DarkModeToggleComponent } from './shared/components/dark-mode-toggle.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SelectButton, Drawer, Button, FormsModule, DarkModeToggleComponent],
  template: `
    <nav class="app-nav">
      <div class="nav-brand">
        <p-button icon="pi pi-bars" [text]="true" class="mobile-menu-btn"
          (onClick)="mobileMenuVisible.set(true)" />
        <a routerLink="/dashboard" class="brand-link">
          <img src="logo.svg" alt="" class="brand-logo" />
          clearfolio
        </a>
      </div>
      <div class="nav-links desktop-only">
        <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
        <a routerLink="/assets" routerLinkActive="active">Assets</a>
        <a routerLink="/liabilities" routerLinkActive="active">Liabilities</a>
        <a routerLink="/snapshots" routerLinkActive="active">Snapshots</a>
        <a routerLink="/settings" routerLinkActive="active">Settings</a>
      </div>
      <div class="nav-right">
        <app-dark-mode-toggle />
        @if (viewOptions().length > 1) {
          <p-selectbutton
            [options]="viewOptions()"
            [ngModel]="viewState.view()"
            (ngModelChange)="viewState.setView($event)"
            optionLabel="label"
            optionValue="value"
            size="small"
            class="desktop-only"
          />
        }
        @if (auth.currentMember(); as member) {
          <span class="user-tag desktop-only">{{ member.displayName }}</span>
        }
      </div>
    </nav>

    <p-drawer [(visible)]="mobileMenuVisible" [showCloseIcon]="true" header="clearfolio">
      <nav class="mobile-nav">
        <a routerLink="/dashboard" routerLinkActive="active" (click)="mobileMenuVisible.set(false)">Dashboard</a>
        <a routerLink="/assets" routerLinkActive="active" (click)="mobileMenuVisible.set(false)">Assets</a>
        <a routerLink="/liabilities" routerLinkActive="active" (click)="mobileMenuVisible.set(false)">Liabilities</a>
        <a routerLink="/snapshots" routerLinkActive="active" (click)="mobileMenuVisible.set(false)">Snapshots</a>
        <a routerLink="/settings" routerLinkActive="active" (click)="mobileMenuVisible.set(false)">Settings</a>
      </nav>
      @if (viewOptions().length > 1) {
        <div class="mobile-view-toggle">
          <p-selectbutton
            [options]="viewOptions()"
            [ngModel]="viewState.view()"
            (ngModelChange)="viewState.setView($event)"
            optionLabel="label"
            optionValue="value"
          />
        </div>
      }
    </p-drawer>

    <main class="app-content">
      <router-outlet />
    </main>
  `,
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected auth = inject(AuthService);
  protected viewState = inject(ViewStateService);
  protected mobileMenuVisible = signal(false);

  protected viewOptions = computed(() => {
    const members = this.auth.members();
    const options: { label: string; value: ViewState }[] = [
      { label: 'Household', value: 'household' },
    ];
    for (const m of members) {
      options.push({ label: m.displayName, value: m.memberTag as ViewState });
    }
    return options;
  });

  ngOnInit() {
    this.auth.init();
  }
}
