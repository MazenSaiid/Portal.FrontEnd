import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { CurrentUser, LoginResponse } from './auth.models';
import { AuthService } from './auth.service';

const user: CurrentUser = {
  id: 'u1',
  email: 'sara@test.local',
  firstName: 'Sara',
  lastName: 'Ali',
  fullName: 'Sara Ali',
  roleId: 'r1',
  roleName: 'Agent',
  permissions: ['Users.View'],
};

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function login(expiresAt = new Date(Date.now() + 3_600_000).toISOString()): void {
    auth.login({ email: user.email, password: 'x' }).subscribe();
    const response: LoginResponse = { accessToken: 'token-1', expiresAt, user };
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(response);
  }

  it('starts a session on login and exposes permissions', () => {
    login();

    expect(auth.isAuthenticated()).toBeTrue();
    expect(auth.token).toBe('token-1');
    expect(auth.hasAnyPermission('Users.View')).toBeTrue();
    expect(auth.hasAnyPermission('Users.Delete')).toBeFalse();
    expect(auth.hasAnyPermission('Users.Delete', 'Users.View')).toBeTrue();
    expect(localStorage.getItem('portal.session')).toContain('token-1');
  });

  it('treats an empty permission list as "any signed-in user"', () => {
    login();
    expect(auth.hasAnyPermission()).toBeTrue();
  });

  it('clears everything on logout', () => {
    login();
    auth.logout();

    expect(auth.isAuthenticated()).toBeFalse();
    expect(auth.token).toBeNull();
    expect(localStorage.getItem('portal.session')).toBeNull();
  });

  it('restores a stored session and refreshes the profile from the server', async () => {
    localStorage.setItem('portal.session', JSON.stringify({
      accessToken: 'stored', expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }));

    const done = auth.restoreSession();
    http.expectOne(`${environment.apiUrl}/auth/me`).flush({ ...user, permissions: ['Roles.View'] });
    await done;

    expect(auth.isAuthenticated()).toBeTrue();
    expect(auth.hasAnyPermission('Roles.View')).toBeTrue();
  });

  it('ignores an expired stored token without calling the server', async () => {
    localStorage.setItem('portal.session', JSON.stringify({
      accessToken: 'old', expiresAt: new Date(Date.now() - 1000).toISOString(),
    }));

    await auth.restoreSession();

    http.expectNone(`${environment.apiUrl}/auth/me`);
    expect(auth.isAuthenticated()).toBeFalse();
  });

  it('drops the session when the server rejects the stored token', async () => {
    localStorage.setItem('portal.session', JSON.stringify({
      accessToken: 'revoked', expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }));

    const done = auth.restoreSession();
    http.expectOne(`${environment.apiUrl}/auth/me`).flush(null, { status: 401, statusText: 'Unauthorized' });
    await done;

    expect(auth.isAuthenticated()).toBeFalse();
    expect(localStorage.getItem('portal.session')).toBeNull();
  });
});
