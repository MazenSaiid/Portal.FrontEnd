import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResult, SortDirection } from '../../core/models/api.models';
import type { TicketSla } from '../sla/sla.api';

export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TicketStatus = 'New' | 'Open' | 'InProgress' | 'OnHold' | 'Resolved' | 'Closed';
export type TicketChannel = 'Email' | 'Phone' | 'WhatsApp' | 'Sms' | 'LiveChat' | 'WebForm' | 'Other';
export type TicketEventType =
  | 'Created' | 'Updated' | 'StatusChanged' | 'PriorityChanged' | 'CategoryChanged'
  | 'Assigned' | 'Unassigned' | 'Escalated' | 'DeEscalated' | 'Comment';

export interface TicketListItem {
  id: number;
  code: string;
  subject: string;
  customerId: number;
  customerCode: string;
  customerName: string;
  categoryName: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  isEscalated: boolean;
  createdAt: string;
  lastActivityAt: string;
  sla: TicketSla;
}

export interface Ticket {
  id: number;
  code: string;
  subject: string;
  description: string;
  customer: { id: number; code: string; name: string; email: string | null; phone: string | null; isActive: boolean };
  categoryId: number;
  categoryName: string;
  priority: TicketPriority;
  status: TicketStatus;
  channel: TicketChannel;
  assigneeId: string | null;
  assigneeName: string | null;
  isEscalated: boolean;
  escalatedAt: string | null;
  escalationReason: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  createdByName: string | null;
  lastActivityAt: string;
  sla: TicketSla;
  allowedStatuses: TicketStatus[];
}

export interface TicketQuery {
  search?: string;
  status?: TicketStatus[];
  priority?: TicketPriority;
  categoryId?: number;
  assignedTo?: string;
  customerId?: number;
  escalated?: boolean;
  sla?: 'breached' | 'atRisk';
  page: number;
  pageSize: number;
  sortBy: string;
  sortDirection: SortDirection;
}

export interface CreateTicketPayload {
  customerId: number;
  subject: string;
  description: string;
  categoryId: number;
  priority: TicketPriority;
  channel: TicketChannel;
  assigneeId: string | null;
}

export type UpdateTicketPayload = Omit<CreateTicketPayload, 'customerId' | 'assigneeId'>;

export interface TicketHistoryEntry {
  id: number;
  type: TicketEventType;
  fromValue: string | null;
  toValue: string | null;
  message: string | null;
  createdAt: string;
  createdByName: string | null;
}

export interface Assignee {
  id: string;
  fullName: string;
  email: string;
  activeTickets: number;
}

export interface TicketCategory {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  ticketCount: number;
}

export interface CustomerLookup {
  id: number;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class TicketsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/tickets`;

  list(query: TicketQuery): Observable<PagedResult<TicketListItem>> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('pageSize', query.pageSize)
      .set('sortBy', query.sortBy)
      .set('sortDirection', query.sortDirection);
    if (query.search) params = params.set('search', query.search);
    query.status?.forEach((s) => (params = params.append('status', s)));
    if (query.priority) params = params.set('priority', query.priority);
    if (query.categoryId) params = params.set('categoryId', query.categoryId);
    if (query.assignedTo) params = params.set('assignedTo', query.assignedTo);
    if (query.customerId) params = params.set('customerId', query.customerId);
    if (query.escalated !== undefined) params = params.set('escalated', query.escalated);
    if (query.sla) params = params.set('sla', query.sla);
    return this.http.get<PagedResult<TicketListItem>>(this.url, { params });
  }

  get(id: number): Observable<Ticket> {
    return this.http.get<Ticket>(`${this.url}/${id}`);
  }

  create(payload: CreateTicketPayload): Observable<Ticket> {
    return this.http.post<Ticket>(this.url, payload);
  }

  update(id: number, payload: UpdateTicketPayload): Observable<Ticket> {
    return this.http.put<Ticket>(`${this.url}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  changeStatus(id: number, status: TicketStatus, comment: string | null): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.url}/${id}/status`, { status, comment });
  }

  assign(id: number, assigneeId: string | null): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.url}/${id}/assign`, { assigneeId });
  }

  escalate(id: number, reason: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.url}/${id}/escalate`, { reason });
  }

  deEscalate(id: number, comment: string | null): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.url}/${id}/de-escalate`, { comment });
  }

  comment(id: number, content: string): Observable<TicketHistoryEntry> {
    return this.http.post<TicketHistoryEntry>(`${this.url}/${id}/comments`, { content });
  }

  history(id: number): Observable<TicketHistoryEntry[]> {
    return this.http.get<TicketHistoryEntry[]>(`${this.url}/${id}/history`);
  }

  assignees(): Observable<Assignee[]> {
    return this.http.get<Assignee[]>(`${this.url}/assignees`);
  }

  categories(activeOnly = false): Observable<TicketCategory[]> {
    const params = new HttpParams().set('activeOnly', activeOnly);
    return this.http.get<TicketCategory[]>(`${environment.apiUrl}/ticket-categories`, { params });
  }

  saveCategory(id: number | null, payload: { name: string; description: string | null; isActive: boolean }): Observable<TicketCategory> {
    const url = `${environment.apiUrl}/ticket-categories`;
    return id ? this.http.put<TicketCategory>(`${url}/${id}`, payload) : this.http.post<TicketCategory>(url, payload);
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/ticket-categories/${id}`);
  }

  lookupCustomers(search: string): Observable<CustomerLookup[]> {
    return this.http.get<CustomerLookup[]>(`${environment.apiUrl}/customers/lookup`, { params: { search } });
  }
}
