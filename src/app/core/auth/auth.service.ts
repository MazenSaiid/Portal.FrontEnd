import { HttpClient, HttpContext } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, map, Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/http-context';
import { ChangePasswordRequest, CurrentUser, LoginRequest, LoginResponse } from './auth.models';
import { TokenStorage } from './token-storage';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly storage = inject(TokenStorage);
  private readonly url = `${environment.apiUrl}/auth`;

  private readonly _user = signal<CurrentUser | null>(null);
  private readonly _token = signal<string | null>(null);
  private expiryTimer?: ReturnType<typeof setTimeout>;

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._token() !== null && this._user() !== null);
  private readonly permissionSet = computed(() => new Set(this._user()?.permissions ?? []));

  get token(): string | null {
    return this._token();
  }

  /** True when the user holds at least one of the given permissions. */
  hasAnyPermission(...permissions: string[]): boolean {
    const granted = this.permissionSet();
    return permissions.length === 0 || permissions.some((p) => granted.has(p));
  }

  login(request: LoginRequest): Observable<CurrentUser> {
    return this.http
      .post<LoginResponse>(`${this.url}/login`, request, {
        context: new HttpContext().set(SKIP_ERROR_TOAST, true),
      })
      .pipe(
        tap((res) => this.startSession(res.accessToken, res.expiresAt, res.user)),
        map((res) => res.user),
      );
  }

  /** Called once at startup: restores a stored session and refreshes permissions from the server. */
  restoreSession(): Promise<void> {
    const stored = this.storage.read();
    if (!stored) return Promise.resolve();

    this._token.set(stored.accessToken);
    this.scheduleExpiry(stored.expiresAt);
    return firstValueFrom(
      this.http.get<CurrentUser>(`${this.url}/me`, { context: new HttpContext().set(SKIP_ERROR_TOAST, true) }).pipe(
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
    if (!this._token()) return;
    this.http
      .get<CurrentUser>(`${this.url}/me`, { context: new HttpContext().set(SKIP_ERROR_TOAST, true) })
      .subscribe({ next: (user) => this._user.set(user), error: () => undefined });
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.url}/change-password`, request);
  }

  logout(returnUrl?: string): void {
    this.clearSession();
    void this.router.navigate(['/login'], { queryParams: returnUrl ? { returnUrl } : undefined });
  }

  private startSession(accessToken: string, expiresAt: string, user: CurrentUser): void {
    this._token.set(accessToken);
    this._user.set(user);
    this.storage.write({ accessToken, expiresAt });
    this.scheduleExpiry(expiresAt);
  }

  private clearSession(): void {
    clearTimeout(this.expiryTimer);
    this._token.set(null);
    this._user.set(null);
    this.storage.clear();
  }

  private scheduleExpiry(expiresAt: string): void {
    clearTimeout(this.expiryTimer);
    const ms = new Date(expiresAt).getTime() - Date.now();
    // setTimeout overflows above ~24.8 days; tokens are far shorter, but guard anyway.
    if (ms > 0 && ms < 2_147_000_000) {
      this.expiryTimer = setTimeout(() => this.logout(this.router.url), ms);
    }
  }
}
