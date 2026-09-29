import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Title + description on the left, page actions (projected) on the right. Used by every page. */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="titles">
        <ng-content select="[header-back]" />
        <h1>{{ title() }}</h1>
        @if (description()) {
          <p class="text-muted">{{ description() }}</p>
        }
      </div>
      <div class="actions"><ng-content /></div>
    </div>
  `,
  styles: `
    .page-header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--space-4);
    }
    .titles { display: flex; flex-direction: column; gap: var(--space-1); }
    .actions { display: flex; gap: var(--space-3); }
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly description = input<string>();
}
