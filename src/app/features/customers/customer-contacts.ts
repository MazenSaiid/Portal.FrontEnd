import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, Observable } from 'rxjs';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { FormField } from '../../shared/ui/form-field';
import { Icon } from '../../shared/ui/icon';
import { Modal } from '../../shared/ui/modal';
import { EmptyState } from '../../shared/ui/states';
import { ToggleSwitch } from '../../shared/ui/toggle-switch';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { applyServerErrors, PHONE_PATTERN } from '../../shared/utils/form-errors';
import { initials } from '../../shared/utils/format';
import { CustomerContact, CustomersApi } from './customers.api';

/** Contact persons of a customer. All changes return the full list, which is handed up to the page. */
@Component({
  selector: 'app-customer-contacts',
  imports: [ReactiveFormsModule, FormField, Icon, Modal, EmptyState, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (canEdit()) {
      <button type="button" class="btn btn-primary btn-sm add" (click)="open(null)">
        <app-icon name="plus" [size]="14" /> Add contact
      </button>
    }

    @if (contacts().length === 0) {
      <app-empty-state icon="users" title="No contact persons"
        message="Add the people you talk to at this customer, and mark the main one as primary." />
    } @else {
      <ul class="contacts">
        @for (contact of contacts(); track contact.id) {
          <li class="contact">
            <span class="avatar">{{ initials(contact.name) }}</span>
            <div class="contact-text">
              <div class="contact-head">
                <strong>{{ contact.name }}</strong>
                @if (contact.isPrimary) {
                  <span class="badge badge-primary"><app-icon name="star" [size]="12" /> Primary</span>
                }
              </div>
              @if (contact.jobTitle) {
                <span class="text-sm text-muted">{{ contact.jobTitle }}</span>
              }
              <span class="text-sm links">
                @if (contact.email) { <a [href]="'mailto:' + contact.email">{{ contact.email }}</a> }
                @if (contact.phone) { <a [href]="'tel:' + contact.phone">{{ contact.phone }}</a> }
              </span>
            </div>
            @if (canEdit()) {
              <button type="button" class="btn btn-ghost btn-icon" aria-label="Edit contact" title="Edit" (click)="open(contact)">
                <app-icon name="edit" [size]="16" />
              </button>
              <button type="button" class="btn btn-ghost btn-icon danger" aria-label="Delete contact" title="Delete" (click)="remove(contact)">
                <app-icon name="trash" [size]="16" />
              </button>
            }
          </li>
        }
      </ul>
    }

    @if (editing(); as target) {
      <app-modal [title]="target === 'new' ? 'Add contact' : 'Edit contact'" size="sm" [busy]="saving()" (closed)="editing.set(null)">
        <form id="contact-form" class="form-grid" [formGroup]="form" (ngSubmit)="save()" novalidate>
          <app-form-field class="span-2" label="Name" for="ct-name" [control]="form.controls.name" [required]="true">
            <input id="ct-name" class="input" formControlName="name" [class.is-invalid]="form.controls.name.touched && form.controls.name.invalid" />
          </app-form-field>
          <app-form-field class="span-2" label="Job title" for="ct-title" [control]="form.controls.jobTitle">
            <input id="ct-title" class="input" formControlName="jobTitle" />
          </app-form-field>
          <app-form-field class="span-2" label="Email" for="ct-email" [control]="form.controls.email" hint="Email or phone is required.">
            <input id="ct-email" class="input" type="email" formControlName="email" [class.is-invalid]="form.controls.email.touched && form.controls.email.invalid" />
          </app-form-field>
          <app-form-field class="span-2" label="Phone" for="ct-phone" [control]="form.controls.phone">
            <input id="ct-phone" class="input" type="tel" formControlName="phone" [class.is-invalid]="form.controls.phone.touched && form.controls.phone.invalid" />
          </app-form-field>
          <div class="field span-2">
            <div class="inline-control">
              <app-toggle-switch label="Primary contact" [checked]="form.controls.isPrimary.value" (toggled)="form.controls.isPrimary.setValue($event)" />
              <span class="text-sm">Primary contact</span>
            </div>
          </div>
        </form>
        <ng-container modal-footer>
          <button type="button" class="btn btn-secondary" [disabled]="saving()" (click)="editing.set(null)">Cancel</button>
          <button type="submit" form="contact-form" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save contact' }}</button>
        </ng-container>
      </app-modal>
    }
  `,
  styles: `
    .add { margin-block-end: var(--space-5); }
    .contacts { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-3); }
    .contact { display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
    .contact-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .contact-head { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
    .links { display: flex; flex-direction: column; overflow-wrap: anywhere; }
  `,
})
export class CustomerContacts {
  private readonly api = inject(CustomersApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly customerId = input.required<number>();
  readonly contacts = input.required<CustomerContact[]>();
  readonly canEdit = input(false);
  readonly changed = output<CustomerContact[]>();

  protected readonly initials = initials;
  protected readonly editing = signal<CustomerContact | 'new' | null>(null);
  protected readonly saving = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    jobTitle: ['', Validators.maxLength(100)],
    email: ['', [Validators.email, Validators.maxLength(256)]],
    phone: ['', Validators.pattern(PHONE_PATTERN)],
    isPrimary: [false],
  });

  protected open(contact: CustomerContact | null): void {
    this.form.reset({
      name: contact?.name ?? '',
      jobTitle: contact?.jobTitle ?? '',
      email: contact?.email ?? '',
      phone: contact?.phone ?? '',
      isPrimary: contact?.isPrimary ?? this.contacts().length === 0,
    });
    this.editing.set(contact ?? 'new');
  }

  protected save(): void {
    const v = this.form.getRawValue();
    if (!v.email.trim() && !v.phone.trim()) {
      this.form.controls.email.setErrors({ server: 'Enter an email or a phone number.' });
      this.form.controls.email.markAsTouched();
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = {
      name: v.name.trim(),
      jobTitle: v.jobTitle.trim() || null,
      email: v.email.trim() || null,
      phone: v.phone.trim() || null,
      isPrimary: v.isPrimary,
    };
    const target = this.editing();
    const request$: Observable<CustomerContact[]> =
      target && target !== 'new'
        ? this.api.updateContact(this.customerId(), target.id, payload)
        : this.api.addContact(this.customerId(), payload);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (contacts) => {
        this.toast.success(target === 'new' ? `${payload.name} was added.` : `${payload.name} was updated.`);
        this.editing.set(null);
        this.changed.emit(contacts);
      },
      error: (err) => applyServerErrors(this.form, err),
    });
  }

  protected async remove(contact: CustomerContact): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Remove contact?', message: `${contact.name} will be removed from this customer.`, confirmText: 'Remove' });
    if (!ok) return;
    this.api.deleteContact(this.customerId(), contact.id).subscribe((contacts) => {
      this.toast.success(`${contact.name} was removed.`);
      this.changed.emit(contacts);
    });
  }
}
