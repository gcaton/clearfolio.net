import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

function waitForAuth(auth: AuthService): Promise<void> {
  if (!auth.loading()) return Promise.resolve();
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (!auth.loading()) {
        clearInterval(check);
        resolve();
      }
    }, 50);
  });
}

export const requireSetupComplete: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await waitForAuth(auth);
  if (auth.needsSetup()) return router.createUrlTree(['/setup']);
  return true;
};

export const requireSetupNeeded: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await waitForAuth(auth);
  if (!auth.needsSetup()) return router.createUrlTree(['/dashboard']);
  return true;
};
