import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
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
        // Agents land on their dashboard; everyone else on the overview (Spec 005, D1).
        path: '',
        pathMatch: 'full',
        redirectTo: () =>
          inject(Router).parseUrl(inject(AuthService).hasAnyPermission(Permissions.Dashboard.View) ? '/dashboard' : '/overview'),
      },
      {
        path: 'overview',
        title: 'Overview · Portal',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'dashboard',
        title: 'Dashboard · Portal',
        canActivate: [permissionGuard],
        data: { permissions: [Permissions.Dashboard.View] },
        loadComponent: () => import('./features/dashboard/agent-dashboard').then((m) => m.AgentDashboard),
      },
      {
        path: 'quick-replies',
        title: 'Quick replies · Portal',
        canActivate: [permissionGuard],
        data: { permissions: [Permissions.Tickets.Work, Permissions.QuickReplies.Manage] },
        loadComponent: () => import('./features/quick-replies/quick-replies').then((m) => m.QuickReplies),
      },
      {
        path: 'tickets',
        title: 'Tickets · Portal',
        canActivate: [permissionGuard],
        data: { permissions: [Permissions.Tickets.View] },
        loadComponent: () => import('./features/tickets/tickets-list').then((m) => m.TicketsList),
      },
      {
        path: 'tickets/categories',
        title: 'Ticket categories · Portal',
        canActivate: [permissionGuard],
        data: { permissions: [Permissions.Tickets.ManageCategories] },
        loadComponent: () => import('./features/tickets/ticket-categories').then((m) => m.TicketCategories),
      },
      {
        path: 'tickets/:id',
        title: 'Ticket · Portal',
        canActivate: [permissionGuard],
        data: { permissions: [Permissions.Tickets.View] },
        loadComponent: () => import('./features/tickets/ticket-details').then((m) => m.TicketDetails),
      },
      {
        path: 'customers',
        title: 'Customers · Portal',
        canActivate: [permissionGuard],
        data: { permissions: [Permissions.Customers.View] },
        loadComponent: () => import('./features/customers/customers-list').then((m) => m.CustomersList),
      },
      {
        path: 'customers/:id',
        title: 'Customer · Portal',
        canActivate: [permissionGuard],
        data: { permissions: [Permissions.Customers.View] },
        loadComponent: () => import('./features/customers/customer-details').then((m) => m.CustomerDetails),
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
        path: 'sla',
        title: 'SLA & automation · Portal',
        canActivate: [permissionGuard],
        data: { permissions: [Permissions.Sla.Manage] },
        loadComponent: () => import('./features/sla/sla-settings').then((m) => m.SlaSettings),
      },
      {
        path: 'audit-log',
        title: 'Audit log · Portal',
        canActivate: [permissionGuard],
        data: { permissions: [Permissions.AuditLogs.View] },
        loadComponent: () => import('./features/audit/audit-log').then((m) => m.AuditLog),
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
