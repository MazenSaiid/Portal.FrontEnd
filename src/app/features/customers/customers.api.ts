import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResult, SortDirection } from '../../core/models/api.models';

export type CustomerType = 'Individual' | 'Company';
export type ContactChannel = 'Email' | 'Phone' | 'WhatsApp' | 'Sms';
export type PreferredLanguage = 'English' | 'Arabic';
export type InteractionType = 'Call' | 'Email' | 'Meeting' | 'WhatsApp' | 'Sms' | 'Chat' | 'Other';
export type InteractionDirection = 'Inbound' | 'Outbound';

export interface CustomerListItem {
  id: number;
  code: string;
  type: CustomerType;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  isActive: boolean;
  lastInteractionAt: string | null;
  createdAt: string;
}

export interface CustomerContact {
  id: string;
  name: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

export interface Customer {
  id: number;
  code: string;
  type: CustomerType;
  name: string;
  email: string | null;
  phone: string | null;
  preferredChannel: ContactChannel;
  preferredLanguage: PreferredLanguage;
  addressLine: string | null;
  city: string | null;
  country: string | null;
  isActive: boolean;
  createdAt: string;
  createdByName: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
  contacts: CustomerContact[];
  stats: { interactions: number; notes: number; attachments: number; lastInteractionAt: string | null };
}

export interface CustomerPayload {
  type: CustomerType;
  name: string;
  email: string | null;
  phone: string | null;
  preferredChannel: ContactChannel;
  preferredLanguage: PreferredLanguage;
  addressLine: string | null;
  city: string | null;
  country: string | null;
  isActive: boolean;
}

export interface CustomerQuery {
  search?: string;
  type?: CustomerType;
  isActive?: boolean;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDirection: SortDirection;
}

export type ContactPayload = Omit<CustomerContact, 'id'>;

export interface Interaction {
  id: string;
  type: InteractionType;
  direction: InteractionDirection;
  subject: string;
  summary: string | null;
  occurredAt: string;
  createdAt: string;
  createdByName: string | null;
}

export interface InteractionPayload {
  type: InteractionType;
  direction: InteractionDirection;
  subject: string;
  summary: string | null;
  occurredAt: string | null;
}

export interface Note {
  id: string;
  content: string;
  createdAt: string;
  createdByName: string | null;
  updatedAt: string | null;
  canManage: boolean;
}

export interface Attachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  createdByName: string | null;
  canManage: boolean;
}

/** Mirrors the server limits (AttachmentRules) for instant feedback; the server still enforces them. */
export const ATTACHMENT_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  extensions: ['.pdf', '.png', '.jpg', '.jpeg', '.txt', '.csv', '.doc', '.docx', '.xls', '.xlsx'],
};

@Injectable({ providedIn: 'root' })
export class CustomersApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/customers`;

  list(query: CustomerQuery): Observable<PagedResult<CustomerListItem>> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('pageSize', query.pageSize)
      .set('sortBy', query.sortBy)
      .set('sortDirection', query.sortDirection);
    if (query.search) params = params.set('search', query.search);
    if (query.type) params = params.set('type', query.type);
    if (query.isActive !== undefined) params = params.set('isActive', query.isActive);
    return this.http.get<PagedResult<CustomerListItem>>(this.url, { params });
  }

  get(id: number): Observable<Customer> {
    return this.http.get<Customer>(`${this.url}/${id}`);
  }

  create(payload: CustomerPayload): Observable<Customer> {
    return this.http.post<Customer>(this.url, payload);
  }

  update(id: number, payload: CustomerPayload): Observable<Customer> {
    return this.http.put<Customer>(`${this.url}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  // Contacts — every call returns the updated list.
  addContact(id: number, payload: ContactPayload): Observable<CustomerContact[]> {
    return this.http.post<CustomerContact[]>(`${this.url}/${id}/contacts`, payload);
  }

  updateContact(id: number, contactId: string, payload: ContactPayload): Observable<CustomerContact[]> {
    return this.http.put<CustomerContact[]>(`${this.url}/${id}/contacts/${contactId}`, payload);
  }

  deleteContact(id: number, contactId: string): Observable<CustomerContact[]> {
    return this.http.delete<CustomerContact[]>(`${this.url}/${id}/contacts/${contactId}`);
  }

  interactions(id: number, page: number, pageSize = 20): Observable<PagedResult<Interaction>> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PagedResult<Interaction>>(`${this.url}/${id}/interactions`, { params });
  }

  logInteraction(id: number, payload: InteractionPayload): Observable<Interaction> {
    return this.http.post<Interaction>(`${this.url}/${id}/interactions`, payload);
  }

  notes(id: number): Observable<Note[]> {
    return this.http.get<Note[]>(`${this.url}/${id}/notes`);
  }

  addNote(id: number, content: string): Observable<Note> {
    return this.http.post<Note>(`${this.url}/${id}/notes`, { content });
  }

  updateNote(id: number, noteId: string, content: string): Observable<Note> {
    return this.http.put<Note>(`${this.url}/${id}/notes/${noteId}`, { content });
  }

  deleteNote(id: number, noteId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}/notes/${noteId}`);
  }

  attachments(id: number): Observable<Attachment[]> {
    return this.http.get<Attachment[]>(`${this.url}/${id}/attachments`);
  }

  upload(id: number, file: File): Observable<Attachment> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<Attachment>(`${this.url}/${id}/attachments`, form);
  }

  download(id: number, attachmentId: string): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/attachments/${attachmentId}/download`, { responseType: 'blob' });
  }

  deleteAttachment(id: number, attachmentId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}/attachments/${attachmentId}`);
  }
}
