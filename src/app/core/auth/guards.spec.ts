import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { authGuard, permissionGuard } from './guards';

describe('route guards', () => {
  let granted: string[];
  let signedIn: boolean;

  beforeEach(() => {
    granted = [];
    signedIn = true;
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => signedIn,
            hasAnyPermission: (...p: string[]) => p.length === 0 || p.some((x) => granted.includes(x)),
          },
        },
      ],
    });
  });

  const route = (permissions?: string[]) => ({ data: { permissions } }) as unknown as ActivatedRouteSnapshot;
  const state = (url: string) => ({ url }) as RouterStateSnapshot;
  const run = (guard: typeof authGuard, r: ActivatedRouteSnapshot, s: RouterStateSnapshot) =>
    TestBed.runInInjectionContext(() => guard(r, s));
  const serialize = (result: unknown) => TestBed.inject(Router).serializeUrl(result as UrlTree);

  it('authGuard sends anonymous users to login with a return url', () => {
    signedIn = false;
    expect(serialize(run(authGuard, route(), state('/users')))).toBe('/login?returnUrl=%2Fusers');
  });

  it('permissionGuard allows users holding any required permission', () => {
    granted = ['Users.View'];
    expect(run(permissionGuard, route(['Roles.View', 'Users.View']), state('/x'))).toBeTrue();
  });

  it('permissionGuard redirects to /forbidden without the permission', () => {
    granted = ['Roles.View'];
    expect(serialize(run(permissionGuard, route(['Users.View']), state('/users')))).toBe('/forbidden');
  });

  it('permissionGuard allows routes that declare no permissions', () => {
    expect(run(permissionGuard, route(undefined), state('/'))).toBeTrue();
  });
});
