import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'app-pagination',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pagination">
      <span class="text-muted text-sm">
        @if (total() === 0) {
          No results
        } @else {
          Showing <strong>{{ from() }}–{{ to() }}</strong> of <strong>{{ total() }}</strong>
        }
      </span>
      <div class="controls">
        <label class="text-muted text-sm">
          Rows
          <select class="select page-size" (change)="pageSizeChange.emit(+$any($event.target).value)">
            @for (size of sizes; track size) {
              <option [value]="size" [selected]="size === pageSize()">{{ size }}</option>
            }
          </select>
        </label>
        <button type="button" class="btn btn-secondary btn-icon" aria-label="Previous page"
          [disabled]="page() <= 1" (click)="pageChange.emit(page() - 1)">
          <app-icon name="chevron-left" [size]="16" />
        </button>
        <span class="text-sm">Page {{ page() }} of {{ pages() }}</span>
        <button type="button" class="btn btn-secondary btn-icon" aria-label="Next page"
          [disabled]="page() >= pages()" (click)="pageChange.emit(page() + 1)">
          <app-icon name="chevron-right" [size]="16" />
        </button>
      </div>
    </div>
  `,
  styles: `
    .pagination {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-5);
      border-block-start: 1px solid var(--color-border);
    }
    .controls { display: flex; align-items: center; gap: var(--space-2); }
    label { display: flex; align-items: center; gap: var(--space-2); margin-inline-end: var(--space-3); }
    .page-size { width: 84px; height: var(--control-height-sm); }
  `,
})
export class Pagination {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected readonly sizes = [10, 25, 50];
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  protected readonly from = computed(() => (this.page() - 1) * this.pageSize() + 1);
  protected readonly to = computed(() => Math.min(this.total(), this.page() * this.pageSize()));
}
