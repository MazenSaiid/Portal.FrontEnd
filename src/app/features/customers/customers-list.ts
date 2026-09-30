import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, finalize, of, switchMap } from 'rxjs';
import { Permissions } from '../../core/auth/permissions';
import { PagedResult } from '../../core/models/api.models';
import { HasPermission } from '../../shared/directives/has-permission';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { Pagination } from '../../shared/ui/pagination';
import { SortHeader } from '../../shared/ui/sort-header';
import { EmptyState, Spinner } from '../../shared/ui/states';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { initials } from '../../shared/utils/format';
import { CustomerFormDialog } from './customer-form-dialog';
import { CUSTOMER_TYPES } from './customer-labels';
import { Customer, CustomerListItem, CustomerQuery, CustomersApi, CustomerType } from './customers.api';

@Component({
  selector: 'app-customers-list',
  imports: [
    DatePipe, ReactiveFormsModule, RouterLink, PageHeader, Pagination, SortHeader, EmptyState, Spinner, Icon,
    HasPermission, CustomerFormDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customers-list.html',
  styleUrl: './customers-list.scss',
})
export class CustomersList {
  private readonly api = inject(CustomersApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  protected readonly P = Permissions;
  protected readonly types = CUSTOMER_TYPES;
  protected readonly initials = initials;

  protected readonly query = signal<CustomerQuery>({ page: 1, pageSize: 10, sortBy: 'createdAt', sortDirection: 'desc' });
  protected readonly result = signal<PagedResult<CustomerListItem> | null>(null);
  protected readonly loading = signal(true);
  protected readonly busyId = signal<number | null>(null);
  protected readonly creating = signal(false);
  protected readonly search = new FormControl('', { nonNullable: true });

  constructor() {
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

  protected patchQuery(patch: Partial<CustomerQuery>): void {
    this.query.update((q) => ({ ...q, page: 1, ...patch }));
  }

  protected goToPage(page: number): void {
    this.query.update((q) => ({ ...q, page }));
  }

  protected sortBy(column: string): void {
    const q = this.query();
    this.patchQuery({ sortBy: column, sortDirection: q.sortBy === column && q.sortDirection === 'asc' ? 'desc' : 'asc' });
  }

  protected onTypeFilter(value: string): void {
    this.patchQuery({ type: (value || undefined) as CustomerType | undefined });
  }

  protected onStatusFilter(value: string): void {
    this.patchQuery({ isActive: value === '' ? undefined : value === 'true' });
  }

  protected isFiltered(): boolean {
    const q = this.query();
    return !!q.search || !!q.type || q.isActive !== undefined;
  }

  protected onCreated(customer: Customer): void {
    this.creating.set(false);
    void this.router.navigate(['/customers', customer.id]);
  }

  protected async remove(customer: CustomerListItem, event: Event): Promise<void> {
    event.stopPropagation();
    const ok = await this.confirm.ask({
      title: 'Delete customer?',
      message: `${customer.name} (${customer.code}) and all their contacts, interactions, notes and files will be permanently deleted.`,
      confirmText: 'Delete customer',
    });
    if (!ok) return;

    this.busyId.set(customer.id);
    this.api
      .delete(customer.id)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe(() => {
        this.toast.success(`${customer.name} was deleted.`);
        const r = this.result();
        if (r && r.items.length === 1 && r.page > 1) this.goToPage(r.page - 1);
        else this.query.update((q) => ({ ...q }));
      });
  }
}
