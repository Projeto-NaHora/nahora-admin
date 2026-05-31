import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError, shareReplay, switchMap } from 'rxjs/operators';

import { AuthService } from '../services/auth.service';

let refreshInProgress$: Observable<{ accessToken: string; refreshToken: string }> | null = null;

export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Only handle 401 errors
      if (error.status !== 401) {
        return throwError(() => error);
      }

      // Don't intercept refresh calls themselves (prevents infinite loop)
      if (req.url.includes('/auth/refresh')) {
        return throwError(() => error);
      }

      // If a refresh is already in progress, queue this request
      if (refreshInProgress$) {
        return refreshInProgress$.pipe(
          switchMap(({ accessToken }) => {
            return next(
              req.clone({
                setHeaders: { Authorization: `Bearer ${accessToken}` },
              }),
            );
          }),
        );
      }

      // Start a new refresh — shareReplay(1) ensures concurrent subscribers
      // share the same API call and late subscribers get the cached result
      refreshInProgress$ = authService.refreshToken().pipe(shareReplay(1));

      return refreshInProgress$.pipe(
        switchMap(({ accessToken }) => {
          refreshInProgress$ = null;
          return next(
            req.clone({
              setHeaders: { Authorization: `Bearer ${accessToken}` },
            }),
          );
        }),
        catchError((refreshError) => {
          refreshInProgress$ = null;
          authService.logout();
          router.navigate(['/login']);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
