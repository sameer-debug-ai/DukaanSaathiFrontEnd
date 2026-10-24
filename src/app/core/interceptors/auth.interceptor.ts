import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

/** Auth endpoints that must never trigger a refresh-and-retry loop. */
const NO_RETRY = ['/auth/login', '/auth/register', '/auth/refresh'];

const withToken = (req: HttpRequest<unknown>, token: string | null) =>
  token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

/**
 * Adds the Bearer token to API calls. On a 401 it refreshes the access token once
 * and retries; if refresh fails the session is cleared and the user goes to /login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);
  const skipRetry = NO_RETRY.some((p) => req.url.includes(p));

  return next(withToken(req, auth.token())).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || skipRetry) {
        return throwError(() => err);
      }
      return auth.refresh().pipe(
        catchError((refreshErr: unknown) => {
          auth.clearSession();
          void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
          return throwError(() => refreshErr);
        }),
        switchMap((token) => next(withToken(req, token))),
      );
    }),
  );
};
