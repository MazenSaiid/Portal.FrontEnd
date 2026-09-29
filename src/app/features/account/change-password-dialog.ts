import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { FormField } from '../../shared/ui/form-field';
import { Modal } from '../../shared/ui/modal';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { applyServerErrors, passwordValidators } from '../../shared/utils/form-errors';

@Component({
  selector: 'app-change-password-dialog',
  imports: [Modal, FormField, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal title="Change password" size="sm" [busy]="saving()" (closed)="closed.emit()">
      <form id="change-password-form" class="form-grid" [formGroup]="form" (ngSubmit)="save()">
        <app-form-field class="span-2" label="Current password" for="cp-current" [control]="form.controls.currentPassword" [required]="true">
          <input id="cp-current" class="input" type="password" autocomplete="current-password" formControlName="currentPassword" />
        </app-form-field>
        <app-form-field class="span-2" label="New password" for="cp-new" [control]="form.controls.newPassword" [required]="true"
          hint="At least 8 characters with upper & lower case, a digit and a symbol.">
          <input id="cp-new" class="input" type="password" autocomplete="new-password" formControlName="newPassword" />
        </app-form-field>
      </form>
      <ng-container modal-footer>
        <button type="button" class="btn btn-secondary" [disabled]="saving()" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="change-password-form" class="btn btn-primary" [disabled]="saving()">
          {{ saving() ? 'Saving…' : 'Update password' }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export class ChangePasswordDialog {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  readonly closed = output<void>();

  protected readonly saving = signal(false);
  protected readonly form = inject(NonNullableFormBuilder).group({
    currentPassword: ['', Validators.required],
    newPassword: ['', passwordValidators],
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.auth
      .changePassword(this.form.getRawValue())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.toast.success('Your password has been updated.');
          this.closed.emit();
        },
        error: (err) => applyServerErrors(this.form, err),
      });
  }
}
