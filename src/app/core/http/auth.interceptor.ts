import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

/** Auth endpoints that must never trigger a refresh (they are how you get tokens). */
const TOKEN_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/logout'];

/**
 * Attaches the bearer token to API calls (never to third-party URLs). On a 401 it renews
 * the access token once and retries the request; if renewal fails the user is signed out.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  if (!req.url.startsWith(environment.apiUrl)) return next(req);

  const isTokenEndpoint = TOKEN_ENDPOINTS.some((path) => req.url.startsWith(environment.apiUrl + path));

  return next(withToken(req, auth.token)).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || isTokenEndpoint || !auth.hasRefreshToken) {
        return throwError(() => err);
      }
      return auth.refreshAccessToken().pipe(
        catchError(() => throwError(() => err)), // renewal failed: surface the original 401
        switchMap((token) => next(withToken(req, token))),
      );
    }),
  );
};

function withToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}
