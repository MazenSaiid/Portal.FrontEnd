import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Assignee, TicketEventType, TicketPriority, TicketStatus } from '../tickets/tickets.api';

export interface AgentTask {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  isDone: boolean;
  completedAt: string | null;
  ticketId: number | null;
  ticketCode: string | null;
  ticketSubject: string | null;
  customerId: number | null;
  customerCode: string | null;
  customerName: string | null;
  isOverdue: boolean;
  createdAt: string;
}

export interface TaskPayload {
  title: string;
  notes: string | null;
  dueAt: string | null;
  ticketId: number | null;
  customerId: number | null;
}

export interface Reminders {
  overdue: number;
  dueToday: number;
  total: number;
}

export interface DashboardTicket {
  id: number;
  code: string;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  isEscalated: boolean;
  categoryName: string;
  createdAt: string;
  lastActivityAt: string;
  customer: { id: number; code: string; name: string; email: string | null; phone: string | null; otherActiveTickets: number };
}

export interface TeamActivity {
  id: number;
  ticketId: number;
  ticketCode: string;
  ticketSubject: string;
  type: TicketEventType;
  fromValue: string | null;
  toValue: string | null;
  message: string | null;
  createdAt: string;
  createdByName: string | null;
}

export interface AgentDashboard {
  canViewTickets: boolean;
  summary: { myActive: number; inProgress: number; escalated: number; highPriority: number; unassigned: number; resolvedLast7Days: number };
  myTickets: DashboardTicket[];
  unassignedQueue: DashboardTicket[];
  team: Assignee[];
  teamActivity: TeamActivity[];
  tasks: AgentTask[];
  reminders: Reminders;
}

export interface QuickReply {
  id: number;
  title: string;
  body: string;
  isShared: boolean;
  canEdit: boolean;
}

export type QuickReplyPayload = Pick<QuickReply, 'title' | 'body' | 'isShared'>;

/** Fills {customer}, {agent} and {ticket} in a quick reply (Spec 005, D4). */
export function fillPlaceholders(body: string, values: { customer?: string | null; agent?: string | null; ticket?: string | null }): string {
  return body
    .replaceAll('{customer}', values.customer ?? 'there')
    .replaceAll('{agent}', values.agent ?? '')
    .replaceAll('{ticket}', values.ticket ?? 'your request');
}

/** The user's local end of day as an ISO (UTC) string, so "due today" means *their* today. */
export function endOfLocalDay(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  dashboard(): Observable<AgentDashboard> {
    return this.http.get<AgentDashboard>(`${this.api}/dashboard`, { params: { endOfDay: endOfLocalDay() } });
  }

  tasks(status: 'open' | 'done' | 'all' = 'open'): Observable<AgentTask[]> {
    return this.http.get<AgentTask[]>(`${this.api}/tasks`, { params: { status } });
  }

  reminders(): Observable<Reminders> {
    return this.http.get<Reminders>(`${this.api}/tasks/reminders`, { params: { endOfDay: endOfLocalDay() } });
  }

  saveTask(id: string | null, payload: TaskPayload): Observable<AgentTask> {
    return id ? this.http.put<AgentTask>(`${this.api}/tasks/${id}`, payload) : this.http.post<AgentTask>(`${this.api}/tasks`, payload);
  }

  setTaskDone(id: string, isDone: boolean): Observable<AgentTask> {
    return this.http.post<AgentTask>(`${this.api}/tasks/${id}/complete`, { isDone });
  }

  deleteTask(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/tasks/${id}`);
  }

  quickReplies(): Observable<QuickReply[]> {
    return this.http.get<QuickReply[]>(`${this.api}/quick-replies`);
  }

  saveQuickReply(id: number | null, payload: QuickReplyPayload): Observable<QuickReply> {
    return id
      ? this.http.put<QuickReply>(`${this.api}/quick-replies/${id}`, payload)
      : this.http.post<QuickReply>(`${this.api}/quick-replies`, payload);
  }

  deleteQuickReply(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/quick-replies/${id}`);
  }
}
