import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Permissions } from '../../core/auth/permissions';
import { HasPermission } from '../../shared/directives/has-permission';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { Icon } from '../../shared/ui/icon';
import { Modal } from '../../shared/ui/modal';
import { EmptyState, Spinner } from '../../shared/ui/states';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { initials } from '../../shared/utils/format';
import { channelMeta, priorityMeta, statusAction, statusMeta } from './ticket-labels';
import { TaskDialog } from '../dashboard/task-dialog';
import { describe as describeSla } from '../sla/sla-badge';
import { TicketFormDialog } from './ticket-form-dialog';
import { TicketTimeline } from './ticket-timeline';
import { Assignee, Ticket, TicketHistoryEntry, TicketsApi, TicketStatus } from './tickets.api';

/** An action that needs a short note before it is sent. */
type PendingAction =
  | { kind: 'status'; status: TicketStatus; title: string; required: boolean }
  | { kind: 'escalate'; title: string; required: true }
  | { kind: 'deescalate'; title: string; required: false };

@Component({
  selector: 'app-ticket-details',
  imports: [DatePipe, RouterLink, ReactiveFormsModule, Icon, Modal, Spinner, EmptyState, HasPermission, TicketTimeline, TicketFormDialog, TaskDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-details.html',
  styleUrl: './ticket-details.scss',
})
export class TicketDetails implements OnInit {
  private readonly api = inject(TicketsApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  protected readonly P = Permissions;
  protected readonly statusMeta = statusMeta;
  protected readonly priorityMeta = priorityMeta;
  protected readonly channelMeta = channelMeta;
  protected readonly initials = initials;
  protected readonly describeSla = describeSla;

  /** Route parameter. */
  readonly id = input.required<string>();
  private readonly ticketId = computed(() => Number(this.id()));

  protected readonly ticket = signal<Ticket | null>(null);
  protected readonly history = signal<TicketHistoryEntry[]>([]);
  protected readonly assignees = signal<Assignee[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly editing = signal(false);
  protected readonly addingReminder = signal(false);
  protected readonly pending = signal<PendingAction | null>(null);
  protected readonly note = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(4000)] });

  private readonly can = (p: string) => computed(() => this.auth.hasAnyPermission(p));
  protected readonly canWork = this.can(Permissions.Tickets.Work);
  protected readonly canAssign = this.can(Permissions.Tickets.Assign);
  protected readonly canEscalate = this.can(Permissions.Tickets.Escalate);
  protected readonly canEdit = this.can(Permissions.Tickets.Edit);
  protected readonly canViewCustomers = this.can(Permissions.Customers.View);
  protected readonly canUseTasks = this.can(Permissions.Dashboard.View);
  protected readonly meId = computed(() => this.auth.user()?.id ?? null);

  protected readonly isClosed = computed(() => this.ticket()?.status === 'Closed');
  protected readonly isActive = computed(() => ['New', 'Open', 'InProgress', 'OnHold'].includes(this.ticket()?.status ?? ''));
  protected readonly statusActions = computed(() => {
    const t = this.ticket();
    return t ? t.allowedStatuses.map((s) => ({ status: s, label: statusAction(t.status, s) })) : [];
  });

  ngOnInit(): void {
    this.api.get(this.ticketId()).subscribe({
      next: (ticket) => {
        this.ticket.set(ticket);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.loadHistory();
    if (this.canAssign()) this.api.assignees().subscribe((a) => this.assignees.set(a));
  }

  private loadHistory(): void {
    this.api.history(this.ticketId()).subscribe((h) => this.history.set(h));
  }

  // ---------- Status / escalation (with a note) ----------

  protected startStatus(status: TicketStatus, label: string): void {
    this.openAction({ kind: 'status', status, title: label, required: status === 'Resolved' });
  }

  protected startEscalate(): void {
    this.openAction({ kind: 'escalate', title: 'Escalate ticket', required: true });
  }

  protected startDeEscalate(): void {
    this.openAction({ kind: 'deescalate', title: 'Remove escalation', required: false });
  }

  private openAction(action: PendingAction): void {
    this.note.reset();
    this.note.setValidators(action.required ? [Validators.required, Validators.maxLength(4000), Validators.pattern(/\S/)] : [Validators.maxLength(4000)]);
    this.note.updateValueAndValidity();
    this.pending.set(action);
  }

  protected notePlaceholder(action: PendingAction): string {
    if (action.kind === 'escalate') return 'Why does this need urgent attention?';
    if (action.kind === 'status' && action.status === 'Resolved') return 'How was the issue resolved?';
    return 'Optional note for the history';
  }

  protected submitAction(): void {
    const action = this.pending();
    if (!action) return;
    if (this.note.invalid) {
      this.note.markAsTouched();
      return;
    }
    const note = this.note.value.trim() || null;
    const id = this.ticketId();
    const request$: Observable<Ticket> =
      action.kind === 'status' ? this.api.changeStatus(id, action.status, note)
      : action.kind === 'escalate' ? this.api.escalate(id, note ?? '')
      : this.api.deEscalate(id, note);

    this.run(request$, () => {
      this.pending.set(null);
      this.toast.success(action.kind === 'status' ? `Status changed to ${statusMeta(action.status).label}.`
        : action.kind === 'escalate' ? 'Ticket escalated.' : 'Escalation removed.');
    });
  }

  // ---------- Assignment ----------

  protected assign(assigneeId: string | null): void {
    this.run(this.api.assign(this.ticketId(), assigneeId), (t) => {
      this.toast.success(t.assigneeName ? `Assigned to ${t.assigneeName}.` : 'Ticket unassigned.');
      if (this.canAssign()) this.api.assignees().subscribe((a) => this.assignees.set(a)); // refresh workload counts
    });
  }

  // ---------- Edit / delete ----------

  protected onSaved(ticket: Ticket): void {
    this.editing.set(false);
    this.ticket.set(ticket);
    this.loadHistory();
  }

  protected onCommented(entry: TicketHistoryEntry): void {
    this.history.update((list) => [...list, entry]);
  }

  protected async remove(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const ok = await this.confirm.ask({ title: 'Delete ticket?', message: `${t.code} and its history will be permanently deleted.`, confirmText: 'Delete ticket' });
    if (!ok) return;
    this.api.delete(t.id).subscribe(() => {
      this.toast.success(`${t.code} was deleted.`);
      void this.router.navigate(['/tickets']);
    });
  }

  /** Runs a workflow call, then refreshes the ticket and its history. */
  private run(request$: Observable<Ticket>, done: (t: Ticket) => void): void {
    this.busy.set(true);
    request$.pipe(finalize(() => this.busy.set(false))).subscribe((ticket) => {
      this.ticket.set(ticket);
      this.loadHistory();
      done(ticket);
    });
  }
}
