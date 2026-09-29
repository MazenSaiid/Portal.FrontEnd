import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Only signed-in users may enter; others go to login and come back afterwards. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.isAuthenticated()
    ? true
    : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Keeps signed-in users away from the login page. */
export const guestGuard: CanActivateFn = () =>
  inject(AuthService).isAuthenticated() ? inject(Router).createUrlTree(['/']) : true;

/**
 * Requires any of the permissions listed in `route.data.permissions`.
 * Usage: `{ path: 'users', canActivate: [permissionGuard], data: { permissions: [Permissions.Users.View] } }`
 */
export const permissionGuard: CanActivateFn = (route) => {
  const required = (route.data['permissions'] as string[] | undefined) ?? [];
  return inject(AuthService).hasAnyPermission(...required) ? true : inject(Router).createUrlTree(['/forbidden']);
};
