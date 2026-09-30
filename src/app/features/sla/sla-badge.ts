import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon } from '../../shared/ui/icon';
import { relative, SlaState, TicketSla } from './sla.api';

interface BadgeView {
  text: string;
  badge: string;
  title: string;
}

/**
 * One SLA traffic light for lists and cards. Shows the most urgent target: an overdue first response wins,
 * otherwise the resolution target.
 */
@Component({
  selector: 'app-sla-badge',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as v) {
      <span [class]="'badge ' + v.badge" [title]="v.title"><app-icon name="clock" [size]="12" /> {{ v.text }}</span>
    }
  `,
})
export class SlaBadge {
  readonly sla = input.required<TicketSla>();

  protected readonly view = computed<BadgeView | null>(() => {
    const s = this.sla();
    if (s.firstResponseState === 'Breached' && !s.firstRespondedAt) {
      return { text: 'Response overdue', badge: 'badge-danger', title: `First response was due ${relative(s.firstResponseDueAt!)}` };
    }
    return describe(s.resolutionState, s.resolutionDueAt, 'Resolution', !!s.resolvedAt);
  });
}

export function describe(state: SlaState, dueAt: string | null, what: string, completed: boolean): BadgeView | null {
  if (!dueAt || state === 'None') return null;
  switch (state) {
    case 'Met': return { text: 'Met', badge: 'badge-success', title: `${what} target met` };
    case 'Breached':
      return { text: completed ? 'Missed' : `Overdue ${relative(dueAt).replace(' ago', '')}`, badge: 'badge-danger', title: `${what} target missed` };
    case 'AtRisk': return { text: `Due ${relative(dueAt)}`, badge: 'badge-warning', title: `${what} target at risk` };
    default: return { text: `Due ${relative(dueAt)}`, badge: '', title: `${what} on track` };
  }
}
