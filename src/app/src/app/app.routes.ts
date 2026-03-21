import { Routes } from '@angular/router';
import { requireSetupComplete, requireSetupNeeded, requireAuthenticated } from './core/auth/setup.guard';

export const routes: Routes = [
  {
    path: 'setup',
    loadComponent: () =>
      import('./features/setup/setup.component').then((m) => m.SetupComponent),
    canActivate: [requireSetupNeeded],
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
    canActivate: [requireSetupComplete],
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [requireSetupComplete, requireAuthenticated],
  },
  {
    path: 'assets',
    loadComponent: () =>
      import('./features/assets/assets.component').then((m) => m.AssetsComponent),
    canActivate: [requireSetupComplete, requireAuthenticated],
  },
  {
    path: 'liabilities',
    loadComponent: () =>
      import('./features/liabilities/liabilities.component').then((m) => m.LiabilitiesComponent),
    canActivate: [requireSetupComplete, requireAuthenticated],
  },
  {
    path: 'cashflow',
    loadComponent: () =>
      import('./features/cashflow/cashflow.component').then((m) => m.CashflowComponent),
    canActivate: [requireSetupComplete, requireAuthenticated],
  },
  {
    path: 'snapshots',
    loadComponent: () =>
      import('./features/snapshots/snapshots.component').then((m) => m.SnapshotsComponent),
    canActivate: [requireSetupComplete, requireAuthenticated],
  },
  {
    path: 'projections',
    loadComponent: () =>
      import('./features/projections/projections.component').then((m) => m.ProjectionsComponent),
    canActivate: [requireSetupComplete, requireAuthenticated],
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
    canActivate: [requireSetupComplete, requireAuthenticated],
  },
  {
    path: 'help',
    loadComponent: () =>
      import('./features/help/help.component').then((m) => m.HelpComponent),
    canActivate: [requireSetupComplete, requireAuthenticated],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
