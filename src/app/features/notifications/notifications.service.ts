import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../../core/http/http-context';

export type NotificationType = 'TicketAssigned' | 'TicketEscalated' | 'SlaAlert';

export interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  ticketId: number | null;
  isRead: boolean;
  createdAt: string;
}

/** In-app notifications (Spec 007, S9): unread count for the bell, polled every minute and on navigation. */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/notifications`;
  private readonly silent = { context: new HttpContext().set(SKIP_ERROR_TOAST, true) };
  private timer?: ReturnType<typeof setInterval>;

  private readonly _unread = signal(0);
  readonly unread = this._unread.asReadonly();

  start(): void {
    this.refreshCount();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.refreshCount(), 60_000);
  }

  stop(): void {
    clearInterval(this.timer);
    this._unread.set(0);
  }

  refreshCount(): void {
    this.http.get<{ count: number }>(`${this.url}/unread-count`, this.silent).subscribe({
      next: (r) => this._unread.set(r.count),
      error: () => undefined,
    });
  }

  list(): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(this.url);
  }

  markRead(id: number): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/read`, null).pipe(tap(() => this._unread.update((n) => Math.max(0, n - 1))));
  }

  markAllRead(): Observable<void> {
    return this.http.post<void>(`${this.url}/read-all`, null).pipe(tap(() => this._unread.set(0)));
  }
}
