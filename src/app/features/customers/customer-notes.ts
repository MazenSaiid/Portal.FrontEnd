import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { Icon } from '../../shared/ui/icon';
import { EmptyState, Spinner } from '../../shared/ui/states';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { initials } from '../../shared/utils/format';
import { CustomersApi, Note } from './customers.api';

@Component({
  selector: 'app-customer-notes',
  imports: [DatePipe, ReactiveFormsModule, Icon, EmptyState, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (canAdd()) {
      <div class="new-note">
        <label for="note-new" class="sr-only">New note</label>
        <textarea id="note-new" class="textarea" rows="3" [formControl]="draft"
          placeholder="Add an internal note — only your team can see it."></textarea>
        <div class="row-end">
          <span class="text-xs text-muted">{{ draft.value.length }}/4000</span>
          <button type="button" class="btn btn-primary btn-sm" [disabled]="draft.invalid || saving()" (click)="add()">
            {{ saving() ? 'Saving…' : 'Add note' }}
          </button>
        </div>
      </div>
    }

    @if (loading()) {
      <div class="loading"><app-spinner /></div>
    } @else if (notes().length === 0) {
      <app-empty-state icon="note" title="No notes yet" message="Notes keep the team aligned on this customer." />
    } @else {
      <ul class="notes">
        @for (note of notes(); track note.id) {
          <li class="note">
            <span class="avatar">{{ initials(note.createdByName) }}</span>
            <div class="note-body">
              <div class="note-head">
                <strong>{{ note.createdByName ?? 'Former user' }}</strong>
                <span class="text-xs text-muted">
                  {{ note.createdAt | date: 'MMM d, y, h:mm a' }}{{ note.updatedAt ? ' · edited' : '' }}
                </span>
                @if (note.canManage && editingId() !== note.id) {
                  <span class="note-actions">
                    <button type="button" class="btn btn-ghost btn-icon" aria-label="Edit note" title="Edit" (click)="startEdit(note)">
                      <app-icon name="edit" [size]="14" />
                    </button>
                    <button type="button" class="btn btn-ghost btn-icon danger" aria-label="Delete note" title="Delete" (click)="remove(note)">
                      <app-icon name="trash" [size]="14" />
                    </button>
                  </span>
                }
              </div>
              @if (editingId() === note.id) {
                <textarea class="textarea" rows="3" [formControl]="editDraft" aria-label="Edit note"></textarea>
                <div class="row-end">
                  <button type="button" class="btn btn-secondary btn-sm" (click)="editingId.set(null)">Cancel</button>
                  <button type="button" class="btn btn-primary btn-sm" [disabled]="editDraft.invalid || saving()" (click)="saveEdit(note)">Save</button>
                </div>
              } @else {
                <p class="content">{{ note.content }}</p>
              }
            </div>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .new-note { display: flex; flex-direction: column; gap: var(--space-2); margin-block-end: var(--space-5); }
    .row-end { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-3); }
    .loading { display: grid; place-items: center; padding: var(--space-8); }
    .notes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-4); }
    .note { display: flex; gap: var(--space-3); }
    .note-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-2);
      padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); background: var(--color-surface-muted); border: 1px solid var(--color-border); }
    .note-head { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
    .note-actions { margin-inline-start: auto; display: inline-flex; }
    .content { white-space: pre-line; overflow-wrap: anywhere; }
  `,
})
export class CustomerNotes implements OnInit {
  private readonly api = inject(CustomersApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly customerId = input.required<number>();
  readonly canAdd = input(false);
  readonly changed = output<void>();

  protected readonly initials = initials;
  protected readonly notes = signal<Note[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly editingId = signal<string | null>(null);

  private readonly noteValidators = [Validators.required, Validators.maxLength(4000), Validators.pattern(/\S/)];
  protected readonly draft = new FormControl('', { nonNullable: true, validators: this.noteValidators });
  protected readonly editDraft = new FormControl('', { nonNullable: true, validators: this.noteValidators });

  ngOnInit(): void {
    this.api
      .notes(this.customerId())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((notes) => this.notes.set(notes));
  }

  protected add(): void {
    if (this.draft.invalid) return;
    this.saving.set(true);
    this.api
      .addNote(this.customerId(), this.draft.value.trim())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe((note) => {
        this.notes.update((list) => [note, ...list]);
        this.draft.reset();
        this.toast.success('Note added.');
        this.changed.emit();
      });
  }

  protected startEdit(note: Note): void {
    this.editDraft.setValue(note.content);
    this.editingId.set(note.id);
  }

  protected saveEdit(note: Note): void {
    if (this.editDraft.invalid) return;
    this.saving.set(true);
    this.api
      .updateNote(this.customerId(), note.id, this.editDraft.value.trim())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe((updated) => {
        this.notes.update((list) => list.map((n) => (n.id === updated.id ? updated : n)));
        this.editingId.set(null);
        this.toast.success('Note updated.');
      });
  }

  protected async remove(note: Note): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Delete note?', message: 'This note will be permanently removed.', confirmText: 'Delete note' });
    if (!ok) return;
    this.api.deleteNote(this.customerId(), note.id).subscribe(() => {
      this.notes.update((list) => list.filter((n) => n.id !== note.id));
      this.toast.success('Note deleted.');
      this.changed.emit();
    });
  }
}
