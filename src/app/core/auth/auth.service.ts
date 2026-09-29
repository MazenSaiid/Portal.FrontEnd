import { HttpClient, HttpContext } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  catchError,
  finalize,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { SKIP_ERROR_TOAST } from '../http/http-context';
import { ChangePasswordRequest, CurrentUser, LoginRequest, LoginResponse } from './auth.models';
import { isExpired, StoredSession, TokenStorage } from './token-storage';

/** Renew this long before the access token expires, so requests never race the expiry. */
const REFRESH_AHEAD_MS = 60_000;
const silent = () => ({ context: new HttpContext().set(SKIP_ERROR_TOAST, true) });

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly storage = inject(TokenStorage);
  private readonly toast = inject(ToastService);
  private readonly url = `${environment.apiUrl}/auth`;

  private readonly _user = signal<CurrentUser | null>(null);
  private readonly _session = signal<StoredSession | null>(null);
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private refreshInFlight$: Observable<string> | null = null;

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._session() !== null && this._user() !== null);
  private readonly permissionSet = computed(() => new Set(this._user()?.permissions ?? []));

  constructor() {
    this.storage.onExternalChange((session) => this.adoptExternalSession(session));
  }

  get token(): string | null {
    return this._session()?.accessToken ?? null;
  }

  get hasRefreshToken(): boolean {
    return this._session() !== null;
  }

  /** True when the user holds at least one of the given permissions. */
  hasAnyPermission(...permissions: string[]): boolean {
    const granted = this.permissionSet();
    return permissions.length === 0 || permissions.some((p) => granted.has(p));
  }

  login(request: LoginRequest): Observable<CurrentUser> {
    return this.http.post<LoginResponse>(`${this.url}/login`, request, silent()).pipe(
      tap((res) => this.startSession(res)),
      map((res) => res.user),
    );
  }

  /**
   * Returns a valid access token, calling POST /auth/refresh at most once at a time:
   * concurrent callers (e.g. several 401s) share the same request.
   */
  refreshAccessToken(): Observable<string> {
    if (this.refreshInFlight$) return this.refreshInFlight$;

    // Another tab may already have rotated the tokens; use its result instead of reusing ours.
    const stored = this.storage.read();
    const current = this._session();
    if (stored && current && stored.refreshToken !== current.refreshToken && !isExpired(stored.expiresAt, REFRESH_AHEAD_MS)) {
      this.applySession(stored);
      return of(stored.accessToken);
    }
    if (!current) return throwError(() => new Error('No session'));

    this.refreshInFlight$ = this.http
      .post<LoginResponse>(`${this.url}/refresh`, { refreshToken: current.refreshToken }, silent())
      .pipe(
        tap((res) => this.startSession(res)),
        map((res) => res.accessToken),
        catchError((err) => {
          this.endSession('Your session has ended. Please sign in again.');
          return throwError(() => err);
        }),
        finalize(() => (this.refreshInFlight$ = null)),
        shareReplay(1),
      );
    return this.refreshInFlight$;
  }

  /** Called once at startup: restores a stored session (renewing it if needed) and loads the profile. */
  restoreSession(): Promise<void> {
    const stored = this.storage.read();
    if (!stored) return Promise.resolve();

    this.applySession(stored);
    const token$ = isExpired(stored.expiresAt, REFRESH_AHEAD_MS) ? this.refreshAccessToken() : of(stored.accessToken);
    return firstValueFrom(
      token$.pipe(
        switchMap(() => this.http.get<CurrentUser>(`${this.url}/me`, silent())),
        tap((user) => this._user.set(user)),
        map(() => undefined),
        catchError(() => {
          this.clearSession();
          return of(undefined);
        }),
      ),
    );
  }

  /** Re-reads the profile so that permission changes show up in the UI without re-login. */
  refreshProfile(): void {
    if (!this._session()) return;
    this.http.get<CurrentUser>(`${this.url}/me`, silent()).subscribe({
      next: (user) => this._user.set(user),
      error: () => undefined,
    });
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    // The server signs out every other device and returns a fresh session for this one.
    return this.http.post<LoginResponse>(`${this.url}/change-password`, request).pipe(
      tap((res) => this.startSession(res)),
      map(() => undefined),
    );
  }

  /** Signs out here and revokes the refresh token on the server. */
  logout(returnUrl?: string): void {
    const refreshToken = this._session()?.refreshToken;
    if (refreshToken) {
      this.http.post(`${this.url}/logout`, { refreshToken }, silent()).subscribe({ error: () => undefined });
    }
    this.clearSession();
    void this.router.navigate(['/login'], { queryParams: returnUrl ? { returnUrl } : undefined });
  }

  private startSession(res: LoginResponse): void {
    const session: StoredSession = {
      accessToken: res.accessToken,
      expiresAt: res.expiresAt,
      refreshToken: res.refreshToken,
      refreshTokenExpiresAt: res.refreshTokenExpiresAt,
    };
    this.storage.write(session);
    this.applySession(session);
    this._user.set(res.user);
  }

  private applySession(session: StoredSession): void {
    this._session.set(session);
    this.scheduleRefresh(session.expiresAt);
  }

  /** The session could not be renewed: tell the user once and go to the login page. */
  private endSession(message: string): void {
    if (!this._session()) return;
    const returnUrl = this.router.url;
    this.clearSession();
    this.toast.info(message);
    void this.router.navigate(['/login'], { queryParams: { returnUrl } });
  }

  private clearSession(): void {
    clearTimeout(this.refreshTimer);
    this._session.set(null);
    this._user.set(null);
    this.storage.clear();
  }

  private scheduleRefresh(expiresAt: string): void {
    clearTimeout(this.refreshTimer);
    const delay = Math.max(new Date(expiresAt).getTime() - Date.now() - REFRESH_AHEAD_MS, 5_000);
    // setTimeout overflows above ~24.8 days; access tokens are minutes long, but guard anyway.
    if (delay < 2_147_000_000) {
      this.refreshTimer = setTimeout(() => this.refreshAccessToken().subscribe({ error: () => undefined }), delay);
    }
  }

  private adoptExternalSession(session: StoredSession | null): void {
    if (!session) {
      // Signed out in another tab.
      if (this._session()) {
        this.clearSession();
        void this.router.navigate(['/login']);
      }
      return;
    }
    const wasSignedIn = this.isAuthenticated();
    this.applySession(session);
    if (!wasSignedIn) this.refreshProfile(); // signed in from another tab
  }
}
