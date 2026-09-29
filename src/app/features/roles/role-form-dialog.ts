import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { FormField } from '../../shared/ui/form-field';
import { Modal } from '../../shared/ui/modal';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { applyServerErrors } from '../../shared/utils/form-errors';
import { Role, RolesApi } from './roles.api';

const ROLE_NAME_PATTERN = /^[\p{L}\p{N} _-]+$/u;

@Component({
  selector: 'app-role-form-dialog',
  imports: [Modal, FormField, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="role() ? 'Edit role' : 'Add role'"
      [subtitle]="role() ? undefined : 'You will choose its permissions next.'" size="sm" [busy]="saving()"
      (closed)="closed.emit()">
      <form id="role-form" class="form-grid" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <app-form-field class="span-2" label="Name" for="rf-name" [control]="form.controls.name" [required]="true"
          [hint]="role()?.isSystem ? 'System roles cannot be renamed.' : 'e.g. Support Agent, Supervisor'">
          <input id="rf-name" class="input" formControlName="name" autocomplete="off"
            [class.is-invalid]="form.controls.name.touched && form.controls.name.invalid" />
        </app-form-field>
        <app-form-field class="span-2" label="Description" for="rf-description" [control]="form.controls.description"
          hint="What is this role for?">
          <textarea id="rf-description" class="textarea" formControlName="description" rows="3"></textarea>
        </app-form-field>
      </form>
      <ng-container modal-footer>
        <button type="button" class="btn btn-secondary" [disabled]="saving()" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="role-form" class="btn btn-primary" [disabled]="saving()">
          {{ saving() ? 'Saving…' : isEdit() ? 'Save changes' : 'Create role' }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export class RoleFormDialog implements OnInit {
  private readonly api = inject(RolesApi);
  private readonly toast = inject(ToastService);

  readonly role = input<Role | null>(null);
  readonly saved = output<Role>();
  readonly closed = output<void>();

  protected readonly saving = signal(false);
  protected readonly isEdit = computed(() => this.role() !== null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(64), Validators.pattern(ROLE_NAME_PATTERN)]],
    description: ['', Validators.maxLength(500)],
  });

  ngOnInit(): void {
    const role = this.role();
    if (!role) return;
    this.form.patchValue({ name: role.name, description: role.description ?? '' });
    if (role.isSystem) this.form.controls.name.disable();
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payload = { name: v.name.trim(), description: v.description.trim() || null };
    const role = this.role();

    this.saving.set(true);
    (role ? this.api.update(role.id, payload) : this.api.create(payload))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (saved) => {
          this.toast.success(role ? `Role "${saved.name}" was updated.` : `Role "${saved.name}" was created.`);
          this.saved.emit(saved);
        },
        error: (err) => applyServerErrors(this.form, err),
      });
  }
}
