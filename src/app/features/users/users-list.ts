import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, finalize, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
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
import { RoleLookup, RolesApi } from '../roles/roles.api';
import { ResetPasswordDialog } from './reset-password-dialog';
import { UserFormDialog } from './user-form-dialog';
import { User, UserQuery, UsersApi } from './users.api';

@Component({
  selector: 'app-users-list',
  imports: [
    DatePipe, ReactiveFormsModule, PageHeader, Pagination, SortHeader, EmptyState, Spinner, Icon, HasPermission,
    UserFormDialog, ResetPasswordDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users-list.html',
  styleUrl: './users-list.scss',
})
export class UsersList {
  private readonly api = inject(UsersApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly auth = inject(AuthService);
  protected readonly P = Permissions;
  protected readonly initials = initials;

  protected readonly query = signal<UserQuery>({ page: 1, pageSize: 10, sortBy: 'createdAt', sortDirection: 'desc' });
  protected readonly result = signal<PagedResult<User> | null>(null);
  protected readonly loading = signal(true);
  protected readonly roles = signal<RoleLookup[]>([]);
  protected readonly busyId = signal<string | null>(null);

  /** null = closed, 'new' = create, User = edit. */
  protected readonly editing = signal<User | 'new' | null>(null);
  protected readonly resetting = signal<User | null>(null);

  protected readonly search = new FormControl('', { nonNullable: true });

  constructor() {
    inject(RolesApi).lookup().subscribe((roles) => this.roles.set(roles));

    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((search) => this.patchQuery({ search: search.trim() || undefined }));

    // Every query change reloads; switchMap cancels a slower previous request.
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

  protected patchQuery(patch: Partial<UserQuery>): void {
    // Any filter change goes back to page 1; paging itself passes an explicit page.
    this.query.update((q) => ({ ...q, page: 1, ...patch }));
  }

  protected goToPage(page: number): void {
    this.query.update((q) => ({ ...q, page }));
  }

  protected sortBy(column: string): void {
    const q = this.query();
    const sortDirection = q.sortBy === column && q.sortDirection === 'asc' ? 'desc' : 'asc';
    this.patchQuery({ sortBy: column, sortDirection });
  }

  protected onRoleFilter(value: string): void {
    this.patchQuery({ roleId: value || undefined });
  }

  protected onStatusFilter(value: string): void {
    this.patchQuery({ isActive: value === '' ? undefined : value === 'true' });
  }

  protected reload(): void {
    this.query.update((q) => ({ ...q }));
  }

  protected isSelf(user: User): boolean {
    return user.id === this.auth.user()?.id;
  }

  protected onSaved(): void {
    this.editing.set(null);
    this.reload();
  }

  protected async toggleStatus(user: User): Promise<void> {
    const activate = !user.isActive;
    if (!activate) {
      const ok = await this.confirm.ask({
        title: 'Deactivate user?',
        message: `${user.fullName} will be signed out of every action and won't be able to sign in until reactivated.`,
        confirmText: 'Deactivate',
      });
      if (!ok) return;
    }

    this.busyId.set(user.id);
    this.api
      .setStatus(user.id, activate)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe(() => {
        this.toast.success(`${user.fullName} is now ${activate ? 'active' : 'inactive'}.`);
        this.reload();
      });
  }

  protected async remove(user: User): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Delete user?',
      message: `This permanently deletes ${user.fullName} (${user.email}). Consider deactivating instead if you may need the account again.`,
      confirmText: 'Delete user',
    });
    if (!ok) return;

    this.busyId.set(user.id);
    this.api
      .delete(user.id)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe(() => {
        this.toast.success(`${user.fullName} was deleted.`);
        // Step back a page if we just removed the last row of the current page.
        const r = this.result();
        if (r && r.items.length === 1 && r.page > 1) this.goToPage(r.page - 1);
        else this.reload();
      });
  }
}
