import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Icon } from './icon';

/**
 * Accessible dialog built on the native <dialog> element (focus trap, Esc to close, top layer).
 * Render it with @if; it opens when created and emits `closed` when dismissed.
 *
 * <app-modal title="Edit user" (closed)="...">
 *   ...body...
 *   <ng-container modal-footer>...buttons...</ng-container>
 * </app-modal>
 */
@Component({
  selector: 'app-modal',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dialog [class]="'modal modal-' + size()" (cancel)="onCancel($event)" (click)="onBackdropClick($event)">
      <div class="panel">
        <header class="header">
          <div>
            <h2>{{ title() }}</h2>
            @if (subtitle()) {
              <p class="text-muted text-sm">{{ subtitle() }}</p>
            }
          </div>
          <button type="button" class="btn btn-ghost btn-icon" aria-label="Close" [disabled]="busy()" (click)="closed.emit()">
            <app-icon name="x" />
          </button>
        </header>
        <div class="body"><ng-content /></div>
        <footer class="footer"><ng-content select="[modal-footer]" /></footer>
      </div>
    </dialog>
  `,
  styles: `
    .modal {
      padding: 0;
      border: 0;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      width: calc(100vw - 2 * var(--space-4));
      max-height: calc(100vh - 2 * var(--space-8));
      color: var(--color-text);
      background: var(--color-surface);
      &::backdrop { background: rgba(31, 26, 46, 0.45); }
    }
    .modal-sm { max-width: 420px; }
    .modal-md { max-width: 600px; }
    .panel { display: flex; flex-direction: column; max-height: inherit; }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-5) var(--space-6) var(--space-3);
    }
    .body { padding: var(--space-3) var(--space-6) var(--space-5); overflow-y: auto; }
    .footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-6);
      background: var(--color-surface-muted);
      border-block-start: 1px solid var(--color-border);
      &:empty { display: none; }
    }
  `,
})
export class Modal {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly size = input<'sm' | 'md'>('md');
  /** While true the dialog cannot be dismissed (e.g. a save is in flight). */
  readonly busy = input(false);
  readonly closed = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  protected onCancel(event: Event): void {
    event.preventDefault(); // we decide when to close, so the parent's @if stays the source of truth
    if (!this.busy()) this.closed.emit();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement && !this.busy()) this.closed.emit();
  }
}
