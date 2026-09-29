import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { FormField } from '../../shared/ui/form-field';
import { Modal } from '../../shared/ui/modal';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { applyServerErrors, passwordValidators } from '../../shared/utils/form-errors';
import { User, UsersApi } from './users.api';

@Component({
  selector: 'app-reset-password-dialog',
  imports: [Modal, FormField, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal title="Reset password" [subtitle]="user().fullName + ' · ' + user().email" size="sm" [busy]="saving()"
      (closed)="closed.emit()">
      <form id="reset-password-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <app-form-field label="New password" for="rp-new" [control]="form.controls.newPassword" [required]="true"
          hint="Share it securely. This also unlocks the account if it was locked.">
          <input id="rp-new" class="input" type="password" autocomplete="new-password" formControlName="newPassword"
            [class.is-invalid]="form.controls.newPassword.touched && form.controls.newPassword.invalid" />
        </app-form-field>
      </form>
      <ng-container modal-footer>
        <button type="button" class="btn btn-secondary" [disabled]="saving()" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="reset-password-form" class="btn btn-primary" [disabled]="saving()">
          {{ saving() ? 'Saving…' : 'Reset password' }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export class ResetPasswordDialog {
  private readonly api = inject(UsersApi);
  private readonly toast = inject(ToastService);

  readonly user = input.required<User>();
  readonly closed = output<void>();

  protected readonly saving = signal(false);
  protected readonly form = inject(NonNullableFormBuilder).group({ newPassword: ['', passwordValidators] });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.api
      .resetPassword(this.user().id, this.form.getRawValue().newPassword)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.toast.success(`Password for ${this.user().fullName} was reset.`);
          this.closed.emit();
        },
        error: (err) => applyServerErrors(this.form, err),
      });
  }
}
