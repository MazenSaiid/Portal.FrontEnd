import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { FormField } from '../../shared/ui/form-field';
import { Icon } from '../../shared/ui/icon';
import { Modal } from '../../shared/ui/modal';
import { PageHeader } from '../../shared/ui/page-header';
import { EmptyState, Spinner } from '../../shared/ui/states';
import { ToggleSwitch } from '../../shared/ui/toggle-switch';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { applyServerErrors } from '../../shared/utils/form-errors';
import { TicketCategory, TicketsApi } from './tickets.api';

@Component({
  selector: 'app-ticket-categories',
  imports: [RouterLink, ReactiveFormsModule, PageHeader, FormField, Icon, Modal, EmptyState, Spinner, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Ticket categories" description="Group tickets by topic. Categories in use can be deactivated but not deleted.">
        <a header-back routerLink="/tickets" class="back"><app-icon name="arrow-left" [size]="14" /> Tickets</a>
        <button type="button" class="btn btn-primary" (click)="open(null)"><app-icon name="plus" [size]="16" /> Add category</button>
      </app-page-header>

      <section class="card">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr><th>Category</th><th>Tickets</th><th>Active</th><th class="actions"><span class="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              @for (c of categories(); track c.id) {
                <tr>
                  <td>
                    <div class="name">{{ c.name }}</div>
                    <div class="text-sm text-muted">{{ c.description || 'No description' }}</div>
                  </td>
                  <td><span class="badge">{{ c.ticketCount }}</span></td>
                  <td>
                    <app-toggle-switch [label]="'Active: ' + c.name" [checked]="c.isActive" [busy]="busyId() === c.id" (toggled)="setActive(c, $event)" />
                  </td>
                  <td class="actions">
                    <button type="button" class="btn btn-ghost btn-icon" aria-label="Edit category" title="Edit" (click)="open(c)">
                      <app-icon name="edit" [size]="16" />
                    </button>
                    <button type="button" class="btn btn-ghost btn-icon danger" aria-label="Delete category"
                      [title]="c.ticketCount ? 'In use — deactivate instead' : 'Delete'" [disabled]="c.ticketCount > 0" (click)="remove(c)">
                      <app-icon name="trash" [size]="16" />
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (loading()) {
            <div class="loading"><app-spinner /></div>
          } @else if (categories().length === 0) {
            <app-empty-state icon="tag" title="No categories yet" />
          }
        </div>
      </section>
    </div>

    @if (editing(); as target) {
      <app-modal [title]="target === 'new' ? 'Add category' : 'Edit category'" size="sm" [busy]="saving()" (closed)="editing.set(null)">
        <form id="category-form" class="form-grid" [formGroup]="form" (ngSubmit)="save()" novalidate>
          <app-form-field class="span-2" label="Name" for="cat-name" [control]="form.controls.name" [required]="true">
            <input id="cat-name" class="input" formControlName="name" [class.is-invalid]="form.controls.name.touched && form.controls.name.invalid" />
          </app-form-field>
          <app-form-field class="span-2" label="Description" for="cat-desc" [control]="form.controls.description">
            <input id="cat-desc" class="input" formControlName="description" />
          </app-form-field>
        </form>
        <ng-container modal-footer>
          <button type="button" class="btn btn-secondary" [disabled]="saving()" (click)="editing.set(null)">Cancel</button>
          <button type="submit" form="category-form" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save' }}</button>
        </ng-container>
      </app-modal>
    }
  `,
  styles: `
    .back { display: inline-flex; align-items: center; gap: var(--space-1); font-size: var(--fs-sm); font-weight: var(--fw-medium); }
    .name { font-weight: var(--fw-medium); }
    .loading { display: grid; place-items: center; padding: var(--space-8); }
  `,
})
export class TicketCategories implements OnInit {
  private readonly api = inject(TicketsApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly categories = signal<TicketCategory[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly busyId = signal<number | null>(null);
  protected readonly editing = signal<TicketCategory | 'new' | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    description: ['', Validators.maxLength(300)],
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.categories().pipe(finalize(() => this.loading.set(false))).subscribe((c) => this.categories.set(c));
  }

  protected open(category: TicketCategory | null): void {
    this.form.reset({ name: category?.name ?? '', description: category?.description ?? '' });
    this.editing.set(category ?? 'new');
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const target = this.editing();
    const existing = target && target !== 'new' ? target : null;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .saveCategory(existing?.id ?? null, { name: v.name.trim(), description: v.description.trim() || null, isActive: existing?.isActive ?? true })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (saved) => {
          this.toast.success(`Category "${saved.name}" saved.`);
          this.editing.set(null);
          this.load();
        },
        error: (err) => applyServerErrors(this.form, err),
      });
  }

  protected setActive(category: TicketCategory, isActive: boolean): void {
    this.busyId.set(category.id);
    this.api
      .saveCategory(category.id, { name: category.name, description: category.description, isActive })
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe((saved) => {
        this.categories.update((list) => list.map((c) => (c.id === saved.id ? saved : c)));
        this.toast.success(`"${saved.name}" is now ${isActive ? 'active' : 'inactive'}.`);
      });
  }

  protected async remove(category: TicketCategory): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Delete category?', message: `"${category.name}" will be permanently deleted.`, confirmText: 'Delete' });
    if (!ok) return;
    this.api.deleteCategory(category.id).subscribe(() => {
      this.toast.success(`"${category.name}" was deleted.`);
      this.load();
    });
  }
}
