import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const messageService = inject(MessageService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Don't intercept auth status checks — they're expected to fail before login
      if (req.url.includes('/api/auth/status')) {
        return throwError(() => error);
      }

      if (error.status === 401) {
        router.navigateByUrl('/login');
        return throwError(() => error);
      }

      if (error.status === 429) {
        messageService.add({
          severity: 'warn',
          summary: 'Too many requests',
          detail: 'Please wait a few minutes before trying again.',
          life: 5000,
        });
        return throwError(() => error);
      }

      if (error.status === 0) {
        messageService.add({
          severity: 'error',
          summary: 'Connection error',
          detail: 'Unable to reach the server. Check your connection.',
          life: 5000,
        });
        return throwError(() => error);
      }

      // 4xx client errors — show validation/error message from server if available
      if (error.status >= 400 && error.status < 500) {
        const detail = error.error?.errors?.join(', ') || error.error?.message || 'Invalid request.';
        messageService.add({
          severity: 'error',
          summary: 'Error',
          detail,
          life: 5000,
        });
        return throwError(() => error);
      }

      // 5xx server errors
      if (error.status >= 500) {
        messageService.add({
          severity: 'error',
          summary: 'Server error',
          detail: 'Something went wrong. Please try again.',
          life: 5000,
        });
      }

      return throwError(() => error);
    }),
  );
};
