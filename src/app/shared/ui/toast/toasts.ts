import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../icon';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toasts',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class]="'toast toast-' + toast.kind" role="status">
          <app-icon [name]="toast.kind === 'success' ? 'check' : toast.kind === 'error' ? 'alert' : 'info'" />
          <span class="message">{{ toast.message }}</span>
          <button type="button" class="btn btn-ghost btn-icon" aria-label="Dismiss" (click)="toasts.dismiss(toast.id)">
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      inset-block-start: var(--space-4);
      inset-inline-end: var(--space-4);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      width: min(380px, calc(100vw - 2 * var(--space-4)));
    }
    .toast {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-inline-start: 4px solid var(--color-info);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-md);
      animation: slide-in 180ms ease-out;
    }
    .toast-success { border-inline-start-color: var(--color-success); app-icon { color: var(--color-success); } }
    .toast-error { border-inline-start-color: var(--color-danger); app-icon { color: var(--color-danger); } }
    .toast-info app-icon { color: var(--color-info); }
    .message { flex: 1; font-size: var(--fs-sm); }
    @keyframes slide-in { from { opacity: 0; transform: translateY(-6px); } }
  `,
})
export class Toasts {
  protected readonly toasts = inject(ToastService);
}
