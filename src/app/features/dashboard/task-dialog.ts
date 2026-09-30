import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { FormField } from '../../shared/ui/form-field';
import { Icon } from '../../shared/ui/icon';
import { Modal } from '../../shared/ui/modal';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { applyServerErrors } from '../../shared/utils/form-errors';
import { AgentTask, DashboardApi } from './dashboard.api';
import { RemindersService } from './reminders.service';

/** ISO → value for <input type="datetime-local"> in the user's time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** Tomorrow 09:00 local — a sensible default for "remind me". */
function tomorrowMorning(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toLocalInput(d.toISOString());
}

/** Create or edit a private task. Pass `ticket` to create a reminder linked to that ticket. */
@Component({
  selector: 'app-task-dialog',
  imports: [Modal, FormField, ReactiveFormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="task() ? 'Edit task' : ticket() ? 'Add reminder' : 'New task'"
      [subtitle]="linkLabel()" size="sm" [busy]="saving()" (closed)="closed.emit()">
      <form id="task-form" class="form-grid" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <app-form-field class="span-2" label="Title" for="task-title" [control]="form.controls.title" [required]="true">
          <input id="task-title" class="input" formControlName="title" placeholder="e.g. Call the customer back"
            [class.is-invalid]="form.controls.title.touched && form.controls.title.invalid" />
        </app-form-field>
        <app-form-field class="span-2" label="Due" for="task-due" [control]="form.controls.dueAt" hint="Optional. Shows as a reminder when due.">
          <input id="task-due" class="input" type="datetime-local" formControlName="dueAt" />
        </app-form-field>
        <app-form-field class="span-2" label="Notes" for="task-notes" [control]="form.controls.notes">
          <textarea id="task-notes" class="textarea" rows="3" formControlName="notes"></textarea>
        </app-form-field>
      </form>
      <ng-container modal-footer>
        <button type="button" class="btn btn-secondary" [disabled]="saving()" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="task-form" class="btn btn-primary" [disabled]="saving()">
          <app-icon name="check" [size]="16" /> {{ saving() ? 'Saving…' : 'Save' }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export class TaskDialog implements OnInit {
  private readonly api = inject(DashboardApi);
  private readonly toast = inject(ToastService);
  private readonly reminders = inject(RemindersService);

  readonly task = input<AgentTask | null>(null);
  /** Link a new task to this ticket. */
  readonly ticket = input<{ id: number; code: string; subject: string } | null>(null);
  readonly saved = output<AgentTask>();
  readonly closed = output<void>();

  protected readonly saving = signal(false);
  protected readonly linkLabel = computed(() => {
    const t = this.task();
    if (t?.ticketCode) return `${t.ticketCode} · ${t.ticketSubject}`;
    const k = this.ticket();
    return k ? `${k.code} · ${k.subject}` : 'Private to you.';
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    dueAt: [''],
    notes: ['', Validators.maxLength(2000)],
  });

  ngOnInit(): void {
    const t = this.task();
    if (t) this.form.setValue({ title: t.title, dueAt: toLocalInput(t.dueAt), notes: t.notes ?? '' });
    else if (this.ticket()) this.form.patchValue({ title: `Follow up on ${this.ticket()!.code}`, dueAt: tomorrowMorning() });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const existing = this.task();
    this.saving.set(true);
    this.api
      .saveTask(existing?.id ?? null, {
        title: v.title.trim(),
        notes: v.notes.trim() || null,
        dueAt: v.dueAt ? new Date(v.dueAt).toISOString() : null,
        ticketId: existing ? existing.ticketId : (this.ticket()?.id ?? null),
        customerId: existing ? existing.customerId : null,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (saved) => {
          this.toast.success(existing ? 'Task updated.' : this.ticket() ? 'Reminder added.' : 'Task added.');
          this.reminders.refresh(true);
          this.saved.emit(saved);
        },
        error: (err) => applyServerErrors(this.form, err),
      });
  }
}
