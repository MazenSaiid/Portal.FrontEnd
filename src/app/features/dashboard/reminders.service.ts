import { inject, Injectable, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { Permissions } from '../../core/auth/permissions';
import { DashboardApi, Reminders } from './dashboard.api';

/** Reminder count for the top-bar badge (Spec 005, D3). Refreshed on navigation and after task changes. */
@Injectable({ providedIn: 'root' })
export class RemindersService {
  private readonly api = inject(DashboardApi);
  private readonly auth = inject(AuthService);
  private lastFetch = 0;
  private lastUserId: string | null = null;

  private readonly _reminders = signal<Reminders>({ overdue: 0, dueToday: 0, total: 0 });
  readonly reminders = this._reminders.asReadonly();

  /** `force` skips the 30-second throttle (used right after a task changes). */
  refresh(force = false): void {
    if (!this.auth.hasAnyPermission(Permissions.Dashboard.View)) {
      this._reminders.set({ overdue: 0, dueToday: 0, total: 0 });
      return;
    }
    const userId = this.auth.user()?.id ?? null;
    // Throttle per user, so signing in as someone else never shows the previous user's count.
    if (!force && userId === this.lastUserId && Date.now() - this.lastFetch < 30_000) return;
    this.lastFetch = Date.now();
    this.lastUserId = userId;
    this.api.reminders().subscribe({ next: (r) => this._reminders.set(r), error: () => undefined });
  }

  /** Used by the dashboard, which already receives the counts. */
  set(reminders: Reminders): void {
    this.lastFetch = Date.now();
    this.lastUserId = this.auth.user()?.id ?? null;
    this._reminders.set(reminders);
  }
}
