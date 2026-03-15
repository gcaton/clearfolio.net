import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'assets',
    loadComponent: () =>
      import('./features/assets/assets.component').then((m) => m.AssetsComponent),
  },
  {
    path: 'liabilities',
    loadComponent: () =>
      import('./features/liabilities/liabilities.component').then((m) => m.LiabilitiesComponent),
  },
  {
    path: 'snapshots',
    loadComponent: () =>
      import('./features/snapshots/snapshots.component').then((m) => m.SnapshotsComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
  },
];
