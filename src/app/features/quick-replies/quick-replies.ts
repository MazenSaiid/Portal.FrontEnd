import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Permissions } from '../../core/auth/permissions';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { FormField } from '../../shared/ui/form-field';
import { Icon } from '../../shared/ui/icon';
import { Modal } from '../../shared/ui/modal';
import { PageHeader } from '../../shared/ui/page-header';
import { EmptyState, Spinner } from '../../shared/ui/states';
import { ToggleSwitch } from '../../shared/ui/toggle-switch';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { applyServerErrors } from '../../shared/utils/form-errors';
import { DashboardApi, QuickReply } from '../dashboard/dashboard.api';

@Component({
  selector: 'app-quick-replies',
  imports: [ReactiveFormsModule, PageHeader, FormField, Icon, Modal, EmptyState, Spinner, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Quick replies" description="Reusable answers for ticket comments. Placeholders are filled in when you insert them.">
        <button type="button" class="btn btn-primary" (click)="open(null)"><app-icon name="plus" [size]="16" /> Add reply</button>
      </app-page-header>

      <div class="alert">
        <app-icon name="info" [size]="16" />
        <span>Use <code>{{ '{' }}customer{{ '}' }}</code>, <code>{{ '{' }}agent{{ '}' }}</code> and <code>{{ '{' }}ticket{{ '}' }}</code>
          — they become the customer's name, your name and the ticket code.</span>
      </div>

      @if (loading()) {
        <div class="card loading"><app-spinner /></div>
      } @else if (replies().length === 0) {
        <div class="card"><app-empty-state icon="message" title="No quick replies yet" /></div>
      } @else {
        <div class="grid">
          @for (r of replies(); track r.id) {
            <article class="card reply">
              <header>
                <strong>{{ r.title }}</strong>
                <span [class]="r.isShared ? 'badge badge-primary' : 'badge'">{{ r.isShared ? 'Team' : 'Personal' }}</span>
              </header>
              <p class="body">{{ r.body }}</p>
              @if (r.canEdit) {
                <footer>
                  <button type="button" class="btn btn-ghost btn-sm" (click)="open(r)"><app-icon name="edit" [size]="14" /> Edit</button>
                  <button type="button" class="btn btn-ghost btn-sm danger-text" (click)="remove(r)"><app-icon name="trash" [size]="14" /> Delete</button>
                </footer>
              }
            </article>
          }
        </div>
      }
    </div>

    @if (editing(); as target) {
      <app-modal [title]="target === 'new' ? 'Add quick reply' : 'Edit quick reply'" [busy]="saving()" (closed)="editing.set(null)">
        <form id="reply-form" class="form-grid" [formGroup]="form" (ngSubmit)="save()" novalidate>
          <app-form-field class="span-2" label="Title" for="qr-title" [control]="form.controls.title" [required]="true">
            <input id="qr-title" class="input" formControlName="title" [class.is-invalid]="form.controls.title.touched && form.controls.title.invalid" />
          </app-form-field>
          <app-form-field class="span-2" label="Text" for="qr-body" [control]="form.controls.body" [required]="true">
            <textarea id="qr-body" class="textarea" rows="7" formControlName="body"
              [class.is-invalid]="form.controls.body.touched && form.controls.body.invalid"></textarea>
          </app-form-field>
          @if (canManageShared()) {
            <div class="field span-2">
              <div class="inline-control">
                <app-toggle-switch label="Share with the team" [checked]="form.controls.isShared.value" (toggled)="form.controls.isShared.setValue($event)" />
                <span class="text-sm">Share with the whole team</span>
              </div>
            </div>
          }
        </form>
        <ng-container modal-footer>
          <button type="button" class="btn btn-secondary" [disabled]="saving()" (click)="editing.set(null)">Cancel</button>
          <button type="submit" form="reply-form" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save' }}</button>
        </ng-container>
      </app-modal>
    }
  `,
  styles: `
    .loading { display: grid; place-items: center; padding: var(--space-8); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-4); }
    .reply { display: flex; flex-direction: column; padding: var(--space-4) var(--space-5); gap: var(--space-2); }
    .reply header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
    .body { flex: 1; white-space: pre-line; color: var(--color-text-muted); font-size: var(--fs-sm); overflow-wrap: anywhere; }
    .reply footer { display: flex; gap: var(--space-1); margin-inline-start: calc(-1 * var(--space-3)); }
    .danger-text:hover:not(:disabled) { color: var(--color-danger); background: var(--color-danger-soft); }
  `,
})
export class QuickReplies implements OnInit {
  private readonly api = inject(DashboardApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);

  protected readonly canManageShared = computed(() => this.auth.hasAnyPermission(Permissions.QuickReplies.Manage));
  protected readonly replies = signal<QuickReply[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly editing = signal<QuickReply | 'new' | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, Validators.maxLength(100)]],
    body: ['', [Validators.required, Validators.maxLength(4000)]],
    isShared: [false],
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.quickReplies().pipe(finalize(() => this.loading.set(false))).subscribe((r) => this.replies.set(r));
  }

  protected open(reply: QuickReply | null): void {
    this.form.reset({ title: reply?.title ?? '', body: reply?.body ?? '', isShared: reply?.isShared ?? false });
    this.editing.set(reply ?? 'new');
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const target = this.editing();
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .saveQuickReply(target && target !== 'new' ? target.id : null, { title: v.title.trim(), body: v.body.trim(), isShared: v.isShared })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (saved) => {
          this.toast.success(`"${saved.title}" saved.`);
          this.editing.set(null);
          this.load();
        },
        error: (err) => applyServerErrors(this.form, err),
      });
  }

  protected async remove(reply: QuickReply): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Delete quick reply?', message: `"${reply.title}" will be permanently deleted.`, confirmText: 'Delete' });
    if (!ok) return;
    this.api.deleteQuickReply(reply.id).subscribe(() => {
      this.toast.success(`"${reply.title}" was deleted.`);
      this.load();
    });
  }
}
