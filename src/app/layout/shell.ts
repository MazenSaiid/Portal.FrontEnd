import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { ChangePasswordDialog } from '../features/account/change-password-dialog';
import { RemindersService } from '../features/dashboard/reminders.service';
import { NotificationsBell } from '../features/notifications/notifications-bell';
import { Icon } from '../shared/ui/icon';
import { initials } from '../shared/utils/format';
import { NAVIGATION } from './navigation';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, ChangePasswordDialog, NotificationsBell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  host: { '(document:click)': 'menuOpen.set(false)', '(document:keydown.escape)': 'menuOpen.set(false)' },
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly reminders = inject(RemindersService);

  protected readonly sidebarOpen = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly changingPassword = signal(false);

  protected readonly userInitials = computed(() => initials(this.auth.user()?.fullName));
  protected readonly navigation = computed(() =>
    NAVIGATION.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => this.auth.hasAnyPermission(...item.permissions) && !(item.hiddenWith && this.auth.hasAnyPermission(...item.hiddenWith)),
      ),
    })).filter((section) => section.items.length > 0),
  );

  constructor() {
    // Close the mobile drawer after navigating.
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => {
        this.sidebarOpen.set(false);
        this.reminders.refresh();
      });
  }

  protected toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.update((open) => !open);
  }
}
