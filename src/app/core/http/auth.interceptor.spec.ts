import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { loginResponse } from '../auth/auth.service.spec';
import { AuthService } from '../auth/auth.service';
import { authInterceptor } from './auth.interceptor';
import { errorInterceptor } from './error.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;
  const api = environment.apiUrl;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);

    auth.login({ email: 'a@b.c', password: 'x' }).subscribe();
    backend.expectOne(`${api}/auth/login`).flush(loginResponse('access-1', 'refresh-1'));
  });

  afterEach(() => {
    backend.verify();
    localStorage.clear();
  });

  const unauthorized = { status: 401, statusText: 'Unauthorized' };

  it('adds the bearer token to API calls only', () => {
    http.get(`${api}/users`).subscribe();
    http.get('https://example.com/data').subscribe();

    expect(backend.expectOne(`${api}/users`).request.headers.get('Authorization')).toBe('Bearer access-1');
    expect(backend.expectOne('https://example.com/data').request.headers.has('Authorization')).toBeFalse();
  });

  it('renews the token on 401 and retries the request once', () => {
    let body: unknown;
    http.get(`${api}/users`).subscribe((b) => (body = b));

    backend.expectOne(`${api}/users`).flush(null, unauthorized);
    backend.expectOne(`${api}/auth/refresh`).flush(loginResponse('access-2', 'refresh-2'));
    const retry = backend.expectOne(`${api}/users`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush({ ok: true });

    expect(body).toEqual({ ok: true });
  });

  it('uses a single refresh for several requests that fail together', () => {
    http.get(`${api}/users`).subscribe();
    http.get(`${api}/roles`).subscribe();

    backend.expectOne(`${api}/users`).flush(null, unauthorized);
    backend.expectOne(`${api}/roles`).flush(null, unauthorized);
    backend.expectOne(`${api}/auth/refresh`).flush(loginResponse('access-2', 'refresh-2'));

    backend.expectOne(`${api}/users`).flush([]);
    backend.expectOne(`${api}/roles`).flush([]);
  });

  it('signs out when renewal fails and surfaces the original 401', () => {
    let status = 0;
    http.get(`${api}/users`).subscribe({ error: (e) => (status = e.status) });

    backend.expectOne(`${api}/users`).flush(null, unauthorized);
    backend.expectOne(`${api}/auth/refresh`).flush(null, unauthorized);

    expect(status).toBe(401);
    expect(auth.isAuthenticated()).toBeFalse();
  });

  it('never tries to refresh for the login endpoint itself', () => {
    http.post(`${api}/auth/login`, {}).subscribe({ error: () => undefined });
    backend.expectOne(`${api}/auth/login`).flush(null, unauthorized);
    backend.expectNone(`${api}/auth/refresh`);
    backend.expectOne(`${api}/auth/logout`).flush(null); // a non-silent 401 still ends the session
  });
});
