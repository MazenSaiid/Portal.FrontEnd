import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Permissions } from '../../core/auth/permissions';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { EmptyState, Spinner } from '../../shared/ui/states';
import { ToggleSwitch } from '../../shared/ui/toggle-switch';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PermissionModule, RolePermissions, RolesApi } from './roles.api';

/**
 * Permission matrix for one role. Everything on this page comes from the API, so permissions
 * added by future modules appear here automatically. Toggles apply immediately (optimistic
 * update, rolled back if the server refuses).
 */
@Component({
  selector: 'app-role-permissions',
  imports: [RouterLink, FormsModule, PageHeader, Icon, ToggleSwitch, EmptyState, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './role-permissions.html',
  styleUrl: './role-permissions.scss',
})
export class RolePermissionsPage implements OnInit {
  private readonly api = inject(RolesApi);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  /** Route parameter (bound via withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly data = signal<RolePermissions | null>(null);
  protected readonly loading = signal(true);
  protected readonly pending = signal<ReadonlySet<number>>(new Set());
  protected readonly filter = signal('');

  protected readonly canManage = computed(() => this.auth.hasAnyPermission(Permissions.Roles.ManagePermissions));
  protected readonly readOnly = computed(() => !this.canManage() || !!this.data()?.isSystem);

  protected readonly totals = computed(() => {
    const all = this.data()?.modules.flatMap((m) => m.permissions) ?? [];
    return { granted: all.filter((p) => p.isGranted).length, total: all.length };
  });

  protected readonly visibleModules = computed(() => {
    const term = this.filter().trim().toLowerCase();
    const modules = this.data()?.modules ?? [];
    if (!term) return modules;
    return modules
      .map((m) => ({
        ...m,
        permissions: m.permissions.filter(
          (p) => p.description.toLowerCase().includes(term) || p.key.toLowerCase().includes(term) || m.module.toLowerCase().includes(term),
        ),
      }))
      .filter((m) => m.permissions.length > 0);
  });

  ngOnInit(): void {
    this.api.permissions(this.id()).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected grantedCount(module: PermissionModule): number {
    return module.permissions.filter((p) => p.isGranted).length;
  }

  protected isModuleBusy(module: PermissionModule): boolean {
    const pending = this.pending();
    return module.permissions.some((p) => pending.has(p.id));
  }

  protected togglePermission(permissionId: number, isGranted: boolean): void {
    this.apply([permissionId], isGranted);
  }

  /** Module switch: turns every permission of the module on, or all off when they already are. */
  protected toggleModule(module: PermissionModule, isGranted: boolean): void {
    const ids = module.permissions.filter((p) => p.isGranted !== isGranted).map((p) => p.id);
    if (ids.length) this.apply(ids, isGranted);
  }

  private apply(ids: number[], isGranted: boolean): void {
    const previous = this.data();
    if (!previous || this.readOnly()) return;

    this.data.set(withGrants(previous, ids, isGranted));
    this.setPending(ids, true);

    this.api.setPermissions(previous.roleId, ids, isGranted).subscribe({
      next: (fresh) => {
        this.setPending(ids, false);
        // Keep other in-flight toggles' optimistic state; take the server's word for these ids.
        const current = this.data() ?? fresh;
        const serverGranted = new Set(fresh.modules.flatMap((m) => m.permissions).filter((p) => p.isGranted).map((p) => p.id));
        this.data.set({
          ...current,
          modules: current.modules.map((m) => ({
            ...m,
            permissions: m.permissions.map((p) => (ids.includes(p.id) ? { ...p, isGranted: serverGranted.has(p.id) } : p)),
          })),
        });
        this.toast.success(`${ids.length === 1 ? 'Permission' : `${ids.length} permissions`} ${isGranted ? 'granted' : 'revoked'}.`);
        if (this.auth.user()?.roleId === previous.roleId) this.auth.refreshProfile();
      },
      error: () => {
        this.setPending(ids, false);
        const current = this.data();
        if (current) this.data.set(withGrants(current, ids, !isGranted)); // roll back
      },
    });
  }

  private setPending(ids: number[], on: boolean): void {
    this.pending.update((set) => {
      const next = new Set(set);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  }
}

function withGrants(data: RolePermissions, ids: number[], isGranted: boolean): RolePermissions {
  return {
    ...data,
    modules: data.modules.map((m) => ({
      ...m,
      permissions: m.permissions.map((p) => (ids.includes(p.id) ? { ...p, isGranted } : p)),
    })),
  };
}
