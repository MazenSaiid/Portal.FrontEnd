import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionCount: number;
  createdAt: string;
}

export interface RoleLookup {
  id: string;
  name: string;
}

export interface PermissionItem {
  id: number;
  key: string;
  description: string;
  isGranted: boolean;
}

export interface PermissionModule {
  module: string;
  permissions: PermissionItem[];
}

export interface RolePermissions {
  roleId: string;
  roleName: string;
  isSystem: boolean;
  modules: PermissionModule[];
}

export interface RolePayload {
  name: string;
  description: string | null;
}

@Injectable({ providedIn: 'root' })
export class RolesApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/roles`;

  list(search?: string): Observable<Role[]> {
    const params = search ? new HttpParams().set('search', search) : undefined;
    return this.http.get<Role[]>(this.url, { params });
  }

  lookup(): Observable<RoleLookup[]> {
    return this.http.get<RoleLookup[]>(`${this.url}/lookup`);
  }

  create(payload: RolePayload): Observable<Role> {
    return this.http.post<Role>(this.url, { ...payload, permissionIds: [] });
  }

  update(id: string, payload: RolePayload): Observable<Role> {
    return this.http.put<Role>(`${this.url}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  permissions(id: string): Observable<RolePermissions> {
    return this.http.get<RolePermissions>(`${this.url}/${id}/permissions`);
  }

  /** One id toggles a single permission; a module's ids toggle the whole module. */
  setPermissions(id: string, permissionIds: number[], isGranted: boolean): Observable<RolePermissions> {
    return this.http.put<RolePermissions>(`${this.url}/${id}/permissions`, { permissionIds, isGranted });
  }
}
