import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { FormField } from '../../shared/ui/form-field';
import { Icon } from '../../shared/ui/icon';
import { Modal } from '../../shared/ui/modal';
import { ToggleSwitch } from '../../shared/ui/toggle-switch';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { applyServerErrors, PHONE_PATTERN } from '../../shared/utils/form-errors';
import { CONTACT_CHANNELS, CUSTOMER_TYPES, LANGUAGES } from './customer-labels';
import { ContactChannel, Customer, CustomerPayload, CustomersApi, CustomerType, PreferredLanguage } from './customers.api';

/** CR1 + CR2 mirrored on the client: reachable, and the preferred channel matches the details given. */
function reachability(group: AbstractControl): ValidationErrors | null {
  const { email, phone, preferredChannel } = group.getRawValue() as { email: string; phone: string; preferredChannel: ContactChannel };
  const hasEmail = !!email?.trim();
  const hasPhone = !!phone?.trim();
  const errors: ValidationErrors = {};
  if (!hasEmail && !hasPhone) errors['unreachable'] = true;
  if (preferredChannel === 'Email' ? !hasEmail : !hasPhone) errors['channelMismatch'] = true;
  return Object.keys(errors).length ? errors : null;
}

@Component({
  selector: 'app-customer-form-dialog',
  imports: [Modal, FormField, ReactiveFormsModule, ToggleSwitch, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-form-dialog.html',
})
export class CustomerFormDialog implements OnInit {
  private readonly api = inject(CustomersApi);
  private readonly toast = inject(ToastService);

  /** null creates a new customer. */
  readonly customer = input<Customer | null>(null);
  readonly saved = output<Customer>();
  readonly closed = output<void>();

  protected readonly types = CUSTOMER_TYPES;
  protected readonly channels = CONTACT_CHANNELS;
  protected readonly languages = LANGUAGES;
  protected readonly saving = signal(false);
  protected readonly isEdit = computed(() => this.customer() !== null);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      type: ['Company' as CustomerType],
      name: ['', [Validators.required, Validators.maxLength(200)]],
      email: ['', [Validators.email, Validators.maxLength(256)]],
      phone: ['', Validators.pattern(PHONE_PATTERN)],
      preferredChannel: ['Email' as ContactChannel],
      preferredLanguage: ['English' as PreferredLanguage],
      addressLine: ['', Validators.maxLength(300)],
      city: ['', Validators.maxLength(100)],
      country: ['', Validators.maxLength(100)],
      isActive: [true],
    },
    { validators: reachability },
  );

  private readonly formStatus = toSignal(this.form.events);
  protected readonly groupError = computed(() => {
    this.formStatus();
    if (!this.form.touched && !this.form.dirty) return null;
    if (this.form.hasError('unreachable')) return 'Enter an email or a phone number so the team can reach this customer.';
    if (this.form.hasError('channelMismatch')) {
      return this.form.controls.preferredChannel.value === 'Email'
        ? 'Email is the preferred channel, so an email is required.'
        : 'This preferred channel needs a phone number.';
    }
    return null;
  });

  ngOnInit(): void {
    const c = this.customer();
    if (!c) return;
    this.form.patchValue({
      type: c.type,
      name: c.name,
      email: c.email ?? '',
      phone: c.phone ?? '',
      preferredChannel: c.preferredChannel,
      preferredLanguage: c.preferredLanguage,
      addressLine: c.addressLine ?? '',
      city: c.city ?? '',
      country: c.country ?? '',
      isActive: c.isActive,
    });
  }

  protected setType(type: CustomerType): void {
    this.form.controls.type.setValue(type);
    this.form.markAsDirty();
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
    const blank = (s: string) => s.trim() || null;
    const payload: CustomerPayload = {
      ...v,
      name: v.name.trim(),
      email: blank(v.email),
      phone: blank(v.phone),
      addressLine: blank(v.addressLine),
      city: blank(v.city),
      country: blank(v.country),
    };
    const existing = this.customer();

    this.saving.set(true);
    (existing ? this.api.update(existing.id, payload) : this.api.create(payload))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (saved) => {
          this.toast.success(existing ? `${saved.name} was updated.` : `${saved.name} was added as ${saved.code}.`);
          this.saved.emit(saved);
        },
        error: (err) => applyServerErrors(this.form, err),
      });
  }
}
