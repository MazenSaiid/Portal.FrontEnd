import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Permissions } from '../../core/auth/permissions';
import { Icon, IconName } from '../../shared/ui/icon';
import { EmptyState, Spinner } from '../../shared/ui/states';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { initials } from '../../shared/utils/format';
import { priorityMeta, statusMeta } from '../tickets/ticket-labels';
import { TicketsApi } from '../tickets/tickets.api';
import { AgentDashboard as Dashboard, DashboardApi, DashboardTicket, TeamActivity } from './dashboard.api';
import { MyTasks } from './my-tasks';
import { RemindersService } from './reminders.service';

interface Tile {
  label: string;
  value: number;
  icon: IconName;
  tone: 'primary' | 'warning' | 'danger' | 'success' | 'info';
  query: Record<string, string>;
}

@Component({
  selector: 'app-agent-dashboard',
  imports: [DatePipe, RouterLink, Icon, EmptyState, Spinner, MyTasks],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agent-dashboard.html',
  styleUrl: './agent-dashboard.scss',
})
export class AgentDashboard implements OnInit {
  private readonly api = inject(DashboardApi);
  private readonly ticketsApi = inject(TicketsApi);
  private readonly toast = inject(ToastService);
  private readonly reminders = inject(RemindersService);
  protected readonly auth = inject(AuthService);
  protected readonly statusMeta = statusMeta;
  protected readonly priorityMeta = priorityMeta;
  protected readonly initials = initials;

  protected readonly data = signal<Dashboard | null>(null);
  protected readonly loading = signal(true);
  protected readonly takingId = signal<number | null>(null);
  protected readonly canWork = computed(() => this.auth.hasAnyPermission(Permissions.Tickets.Work));

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    return `${part}, ${this.auth.user()?.firstName ?? ''}`;
  });
  protected readonly today = new Date();

  protected readonly tiles = computed<Tile[]>(() => {
    const s = this.data()?.summary;
    if (!s) return [];
    const tiles: Tile[] = [
      { label: 'My active tickets', value: s.myActive, icon: 'ticket', tone: 'primary', query: { assignedTo: 'me' } },
      { label: 'In progress', value: s.inProgress, icon: 'activity', tone: 'info', query: { assignedTo: 'me', status: 'InProgress' } },
      { label: 'Escalated', value: s.escalated, icon: 'flag', tone: 'danger', query: { assignedTo: 'me', escalated: 'true' } },
      { label: 'High & urgent', value: s.highPriority, icon: 'zap', tone: 'warning', query: { assignedTo: 'me', sortBy: 'priority' } },
      { label: 'Unassigned queue', value: s.unassigned, icon: 'inbox', tone: 'info', query: { assignedTo: 'unassigned' } },
      { label: 'Resolved (7 days)', value: s.resolvedLast7Days, icon: 'check-circle', tone: 'success', query: { assignedTo: 'me', status: 'Resolved' } },
    ];
    return tiles;
  });

  /** Largest workload, for scaling the team bars. */
  protected readonly maxLoad = computed(() => Math.max(1, ...(this.data()?.team ?? []).map((m) => m.activeTickets)));

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api
      .dashboard()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((d) => {
        this.data.set(d);
        this.reminders.set(d.reminders);
      });
  }

  protected take(ticket: DashboardTicket): void {
    const me = this.auth.user()?.id;
    if (!me) return;
    this.takingId.set(ticket.id);
    this.ticketsApi
      .assign(ticket.id, me)
      .pipe(finalize(() => this.takingId.set(null)))
      .subscribe(() => {
        this.toast.success(`${ticket.code} is now yours.`);
        this.load();
      });
  }

  protected describe(a: TeamActivity): string {
    switch (a.type) {
      case 'Comment': return 'commented';
      case 'StatusChanged': return `moved it to ${statusMeta(a.toValue).label}`;
      case 'PriorityChanged': return `set priority to ${priorityMeta(a.toValue).label}`;
      case 'CategoryChanged': return `moved it to ${a.toValue}`;
      case 'Assigned': return `assigned it to ${a.toValue}`;
      case 'Unassigned': return 'unassigned it';
      case 'Escalated': return 'escalated it';
      case 'DeEscalated': return 'removed the escalation';
      case 'Created': return 'created it';
      default: return 'updated it';
    }
  }
}
