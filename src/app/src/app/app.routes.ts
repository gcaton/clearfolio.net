import { Routes } from '@angular/router';
import { requireSetupComplete, requireSetupNeeded } from './core/auth/setup.guard';

export const routes: Routes = [
  {
    path: 'setup',
    loadComponent: () =>
      import('./features/setup/setup.component').then((m) => m.SetupComponent),
    canActivate: [requireSetupNeeded],
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [requireSetupComplete],
  },
  {
    path: 'assets',
    loadComponent: () =>
      import('./features/assets/assets.component').then((m) => m.AssetsComponent),
    canActivate: [requireSetupComplete],
  },
  {
    path: 'liabilities',
    loadComponent: () =>
      import('./features/liabilities/liabilities.component').then((m) => m.LiabilitiesComponent),
    canActivate: [requireSetupComplete],
  },
  {
    path: 'cashflow',
    loadComponent: () =>
      import('./features/cashflow/cashflow.component').then((m) => m.CashflowComponent),
    canActivate: [requireSetupComplete],
  },
  {
    path: 'snapshots',
    loadComponent: () =>
      import('./features/snapshots/snapshots.component').then((m) => m.SnapshotsComponent),
    canActivate: [requireSetupComplete],
  },
  {
    path: 'projections',
    loadComponent: () =>
      import('./features/projections/projections.component').then((m) => m.ProjectionsComponent),
    canActivate: [requireSetupComplete],
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
    canActivate: [requireSetupComplete],
  },
  {
    path: 'help',
    loadComponent: () =>
      import('./features/help/help.component').then((m) => m.HelpComponent),
    canActivate: [requireSetupComplete],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
