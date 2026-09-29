import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, finalize, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Permissions } from '../../core/auth/permissions';
import { FormField } from '../../shared/ui/form-field';
import { Icon } from '../../shared/ui/icon';
import { Modal } from '../../shared/ui/modal';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { applyServerErrors } from '../../shared/utils/form-errors';
import { CHANNELS, PRIORITIES } from './ticket-labels';
import { Assignee, CustomerLookup, Ticket, TicketCategory, TicketChannel, TicketPriority, TicketsApi } from './tickets.api';

/**
 * New ticket (with a customer picker) or edit ticket details.
 * Pass `customer` to open a ticket for a known customer (e.g. from the customer page).
 */
@Component({
  selector: 'app-ticket-form-dialog',
  imports: [Modal, FormField, ReactiveFormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-form-dialog.html',
  styleUrl: './ticket-form-dialog.scss',
})
export class TicketFormDialog implements OnInit {
  private readonly api = inject(TicketsApi);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly ticket = input<Ticket | null>(null);
  readonly customer = input<CustomerLookup | null>(null);
  readonly saved = output<Ticket>();
  readonly closed = output<void>();

  protected readonly priorities = PRIORITIES;
  protected readonly channels = CHANNELS;
  protected readonly isEdit = computed(() => this.ticket() !== null);
  protected readonly canAssignAny = computed(() => this.auth.hasAnyPermission(Permissions.Tickets.Assign));
  protected readonly canTakeSelf = computed(() => this.auth.hasAnyPermission(Permissions.Tickets.Work));
  protected readonly me = computed(() => this.auth.user());

  protected readonly saving = signal(false);
  protected readonly categories = signal<TicketCategory[]>([]);
  protected readonly assignees = signal<Assignee[]>([]);
  protected readonly selectedCustomer = signal<CustomerLookup | null>(null);
  protected readonly customerResults = signal<CustomerLookup[]>([]);
  protected readonly searchingCustomers = signal(false);
  protected readonly customerSearch = new FormControl('', { nonNullable: true });

  protected readonly form = inject(NonNullableFormBuilder).group({
    customerId: [0, Validators.min(1)],
    subject: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.maxLength(8000)]],
    categoryId: [0, Validators.min(1)],
    priority: ['Medium' as TicketPriority],
    channel: ['Email' as TicketChannel],
    assigneeId: [''],
  });

  constructor() {
    this.customerSearch.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => {
          if (term.trim().length < 2) return of([]);
          this.searchingCustomers.set(true);
          return this.api.lookupCustomers(term.trim()).pipe(
            catchError(() => of([])),
            finalize(() => this.searchingCustomers.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((results) => this.customerResults.set(results));
  }

  ngOnInit(): void {
    const ticket = this.ticket();
    // Creating: only active categories. Editing: all, so an inactive category already on the ticket stays visible.
    this.api.categories(!ticket).subscribe((categories) => {
      this.categories.set(categories.filter((c) => c.isActive || c.id === ticket?.categoryId));
      if (!ticket && !this.form.controls.categoryId.value) {
        const general = categories.find((c) => c.name === 'General') ?? categories[0];
        if (general) this.form.controls.categoryId.setValue(general.id);
      }
    });
    if (!ticket && this.canAssignAny()) this.api.assignees().subscribe((a) => this.assignees.set(a));

    if (ticket) {
      this.form.patchValue({
        customerId: ticket.customer.id,
        subject: ticket.subject,
        description: ticket.description,
        categoryId: ticket.categoryId,
        priority: ticket.priority,
        channel: ticket.channel,
      });
    } else if (this.customer()) {
      this.pickCustomer(this.customer()!);
    }
  }

  protected pickCustomer(customer: CustomerLookup): void {
    this.selectedCustomer.set(customer);
    this.form.controls.customerId.setValue(customer.id);
    this.customerResults.set([]);
    this.customerSearch.setValue('', { emitEvent: false });
  }

  protected clearCustomer(): void {
    this.selectedCustomer.set(null);
    this.form.controls.customerId.setValue(0);
  }

  protected setPriority(priority: TicketPriority): void {
    this.form.controls.priority.setValue(priority);
    this.form.markAsDirty();
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.customerSearch.markAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const details = {
      subject: v.subject.trim(),
      description: v.description.trim(),
      categoryId: Number(v.categoryId),
      priority: v.priority,
      channel: v.channel,
    };
    const existing = this.ticket();
    const request$ = existing
      ? this.api.update(existing.id, details)
      : this.api.create({ ...details, customerId: v.customerId, assigneeId: v.assigneeId || null });

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (saved) => {
        this.toast.success(existing ? `${saved.code} was updated.` : `${saved.code} was created.`);
        this.saved.emit(saved);
      },
      error: (err) => applyServerErrors(this.form, err),
    });
  }
}
