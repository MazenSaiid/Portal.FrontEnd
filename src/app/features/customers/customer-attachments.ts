import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { Icon } from '../../shared/ui/icon';
import { EmptyState, Spinner } from '../../shared/ui/states';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatFileSize } from '../../shared/utils/format';
import { ATTACHMENT_LIMITS, Attachment, CustomersApi } from './customers.api';

@Component({
  selector: 'app-customer-attachments',
  imports: [DatePipe, Icon, EmptyState, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (canAdd()) {
      <label class="dropzone" [class.over]="dragOver()" [class.busy]="uploading()"
        (dragover)="$event.preventDefault(); dragOver.set(true)" (dragleave)="dragOver.set(false)" (drop)="onDrop($event)">
        <input type="file" class="sr-only" [accept]="accept" (change)="onPick($event)" [disabled]="uploading()" />
        @if (uploading()) {
          <app-spinner /> <span>Uploading…</span>
        } @else {
          <app-icon name="upload" [size]="20" />
          <span><strong>Choose a file</strong> or drag it here</span>
          <span class="text-xs text-muted">PDF, images, Office or text files · up to 10 MB</span>
        }
      </label>
    }

    @if (loading()) {
      <div class="loading"><app-spinner /></div>
    } @else if (files().length === 0) {
      <app-empty-state icon="paperclip" title="No files yet" message="Contracts, invoices and screenshots live here." />
    } @else {
      <ul class="files">
        @for (file of files(); track file.id) {
          <li class="file">
            <span class="file-icon"><app-icon name="file" [size]="18" /></span>
            <div class="file-text">
              <button type="button" class="link" (click)="download(file)">{{ file.fileName }}</button>
              <span class="text-xs text-muted">
                {{ size(file.sizeBytes) }} · {{ file.createdAt | date: 'MMM d, y' }}{{ file.createdByName ? ' · ' + file.createdByName : '' }}
              </span>
            </div>
            <button type="button" class="btn btn-ghost btn-icon" title="Download" aria-label="Download file" (click)="download(file)">
              <app-icon name="download" [size]="16" />
            </button>
            @if (file.canManage) {
              <button type="button" class="btn btn-ghost btn-icon danger" title="Delete" aria-label="Delete file" (click)="remove(file)">
                <app-icon name="trash" [size]="16" />
              </button>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .dropzone {
      display: flex; flex-direction: column; align-items: center; gap: var(--space-1);
      padding: var(--space-6); margin-block-end: var(--space-5);
      border: 2px dashed var(--color-border-strong); border-radius: var(--radius-md);
      color: var(--color-text-muted); text-align: center; cursor: pointer;
      transition: border-color var(--transition), background var(--transition);
      app-icon { color: var(--color-primary); }
      strong { color: var(--color-primary); }
      &:hover, &.over { border-color: var(--color-primary); background: var(--color-primary-soft); }
      &.busy { cursor: progress; }
      &:focus-within { box-shadow: var(--focus-ring); }
    }
    .loading { display: grid; place-items: center; padding: var(--space-8); }
    .files { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .file { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) 0; border-block-end: 1px solid var(--color-border); }
    .file:last-child { border-block-end: 0; }
    .file-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: var(--radius-sm); background: var(--color-primary-soft); color: var(--color-primary); flex: none; }
    .file-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .link { padding: 0; border: 0; background: none; color: var(--color-text); font-weight: var(--fw-medium); text-align: start; cursor: pointer; overflow-wrap: anywhere; }
    .link:hover { color: var(--color-primary); text-decoration: underline; }
  `,
})
export class CustomerAttachments implements OnInit {
  private readonly api = inject(CustomersApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly customerId = input.required<number>();
  readonly canAdd = input(false);
  readonly changed = output<void>();

  protected readonly accept = ATTACHMENT_LIMITS.extensions.join(',');
  protected readonly size = formatFileSize;
  protected readonly files = signal<Attachment[]>([]);
  protected readonly loading = signal(true);
  protected readonly uploading = signal(false);
  protected readonly dragOver = signal(false);

  ngOnInit(): void {
    this.api
      .attachments(this.customerId())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((files) => this.files.set(files));
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow picking the same file again
    if (file) this.upload(file);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file && this.canAdd()) this.upload(file);
  }

  private upload(file: File): void {
    const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
    if (!ATTACHMENT_LIMITS.extensions.includes(extension)) {
      this.toast.error(`Files of type "${extension || 'unknown'}" are not allowed.`);
      return;
    }
    if (file.size === 0 || file.size > ATTACHMENT_LIMITS.maxBytes) {
      this.toast.error(file.size === 0 ? 'The file is empty.' : 'The file is larger than 10 MB.');
      return;
    }

    this.uploading.set(true);
    this.api
      .upload(this.customerId(), file)
      .pipe(finalize(() => this.uploading.set(false)))
      .subscribe((uploaded) => {
        this.files.update((list) => [uploaded, ...list]);
        this.toast.success(`${uploaded.fileName} uploaded.`);
        this.changed.emit();
      });
  }

  /** Downloads through HttpClient so the bearer token is sent, then hands the blob to the browser. */
  protected download(file: Attachment): void {
    this.api.download(this.customerId(), file.id).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  protected async remove(file: Attachment): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Delete file?', message: `"${file.fileName}" will be permanently deleted.`, confirmText: 'Delete file' });
    if (!ok) return;
    this.api.deleteAttachment(this.customerId(), file.id).subscribe(() => {
      this.files.update((list) => list.filter((f) => f.id !== file.id));
      this.toast.success('File deleted.');
      this.changed.emit();
    });
  }
}
