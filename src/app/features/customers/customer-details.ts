import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Permissions } from '../../core/auth/permissions';
import { HasPermission } from '../../shared/directives/has-permission';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { Icon } from '../../shared/ui/icon';
import { EmptyState, Spinner } from '../../shared/ui/states';
import { TabItem, Tabs } from '../../shared/ui/tabs';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { initials } from '../../shared/utils/format';
import { CustomerTickets } from '../tickets/customer-tickets';
import { CustomerActivity } from './customer-activity';
import { CustomerAttachments } from './customer-attachments';
import { CustomerContacts } from './customer-contacts';
import { CustomerFormDialog } from './customer-form-dialog';
import { channelLabel } from './customer-labels';
import { CustomerNotes } from './customer-notes';
import { Customer, CustomerContact, CustomersApi } from './customers.api';

@Component({
  selector: 'app-customer-details',
  imports: [
    DatePipe, RouterLink, Icon, Spinner, EmptyState, Tabs, HasPermission, CustomerFormDialog,
    CustomerActivity, CustomerNotes, CustomerAttachments, CustomerContacts, CustomerTickets,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-details.html',
  styleUrl: './customer-details.scss',
})
export class CustomerDetails implements OnInit {
  private readonly api = inject(CustomersApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  protected readonly P = Permissions;
  protected readonly initials = initials;
  protected readonly channelLabel = channelLabel;

  /** Route parameter. */
  readonly id = input.required<string>();
  protected readonly customerId = computed(() => Number(this.id()));

  protected readonly customer = signal<Customer | null>(null);
  protected readonly loading = signal(true);
  protected readonly editing = signal(false);
  protected readonly deleting = signal(false);
  protected readonly tab = signal('activity');

  protected readonly canAddActivity = computed(() => this.auth.hasAnyPermission(Permissions.Customers.AddActivity));
  protected readonly canEdit = computed(() => this.auth.hasAnyPermission(Permissions.Customers.Edit));
  protected readonly canViewTickets = computed(() => this.auth.hasAnyPermission(Permissions.Tickets.View));
  protected readonly primaryContact = computed(() => this.customer()?.contacts.find((c) => c.isPrimary) ?? null);

  protected readonly tabs = computed<TabItem[]>(() => {
    const c = this.customer();
    const tabs: TabItem[] = [
      { id: 'activity', label: 'Interactions', icon: 'activity', count: c?.stats.interactions },
      { id: 'notes', label: 'Notes', icon: 'note', count: c?.stats.notes },
      { id: 'files', label: 'Files', icon: 'paperclip', count: c?.stats.attachments },
      { id: 'contacts', label: 'Contacts', icon: 'users', count: c?.contacts.length },
    ];
    if (this.canViewTickets()) tabs.unshift({ id: 'tickets', label: 'Tickets', icon: 'ticket' });
    return tabs;
  });

  ngOnInit(): void {
    if (this.canViewTickets()) this.tab.set('tickets'); // the customer's open requests matter most
    this.reload();
  }

  /** Re-reads the profile so counters and "last interaction" stay correct after changes in a tab. */
  protected reload(): void {
    this.api.get(this.customerId()).subscribe({
      next: (customer) => {
        this.customer.set(customer);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected onSaved(customer: Customer): void {
    this.editing.set(false);
    this.customer.set(customer);
  }

  protected onContactsChanged(contacts: CustomerContact[]): void {
    this.customer.update((c) => (c ? { ...c, contacts } : c));
  }

  protected async remove(): Promise<void> {
    const c = this.customer();
    if (!c) return;
    const ok = await this.confirm.ask({
      title: 'Delete customer?',
      message: `${c.name} (${c.code}) and all their contacts, interactions, notes and files will be permanently deleted. Deactivate instead to keep the history.`,
      confirmText: 'Delete customer',
    });
    if (!ok) return;

    this.deleting.set(true);
    this.api
      .delete(c.id)
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe(() => {
        this.toast.success(`${c.name} was deleted.`);
        void this.router.navigate(['/customers']);
      });
  }
}
