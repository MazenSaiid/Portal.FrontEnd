import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Permissions } from '../../core/auth/permissions';
import { HasPermission } from '../../shared/directives/has-permission';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { EmptyState, Spinner } from '../../shared/ui/states';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { RoleFormDialog } from './role-form-dialog';
import { Role, RolesApi } from './roles.api';

@Component({
  selector: 'app-roles-list',
  imports: [ReactiveFormsModule, RouterLink, PageHeader, EmptyState, Spinner, Icon, HasPermission, RoleFormDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './roles-list.html',
  styleUrl: './roles-list.scss',
})
export class RolesList {
  private readonly api = inject(RolesApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  protected readonly P = Permissions;

  protected readonly roles = signal<Role[]>([]);
  protected readonly loading = signal(true);
  protected readonly busyId = signal<string | null>(null);
  protected readonly editing = signal<Role | 'new' | null>(null);
  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly isFiltered = computed(() => this.searchTerm().length > 0);
  private readonly searchTerm = signal('');

  constructor() {
    this.load();
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => {
        this.searchTerm.set(term.trim());
        this.load();
      });
  }

  protected load(): void {
    this.loading.set(true);
    this.api
      .list(this.searchTerm() || undefined)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((roles) => this.roles.set(roles));
  }

  protected onSaved(role: Role, created: boolean): void {
    this.editing.set(null);
    // A new role starts with no permissions, so take the admin straight to them.
    if (created && this.auth.hasAnyPermission(Permissions.Roles.ManagePermissions)) {
      void this.router.navigate(['/roles', role.id, 'permissions']);
    } else {
      this.load();
    }
  }

  protected async remove(role: Role): Promise<void> {
    if (role.userCount > 0) {
      this.toast.info(`Reassign the ${role.userCount} user(s) in "${role.name}" before deleting it.`);
      return;
    }
    const ok = await this.confirm.ask({
      title: 'Delete role?',
      message: `The role "${role.name}" and its permission set will be permanently deleted.`,
      confirmText: 'Delete role',
    });
    if (!ok) return;

    this.busyId.set(role.id);
    this.api
      .delete(role.id)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe(() => {
        this.toast.success(`Role "${role.name}" was deleted.`);
        this.load();
      });
  }
}
