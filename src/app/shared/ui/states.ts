import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon, IconName } from './icon';

@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty">
      <span class="icon"><app-icon [name]="icon()" [size]="24" /></span>
      <h3>{{ title() }}</h3>
      @if (message()) {
        <p class="text-muted text-sm">{{ message() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: `
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-10) var(--space-6);
      text-align: center;
    }
    .icon {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      margin-block-end: var(--space-2);
      border-radius: 50%;
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }
  `,
})
export class EmptyState {
  readonly icon = input<IconName>('inbox');
  readonly title = input.required<string>();
  readonly message = input<string>();
}

@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', 'aria-label': 'Loading' },
  template: `<span class="spinner" [style.width.px]="size()" [style.height.px]="size()"></span>`,
  styles: `
    :host { display: inline-flex; }
    .spinner {
      border: 2px solid var(--color-primary-soft);
      border-block-start-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 700ms linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `,
})
export class Spinner {
  readonly size = input(20);
}
