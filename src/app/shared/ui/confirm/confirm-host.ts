import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Modal } from '../modal';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-host',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (confirm.pending(); as c) {
      <app-modal [title]="c.title" size="sm" (closed)="confirm.answer(false)">
        <p>{{ c.message }}</p>
        <ng-container modal-footer>
          <button type="button" class="btn btn-secondary" (click)="confirm.answer(false)">Cancel</button>
          <button
            type="button"
            [class]="c.tone === 'primary' ? 'btn btn-primary' : 'btn btn-danger'"
            (click)="confirm.answer(true)"
          >
            {{ c.confirmText ?? 'Confirm' }}
          </button>
        </ng-container>
      </app-modal>
    }
  `,
})
export class ConfirmHost {
  protected readonly confirm = inject(ConfirmService);
}
