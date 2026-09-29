import { Injectable } from '@angular/core';

export interface StoredSession {
  accessToken: string;
  expiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export const SESSION_KEY = 'portal.session';

/**
 * Persists the session across reloads and tabs. A session is usable while its refresh token
 * is valid; an expired access token is renewed by AuthService.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  read(): StoredSession | null {
    try {
      return parse(localStorage.getItem(SESSION_KEY));
    } catch {
      return null;
    }
  }

  write(session: StoredSession): void {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      // Storage unavailable (private mode): the session simply won't survive a reload.
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  /** Calls back when another tab signs in, refreshes (new value) or signs out (null). */
  onExternalChange(callback: (session: StoredSession | null) => void): void {
    window.addEventListener('storage', (event) => {
      if (event.key === SESSION_KEY || event.key === null) callback(parse(event.newValue));
    });
  }
}

function parse(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as StoredSession;
    if (!session.refreshToken || new Date(session.refreshTokenExpiresAt).getTime() <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function isExpired(isoDate: string, skewMs = 0): boolean {
  return new Date(isoDate).getTime() - skewMs <= Date.now();
}
