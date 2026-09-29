import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { FormField } from '../../shared/ui/form-field';
import { Icon } from '../../shared/ui/icon';
import { EmptyState, Spinner } from '../../shared/ui/states';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { applyServerErrors } from '../../shared/utils/form-errors';
import { INTERACTION_TYPES, interactionMeta } from './customer-labels';
import { CustomersApi, Interaction, InteractionDirection, InteractionType } from './customers.api';

/** "2026-09-29T10:30" in the user's local time, for <input type="datetime-local">. */
function localNow(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** Interaction history (immutable, newest first) with a form to log a new one. */
@Component({
  selector: 'app-customer-activity',
  imports: [DatePipe, ReactiveFormsModule, FormField, Icon, EmptyState, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-activity.html',
  styleUrl: './customer-activity.scss',
})
export class CustomerActivity implements OnInit {
  private readonly api = inject(CustomersApi);
  private readonly toast = inject(ToastService);

  readonly customerId = input.required<number>();
  readonly canAdd = input(false);
  readonly changed = output<void>();

  protected readonly types = INTERACTION_TYPES;
  protected readonly meta = interactionMeta;
  protected readonly items = signal<Interaction[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly composing = signal(false);
  protected readonly saving = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    type: ['Call' as InteractionType],
    direction: ['Inbound' as InteractionDirection],
    subject: ['', [Validators.required, Validators.maxLength(200)]],
    summary: ['', Validators.maxLength(4000)],
    occurredAt: [localNow(), Validators.required],
  });

  ngOnInit(): void {
    this.load(1);
  }

  protected load(page: number): void {
    this.loading.set(true);
    this.api
      .interactions(this.customerId(), page)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => {
        this.items.update((list) => (page === 1 ? result.items : [...list, ...result.items]));
        this.total.set(result.totalCount);
        this.page.set(page);
      });
  }

  protected startComposing(): void {
    this.form.reset({ type: 'Call', direction: 'Inbound', subject: '', summary: '', occurredAt: localNow() });
    this.composing.set(true);
  }

  protected setDirection(direction: InteractionDirection): void {
    this.form.controls.direction.setValue(direction);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .logInteraction(this.customerId(), {
        type: v.type,
        direction: v.direction,
        subject: v.subject.trim(),
        summary: v.summary.trim() || null,
        occurredAt: new Date(v.occurredAt).toISOString(),
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.toast.success('Interaction logged.');
          this.composing.set(false);
          this.load(1);
          this.changed.emit();
        },
        error: (err) => applyServerErrors(this.form, err),
      });
  }
}
