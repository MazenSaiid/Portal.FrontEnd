import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../../core/models/api.models';

export type AuditAction =
  | 'Created' | 'Updated' | 'Deleted'
  | 'SignedIn' | 'SignInFailed' | 'LockedOut' | 'SignedOut' | 'PasswordChanged' | 'PasswordReset' | 'TokenReuseDetected';

export interface AuditChange {
  field: string;
  from: string | null;
  to: string | null;
}

export interface AuditEntry {
  id: number;
  occurredAt: string;
  userId: string | null;
  userName: string | null;
  ipAddress: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  summary: string;
  changes: AuditChange[];
}

export interface AuditQuery {
  search?: string;
  action?: AuditAction;
  entityType?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export const AUDIT_ACTIONS: { value: AuditAction; label: string; badge: string }[] = [
  { value: 'Created', label: 'Created', badge: 'badge-success' },
  { value: 'Updated', label: 'Updated', badge: 'badge-info' },
  { value: 'Deleted', label: 'Deleted', badge: 'badge-danger' },
  { value: 'SignedIn', label: 'Signed in', badge: 'badge-primary' },
  { value: 'SignedOut', label: 'Signed out', badge: '' },
  { value: 'SignInFailed', label: 'Sign-in failed', badge: 'badge-warning' },
  { value: 'LockedOut', label: 'Locked out', badge: 'badge-danger' },
  { value: 'PasswordChanged', label: 'Password changed', badge: 'badge-primary' },
  { value: 'PasswordReset', label: 'Password reset', badge: 'badge-warning' },
  { value: 'TokenReuseDetected', label: 'Token reuse', badge: 'badge-danger' },
];

export const actionMeta = (a: AuditAction) => AUDIT_ACTIONS.find((x) => x.value === a) ?? AUDIT_ACTIONS[1];

/** "CustomerContact" → "Customer contact". */
export const entityLabel = (type: string) => type.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/ ([A-Z])/g, (m) => m.toLowerCase());

@Injectable({ providedIn: 'root' })
export class AuditApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/audit-logs`;

  list(q: AuditQuery): Observable<PagedResult<AuditEntry>> {
    let params = new HttpParams().set('page', q.page).set('pageSize', q.pageSize);
    if (q.search) params = params.set('search', q.search);
    if (q.action) params = params.set('action', q.action);
    if (q.entityType) params = params.set('entityType', q.entityType);
    if (q.from) params = params.set('from', q.from);
    if (q.to) params = params.set('to', q.to);
    return this.http.get<PagedResult<AuditEntry>>(this.url, { params });
  }

  entityTypes(): Observable<string[]> {
    return this.http.get<string[]>(`${this.url}/entity-types`);
  }
}
