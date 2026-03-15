import { Component, ChangeDetectionStrategy, inject, computed, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SelectButton } from 'primeng/selectbutton';
import { FormsModule } from '@angular/forms';
import { AuthService } from './core/auth/auth.service';
import { ViewStateService, ViewState } from './core/auth/view-state.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SelectButton, FormsModule],
  template: `
    <nav class="app-nav">
      <div class="nav-brand">
        <a routerLink="/dashboard" class="brand-link">clearfolio</a>
      </div>
      <div class="nav-links">
        <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
        <a routerLink="/assets" routerLinkActive="active">Assets</a>
        <a routerLink="/liabilities" routerLinkActive="active">Liabilities</a>
        <a routerLink="/snapshots" routerLinkActive="active">Snapshots</a>
        <a routerLink="/settings" routerLinkActive="active">Settings</a>
      </div>
      <div class="nav-right">
        @if (viewOptions().length > 1) {
          <p-selectbutton
            [options]="viewOptions()"
            [ngModel]="viewState.view()"
            (ngModelChange)="viewState.setView($event)"
            optionLabel="label"
            optionValue="value"
            size="small"
          />
        }
        @if (auth.currentMember(); as member) {
          <span class="user-tag">{{ member.displayName }}</span>
        }
      </div>
    </nav>
    <main class="app-content">
      <router-outlet />
    </main>
  `,
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected auth = inject(AuthService);
  protected viewState = inject(ViewStateService);

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
