import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, finalize, of, switchMap } from 'rxjs';
import { PagedResult } from '../../core/models/api.models';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { Pagination } from '../../shared/ui/pagination';
import { EmptyState, Spinner } from '../../shared/ui/states';
import { actionMeta, AUDIT_ACTIONS, AuditAction, AuditApi, AuditEntry, AuditQuery, entityLabel } from './audit.api';

/** Read-only audit log (Spec 006): newest first, filterable, each row expands to show changed fields. */
@Component({
  selector: 'app-audit-log',
  imports: [DatePipe, ReactiveFormsModule, PageHeader, Pagination, EmptyState, Spinner, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-log.html',
  styleUrl: './audit-log.scss',
})
export class AuditLog {
  private readonly api = inject(AuditApi);
  protected readonly actions = AUDIT_ACTIONS;
  protected readonly actionMeta = actionMeta;
  protected readonly entityLabel = entityLabel;

  protected readonly query = signal<AuditQuery>({ page: 1, pageSize: 25 });
  protected readonly result = signal<PagedResult<AuditEntry> | null>(null);
  protected readonly loading = signal(true);
  protected readonly entityTypes = signal<string[]>([]);
  protected readonly expanded = signal<ReadonlySet<number>>(new Set());
  protected readonly search = new FormControl('', { nonNullable: true });

  constructor() {
    this.api.entityTypes().subscribe((t) => this.entityTypes.set(t));

    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((search) => this.patchQuery({ search: search.trim() || undefined }));

    toObservable(this.query)
      .pipe(
        switchMap((q) => {
          this.loading.set(true);
          return this.api.list(q).pipe(catchError(() => of(null)), finalize(() => this.loading.set(false)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((r) => {
        if (r) this.result.set(r);
      });
  }

  protected patchQuery(patch: Partial<AuditQuery>): void {
    this.query.update((q) => ({ ...q, page: 1, ...patch }));
  }

  protected goToPage(page: number): void {
    this.query.update((q) => ({ ...q, page }));
  }

  protected onAction(value: string): void {
    this.patchQuery({ action: (value || undefined) as AuditAction | undefined });
  }

  protected onEntityType(value: string): void {
    this.patchQuery({ entityType: value || undefined });
  }

  /** Date inputs are local days; send the start / end of that day as UTC. */
  protected onDate(which: 'from' | 'to', value: string): void {
    if (!value) {
      this.patchQuery({ [which]: undefined });
      return;
    }
    const d = new Date(`${value}T00:00:00`);
    if (which === 'to') d.setHours(23, 59, 59, 999);
    this.patchQuery({ [which]: d.toISOString() });
  }

  protected toggle(id: number): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected isFiltered(): boolean {
    const q = this.query();
    return !!(q.search || q.action || q.entityType || q.from || q.to);
  }
}
