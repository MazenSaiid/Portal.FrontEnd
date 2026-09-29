import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard } from './core/auth/guards';
import { Permissions } from './core/auth/permissions';
import { Shell } from './layout/shell';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in · Portal',
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Overview · Portal',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'users',
        title: 'Users · Portal',
        canActivate: [permissionGuard],
        data: { permissions: [Permissions.Users.View] },
        loadComponent: () => import('./features/users/users-list').then((m) => m.UsersList),
      },
      {
        path: 'roles',
        title: 'Roles · Portal',
        canActivate: [permissionGuard],
        data: { permissions: [Permissions.Roles.View] },
        loadComponent: () => import('./features/roles/roles-list').then((m) => m.RolesList),
      },
      {
        path: 'roles/:id/permissions',
        title: 'Role permissions · Portal',
        canActivate: [permissionGuard],
        data: { permissions: [Permissions.Roles.View] },
        loadComponent: () => import('./features/roles/role-permissions').then((m) => m.RolePermissionsPage),
      },
      {
        path: 'forbidden',
        title: 'Access denied · Portal',
        loadComponent: () => import('./features/errors/error-pages').then((m) => m.Forbidden),
      },
      {
        path: '**',
        title: 'Not found · Portal',
        loadComponent: () => import('./features/errors/error-pages').then((m) => m.NotFound),
      },
    ],
  },
];
