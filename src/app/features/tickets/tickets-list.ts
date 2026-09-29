import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, finalize, of, switchMap } from 'rxjs';
import { Permissions } from '../../core/auth/permissions';
import { PagedResult } from '../../core/models/api.models';
import { HasPermission } from '../../shared/directives/has-permission';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { Pagination } from '../../shared/ui/pagination';
import { SortHeader } from '../../shared/ui/sort-header';
import { EmptyState, Spinner } from '../../shared/ui/states';
import { initials } from '../../shared/utils/format';
import { ACTIVE_STATUSES, PRIORITIES, priorityMeta, STATUSES, statusMeta } from './ticket-labels';
import { TicketFormDialog } from './ticket-form-dialog';
import { Assignee, Ticket, TicketCategory, TicketListItem, TicketPriority, TicketQuery, TicketsApi, TicketStatus } from './tickets.api';

/** The team's work queue: defaults to active tickets, most recently active first. */
@Component({
  selector: 'app-tickets-list',
  imports: [
    DatePipe, ReactiveFormsModule, RouterLink, PageHeader, Pagination, SortHeader, EmptyState, Spinner, Icon,
    HasPermission, TicketFormDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tickets-list.html',
  styleUrl: './tickets-list.scss',
})
export class TicketsList {
  private readonly api = inject(TicketsApi);
  private readonly router = inject(Router);
  protected readonly P = Permissions;
  protected readonly statuses = STATUSES;
  protected readonly priorities = PRIORITIES;
  protected readonly statusMeta = statusMeta;
  protected readonly priorityMeta = priorityMeta;
  protected readonly initials = initials;

  protected readonly query = signal<TicketQuery>({
    status: ACTIVE_STATUSES, page: 1, pageSize: 10, sortBy: 'lastActivityAt', sortDirection: 'desc',
  });
  protected readonly result = signal<PagedResult<TicketListItem> | null>(null);
  protected readonly loading = signal(true);
  protected readonly creating = signal(false);
  protected readonly categories = signal<TicketCategory[]>([]);
  protected readonly assignees = signal<Assignee[]>([]);
  protected readonly search = new FormControl('', { nonNullable: true });

  constructor() {
    this.api.categories().subscribe((c) => this.categories.set(c));
    this.api.assignees().subscribe((a) => this.assignees.set(a));

    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((search) => this.patchQuery({ search: search.trim() || undefined }));

    toObservable(this.query)
      .pipe(
        switchMap((query) => {
          this.loading.set(true);
          return this.api.list(query).pipe(
            catchError(() => of(null)),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        if (result) this.result.set(result);
      });
  }

  protected patchQuery(patch: Partial<TicketQuery>): void {
    this.query.update((q) => ({ ...q, page: 1, ...patch }));
  }

  protected goToPage(page: number): void {
    this.query.update((q) => ({ ...q, page }));
  }

  protected sortBy(column: string): void {
    const q = this.query();
    this.patchQuery({ sortBy: column, sortDirection: q.sortBy === column && q.sortDirection === 'desc' ? 'asc' : 'desc' });
  }

  /** '' = everything, 'active' = still needs work, otherwise one status. */
  protected onStatusFilter(value: string): void {
    this.patchQuery({ status: value === 'active' ? ACTIVE_STATUSES : value ? [value as TicketStatus] : undefined });
  }

  protected onPriorityFilter(value: string): void {
    this.patchQuery({ priority: (value || undefined) as TicketPriority | undefined });
  }

  protected onCategoryFilter(value: string): void {
    this.patchQuery({ categoryId: value ? Number(value) : undefined });
  }

  protected onAssigneeFilter(value: string): void {
    this.patchQuery({ assignedTo: value || undefined });
  }

  protected toggleEscalated(): void {
    this.patchQuery({ escalated: this.query().escalated ? undefined : true });
  }

  protected isFiltered(): boolean {
    const q = this.query();
    return !!q.search || !!q.priority || !!q.categoryId || !!q.assignedTo || !!q.escalated;
  }

  protected onCreated(ticket: Ticket): void {
    this.creating.set(false);
    void this.router.navigate(['/tickets', ticket.id]);
  }
}
