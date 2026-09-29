import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { CurrentUser, LoginResponse } from './auth.models';
import { AuthService } from './auth.service';
import { SESSION_KEY } from './token-storage';

export const testUser: CurrentUser = {
  id: 'u1',
  email: 'sara@test.local',
  firstName: 'Sara',
  lastName: 'Ali',
  fullName: 'Sara Ali',
  roleId: 'r1',
  roleName: 'Agent',
  permissions: ['Users.View'],
};

const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

export function loginResponse(access = 'access-1', refresh = 'refresh-1', accessMinutes = 15): LoginResponse {
  return {
    accessToken: access,
    expiresAt: inMinutes(accessMinutes),
    refreshToken: refresh,
    refreshTokenExpiresAt: inMinutes(60 * 24 * 7),
    user: testUser,
  };
}

function storeSession(accessMinutes: number, refresh = 'stored-refresh'): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    accessToken: 'stored-access',
    expiresAt: inMinutes(accessMinutes),
    refreshToken: refresh,
    refreshTokenExpiresAt: inMinutes(60),
  }));
}

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  const api = environment.apiUrl;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  function login(): void {
    auth.login({ email: testUser.email, password: 'x' }).subscribe();
    http.expectOne(`${api}/auth/login`).flush(loginResponse());
  }

  it('starts a session on login and exposes permissions', () => {
    login();

    expect(auth.isAuthenticated()).toBeTrue();
    expect(auth.token).toBe('access-1');
    expect(auth.hasAnyPermission('Users.View')).toBeTrue();
    expect(auth.hasAnyPermission('Users.Delete')).toBeFalse();
    expect(auth.hasAnyPermission('Users.Delete', 'Users.View')).toBeTrue();
    expect(localStorage.getItem(SESSION_KEY)).toContain('refresh-1');
  });

  it('treats an empty permission list as "any signed-in user"', () => {
    login();
    expect(auth.hasAnyPermission()).toBeTrue();
  });

  it('revokes the refresh token on the server and clears everything on logout', () => {
    login();
    auth.logout();

    const req = http.expectOne(`${api}/auth/logout`);
    expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(auth.isAuthenticated()).toBeFalse();
    expect(auth.token).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('restores a stored session with a valid access token by loading the profile', async () => {
    storeSession(10);

    const done = auth.restoreSession();
    http.expectOne(`${api}/auth/me`).flush({ ...testUser, permissions: ['Roles.View'] });
    await done;

    expect(auth.isAuthenticated()).toBeTrue();
    expect(auth.hasAnyPermission('Roles.View')).toBeTrue();
  });

  it('renews an expired access token before loading the profile', async () => {
    storeSession(-1);

    const done = auth.restoreSession();
    const refresh = http.expectOne(`${api}/auth/refresh`);
    expect(refresh.request.body).toEqual({ refreshToken: 'stored-refresh' });
    refresh.flush(loginResponse('renewed', 'refresh-2'));
    await Promise.resolve();
    http.expectOne(`${api}/auth/me`).flush(testUser);
    await done;

    expect(auth.token).toBe('renewed');
    expect(localStorage.getItem(SESSION_KEY)).toContain('refresh-2');
  });

  it('shares one refresh request between concurrent callers', () => {
    login();
    const results: string[] = [];

    auth.refreshAccessToken().subscribe((t) => results.push(t));
    auth.refreshAccessToken().subscribe((t) => results.push(t));

    http.expectOne(`${api}/auth/refresh`).flush(loginResponse('access-2', 'refresh-2'));
    expect(results).toEqual(['access-2', 'access-2']);
  });

  it('signs out when the refresh token is rejected', () => {
    login();

    auth.refreshAccessToken().subscribe({ error: () => undefined });
    http.expectOne(`${api}/auth/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBeFalse();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('adopts tokens another tab already rotated instead of reusing its own', () => {
    login();
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      accessToken: 'from-other-tab', expiresAt: inMinutes(15),
      refreshToken: 'other-refresh', refreshTokenExpiresAt: inMinutes(60),
    }));

    let token = '';
    auth.refreshAccessToken().subscribe((t) => (token = t));

    http.expectNone(`${api}/auth/refresh`);
    expect(token).toBe('from-other-tab');
  });

  it('ignores a stored session whose refresh token has expired', async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      accessToken: 'old', expiresAt: inMinutes(-100), refreshToken: 'old', refreshTokenExpiresAt: inMinutes(-1),
    }));

    await auth.restoreSession();

    http.expectNone(`${api}/auth/refresh`);
    expect(auth.isAuthenticated()).toBeFalse();
  });
});
