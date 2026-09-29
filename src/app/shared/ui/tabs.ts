import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { Icon, IconName } from './icon';

export interface TabItem {
  id: string;
  label: string;
  icon?: IconName;
  count?: number;
}

/** Tab strip. The parent renders the active panel: `@switch (tab()) { ... }` with `[(active)]="tab"`. */
@Component({
  selector: 'app-tabs',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist">
      @for (tab of tabs(); track tab.id) {
        <button type="button" role="tab" class="tab" [class.active]="tab.id === active()"
          [attr.aria-selected]="tab.id === active()" (click)="active.set(tab.id)">
          @if (tab.icon) {
            <app-icon [name]="tab.icon" [size]="16" />
          }
          {{ tab.label }}
          @if (tab.count !== undefined) {
            <span class="count">{{ tab.count }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    .tabs {
      display: flex;
      gap: var(--space-1);
      padding-inline: var(--space-3);
      border-block-end: 1px solid var(--color-border);
      overflow-x: auto;
    }
    .tab {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-3);
      border: 0;
      border-block-end: 2px solid transparent;
      margin-block-end: -1px;
      background: transparent;
      color: var(--color-text-muted);
      font-weight: var(--fw-medium);
      white-space: nowrap;
      cursor: pointer;
      &:hover { color: var(--color-primary); }
      &.active { color: var(--color-primary); border-block-end-color: var(--color-primary); }
    }
    .count {
      min-width: 20px;
      padding-inline: 6px;
      border-radius: var(--radius-pill);
      background: var(--color-surface-muted);
      border: 1px solid var(--color-border);
      font-size: var(--fs-xs);
      text-align: center;
    }
    .active .count { background: var(--color-primary-soft); border-color: transparent; }
  `,
})
export class Tabs {
  readonly tabs = input.required<TabItem[]>();
  readonly active = model.required<string>();
}
