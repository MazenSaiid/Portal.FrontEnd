import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { NAVIGATION } from '../../layout/navigation';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';

@Component({
  selector: 'app-home',
  imports: [PageHeader, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header
        [title]="'Welcome, ' + (auth.user()?.firstName ?? '')"
        description="Here is what you can work on today."
      />

      <div class="summary card card-body">
        <div>
          <span class="text-muted text-sm">Your role</span>
          <strong>{{ auth.user()?.roleName ?? 'No role assigned' }}</strong>
        </div>
        <div>
          <span class="text-muted text-sm">Permissions</span>
          <strong>{{ auth.user()?.permissions?.length ?? 0 }}</strong>
        </div>
      </div>

      @if (shortcuts().length) {
        <div class="shortcuts">
          @for (item of shortcuts(); track item.path) {
            <a class="card shortcut" [routerLink]="item.path">
              <span class="icon"><app-icon [name]="item.icon" [size]="20" /></span>
              <strong>{{ item.label }}</strong>
              <app-icon name="chevron-right" [size]="16" />
            </a>
          }
        </div>
      } @else {
        <div class="alert">
          <app-icon name="info" [size]="16" />
          <span>Your role has no module permissions yet. Ask an administrator to grant access.</span>
        </div>
      }
    </div>
  `,
  styles: `
    .summary { display: flex; flex-wrap: wrap; gap: var(--space-10); }
    .summary div { display: flex; flex-direction: column; gap: var(--space-1); }
    .summary strong { font-size: var(--fs-lg); }
    .shortcuts { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--space-4); }
    .shortcut {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5);
      color: var(--color-text);
      transition: border-color var(--transition), box-shadow var(--transition);
      strong { flex: 1; }
      &:hover { text-decoration: none; border-color: var(--color-primary); box-shadow: var(--shadow-md); }
    }
    .icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }
  `,
})
export class Home {
  protected readonly auth = inject(AuthService);
  protected readonly shortcuts = computed(() =>
    NAVIGATION.flatMap((s) => s.items).filter(
      (item) => item.path !== '/' && this.auth.hasAnyPermission(...item.permissions),
    ),
  );
}
