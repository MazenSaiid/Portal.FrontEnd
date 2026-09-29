import { Injectable } from '@angular/core';

interface StoredToken {
  accessToken: string;
  expiresAt: string;
}

const KEY = 'portal.session';

/** Persists the access token across reloads; expired tokens are treated as absent. */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  read(): StoredToken | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const token = JSON.parse(raw) as StoredToken;
      if (new Date(token.expiresAt).getTime() <= Date.now()) {
        this.clear();
        return null;
      }
      return token;
    } catch {
      return null;
    }
  }

  write(token: StoredToken): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(token));
    } catch {
      // Storage unavailable (private mode): the session simply won't survive a reload.
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}
