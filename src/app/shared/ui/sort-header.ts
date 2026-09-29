import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SortDirection } from '../../core/models/api.models';
import { Icon } from './icon';

/** Clickable, accessible table header: <th appSortHeader="email" [sortBy]="..." [sortDirection]="..." (sort)="...">Email</th> */
@Component({
  selector: 'th[appSortHeader]',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'sortable',
    tabindex: '0',
    '[attr.aria-sort]': 'active() ? (sortDirection() === "asc" ? "ascending" : "descending") : "none"',
    '(click)': 'sort.emit(appSortHeader())',
    '(keydown.enter)': 'sort.emit(appSortHeader())',
  },
  template: `
    <ng-content />
    @if (active()) {
      <app-icon [name]="sortDirection() === 'asc' ? 'arrow-up' : 'arrow-down'" [size]="12" />
    }
  `,
  styles: `app-icon { vertical-align: middle; margin-inline-start: var(--space-1); }`,
})
export class SortHeader {
  readonly appSortHeader = input.required<string>();
  readonly sortBy = input.required<string>();
  readonly sortDirection = input.required<SortDirection>();
  readonly sort = output<string>();

  protected readonly active = computed(() => this.sortBy() === this.appSortHeader());
}
