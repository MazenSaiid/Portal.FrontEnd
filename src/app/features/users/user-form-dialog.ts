import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { FormField } from '../../shared/ui/form-field';
import { Modal } from '../../shared/ui/modal';
import { ToggleSwitch } from '../../shared/ui/toggle-switch';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { applyServerErrors, passwordValidators, PHONE_PATTERN } from '../../shared/utils/form-errors';
import { RoleLookup } from '../roles/roles.api';
import { User, UsersApi } from './users.api';

@Component({
  selector: 'app-user-form-dialog',
  imports: [Modal, FormField, ReactiveFormsModule, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-form-dialog.html',
})
export class UserFormDialog implements OnInit {
  private readonly api = inject(UsersApi);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  /** null creates a new user. */
  readonly user = input<User | null>(null);
  readonly roles = input.required<RoleLookup[]>();
  readonly saved = output<User>();
  readonly closed = output<void>();

  protected readonly saving = signal(false);
  protected readonly isEdit = computed(() => this.user() !== null);
  protected readonly isSelf = computed(() => this.user()?.id === this.auth.user()?.id);

  protected readonly form = inject(NonNullableFormBuilder).group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
    phoneNumber: ['', Validators.pattern(PHONE_PATTERN)],
    roleId: ['', Validators.required],
    isActive: [true],
    password: ['', passwordValidators],
  });

  ngOnInit(): void {
    const user = this.user();
    if (!user) return;

    this.form.controls.password.disable(); // passwords are changed via "Reset password"
    this.form.patchValue({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber ?? '',
      roleId: user.roleId ?? '',
      isActive: user.isActive,
    });
    // R3: you cannot change your own role or deactivate yourself.
    if (this.isSelf()) {
      this.form.controls.roleId.disable();
      this.form.controls.isActive.disable();
    }
  }

  protected setActive(value: boolean): void {
    this.form.controls.isActive.setValue(value);
    this.form.markAsDirty();
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const payload = {
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      email: v.email.trim(),
      phoneNumber: v.phoneNumber.trim() || null,
      roleId: v.roleId,
      isActive: v.isActive,
    };
    const user = this.user();
    const request$: Observable<User> = user
      ? this.api.update(user.id, payload)
      : this.api.create({ ...payload, password: v.password });

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (saved) => {
        this.toast.success(user ? `${saved.fullName} was updated.` : `${saved.fullName} was added.`);
        if (this.isSelf()) this.auth.refreshProfile();
        this.saved.emit(saved);
      },
      error: (err) => applyServerErrors(this.form, err),
    });
  }
}
