import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Permissions } from '../../core/auth/permissions';
import { Icon } from '../../shared/ui/icon';
import { EmptyState, Spinner } from '../../shared/ui/states';
import { priorityMeta, statusMeta } from './ticket-labels';
import { TicketFormDialog } from './ticket-form-dialog';
import { CustomerLookup, Ticket, TicketListItem, TicketsApi } from './tickets.api';

/** "Tickets" tab on the customer page: that customer's tickets, newest activity first. */
@Component({
  selector: 'app-customer-tickets',
  imports: [DatePipe, RouterLink, Icon, EmptyState, Spinner, TicketFormDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (canCreate() && customer().isActive) {
      <button type="button" class="btn btn-primary btn-sm add" (click)="creating.set(true)">
        <app-icon name="plus" [size]="14" /> New ticket
      </button>
    }
    @if (loading()) {
      <div class="loading"><app-spinner /></div>
    } @else if (tickets().length === 0) {
      <app-empty-state icon="ticket" title="No tickets" message="Requests from this customer will appear here." />
    } @else {
      <ul class="list">
        @for (t of tickets(); track t.id) {
          <li>
            <a [routerLink]="['/tickets', t.id]" class="row" [class.escalated]="t.isEscalated">
              <div class="text">
                <strong>{{ t.subject }}</strong>
                <span class="text-xs text-muted">{{ t.code }} · {{ t.categoryName }} · {{ t.assigneeName ?? 'Unassigned' }} · {{ t.lastActivityAt | date: 'MMM d' }}</span>
              </div>
              <span [class]="'badge ' + priorityMeta(t.priority).badge">{{ priorityMeta(t.priority).label }}</span>
              <span [class]="'badge badge-dot ' + statusMeta(t.status).badge">{{ statusMeta(t.status).label }}</span>
            </a>
          </li>
        }
      </ul>
    }
    @if (creating()) {
      <app-ticket-form-dialog [customer]="customer()" (saved)="onCreated($event)" (closed)="creating.set(false)" />
    }
  `,
  styles: `
    .add { margin-block-end: var(--space-5); }
    .loading { display: grid; place-items: center; padding: var(--space-8); }
    .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
    .row { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4);
      border: 1px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text); }
    .row:hover { text-decoration: none; border-color: var(--color-primary); background: var(--color-surface-muted); }
    .row.escalated { border-inline-start: 3px solid var(--color-danger); }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  `,
})
export class CustomerTickets implements OnInit {
  private readonly api = inject(TicketsApi);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly customer = input.required<CustomerLookup>();

  protected readonly statusMeta = statusMeta;
  protected readonly priorityMeta = priorityMeta;
  protected readonly canCreate = computed(() => this.auth.hasAnyPermission(Permissions.Tickets.Create));
  protected readonly tickets = signal<TicketListItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly creating = signal(false);

  ngOnInit(): void {
    this.api
      .list({ customerId: this.customer().id, page: 1, pageSize: 50, sortBy: 'lastActivityAt', sortDirection: 'desc' })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((r) => this.tickets.set(r.items));
  }

  protected onCreated(ticket: Ticket): void {
    this.creating.set(false);
    void this.router.navigate(['/tickets', ticket.id]);
  }
}
