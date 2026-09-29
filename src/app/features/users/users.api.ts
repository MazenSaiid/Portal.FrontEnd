import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResult, SortDirection } from '../../core/models/api.models';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  isActive: boolean;
  isLockedOut: boolean;
  roleId: string | null;
  roleName: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface UserQuery {
  search?: string;
  roleId?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDirection: SortDirection;
}

export interface UserPayload {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  roleId: string;
  isActive: boolean;
}

export interface CreateUserPayload extends UserPayload {
  password: string;
}

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/users`;

  list(query: UserQuery): Observable<PagedResult<User>> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('pageSize', query.pageSize)
      .set('sortBy', query.sortBy)
      .set('sortDirection', query.sortDirection);
    if (query.search) params = params.set('search', query.search);
    if (query.roleId) params = params.set('roleId', query.roleId);
    if (query.isActive !== undefined) params = params.set('isActive', query.isActive);
    return this.http.get<PagedResult<User>>(this.url, { params });
  }

  create(payload: CreateUserPayload): Observable<User> {
    return this.http.post<User>(this.url, payload);
  }

  update(id: string, payload: UserPayload): Observable<User> {
    return this.http.put<User>(`${this.url}/${id}`, payload);
  }

  setStatus(id: string, isActive: boolean): Observable<User> {
    return this.http.patch<User>(`${this.url}/${id}/status`, { isActive });
  }

  resetPassword(id: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/reset-password`, { newPassword });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
