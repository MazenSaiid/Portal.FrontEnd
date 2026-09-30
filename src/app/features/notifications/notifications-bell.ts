import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Icon, IconName } from '../../shared/ui/icon';
import { AppNotification, NotificationsService, NotificationType } from './notifications.service';

const ICONS: Record<NotificationType, IconName> = { TicketAssigned: 'user', TicketEscalated: 'flag', SlaAlert: 'clock' };

@Component({
  selector: 'app-notifications-bell',
  imports: [DatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'open.set(false)', '(document:keydown.escape)': 'open.set(false)' },
  template: `
    <div class="wrap">
      <button type="button" class="bell" [attr.aria-expanded]="open()" aria-label="Notifications" (click)="toggle($event)">
        <app-icon name="bell" [size]="18" />
        @if (service.unread() > 0) {
          <span class="count">{{ service.unread() > 99 ? '99+' : service.unread() }}</span>
        }
      </button>
      @if (open()) {
        <div class="panel card" role="dialog" aria-label="Notifications" (click)="$event.stopPropagation()">
          <header>
            <strong>Notifications</strong>
            @if (service.unread() > 0) {
              <button type="button" class="btn btn-ghost btn-sm" (click)="markAll()">Mark all read</button>
            }
          </header>
          @if (loading()) {
            <p class="empty text-sm text-muted">Loading…</p>
          } @else {
            <ul>
              @for (n of items(); track n.id) {
                <li>
                  <button type="button" class="item" [class.unread]="!n.isRead" (click)="openItem(n)">
                    <span class="icon" [class]="'icon type-' + n.type"><app-icon [name]="icon(n)" [size]="14" /></span>
                    <span class="text">
                      <strong>{{ n.title }}</strong>
                      <span class="text-sm text-muted">{{ n.message }}</span>
                      <span class="text-xs text-muted">{{ n.createdAt | date: 'MMM d, h:mm a' }}</span>
                    </span>
                  </button>
                </li>
              } @empty {
                <li class="empty text-sm text-muted">You're all caught up.</li>
              }
            </ul>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './notifications-bell.scss',
})
export class NotificationsBell implements OnInit, OnDestroy {
  protected readonly service = inject(NotificationsService);
  private readonly router = inject(Router);

  protected readonly open = signal(false);
  protected readonly loading = signal(false);
  protected readonly items = signal<AppNotification[]>([]);

  ngOnInit(): void {
    this.service.start();
  }

  ngOnDestroy(): void {
    this.service.stop();
  }

  protected icon(n: AppNotification): IconName {
    return ICONS[n.type] ?? 'info';
  }

  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.open.update((v) => !v);
    if (this.open()) {
      this.loading.set(true);
      this.service.list().subscribe({
        next: (list) => {
          this.items.set(list);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }

  protected openItem(n: AppNotification): void {
    if (!n.isRead) {
      this.service.markRead(n.id).subscribe();
      this.items.update((list) => list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    }
    this.open.set(false);
    if (n.ticketId) void this.router.navigate(['/tickets', n.ticketId]);
  }

  protected markAll(): void {
    this.service.markAllRead().subscribe(() => this.items.update((list) => list.map((x) => ({ ...x, isRead: true }))));
  }
}
