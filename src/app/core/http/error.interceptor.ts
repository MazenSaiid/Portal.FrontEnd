import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { AuthService } from '../auth/auth.service';
import { ApiError, ProblemDetails } from '../models/api.models';
import { SKIP_ERROR_TOAST } from './http-context';

/**
 * Converts every HTTP failure into an {@link ApiError} and gives consistent feedback:
 * 401 → back to login, 400 with field errors → left to the form, everything else → toast.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const toast = inject(ToastService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);

      const error = toApiError(err);
      const silent = req.context.get(SKIP_ERROR_TOAST);

      if (error.status === 401 && !silent) {
        toast.info('Your session has ended. Please sign in again.');
        auth.logout(router.url);
      } else if (error.status === 403) {
        // Permissions may have changed since the page loaded; refresh so the UI catches up.
        auth.refreshProfile();
        if (!silent) toast.error('You do not have permission to perform this action.');
      } else if (!silent && !(error.status === 400 && error.hasFieldErrors)) {
        toast.error(error.message);
      }

      return throwError(() => error);
    }),
  );
};

function toApiError(err: HttpErrorResponse): ApiError {
  if (err.status === 0) return new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  if (err.status === 429) return new ApiError(429, 'Too many attempts. Please wait a minute and try again.');

  const problem = (typeof err.error === 'object' ? err.error : null) as ProblemDetails | null;
  const message = problem?.detail ?? problem?.title ?? 'Something went wrong. Please try again.';
  return new ApiError(err.status, message, problem?.errors ?? {});
}
