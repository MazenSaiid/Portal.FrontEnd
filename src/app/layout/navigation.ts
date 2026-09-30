import { Permissions } from '../core/auth/permissions';
import { IconName } from '../shared/ui/icon';

export interface NavItem {
  label: string;
  icon: IconName;
  path: string;
  /** Shown when the user holds any of these; empty means every signed-in user. */
  permissions: string[];
  /** Hidden when the user holds any of these (e.g. Overview is replaced by the dashboard). */
  hiddenWith?: string[];
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

/** Sidebar menu. New modules add an entry here; items the user cannot access are hidden. */
export const NAVIGATION: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', icon: 'dashboard', path: '/dashboard', permissions: [Permissions.Dashboard.View] },
      { label: 'Overview', icon: 'dashboard', path: '/overview', permissions: [], hiddenWith: [Permissions.Dashboard.View] },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { label: 'Tickets', icon: 'ticket', path: '/tickets', permissions: [Permissions.Tickets.View] },
      { label: 'Customers', icon: 'building', path: '/customers', permissions: [Permissions.Customers.View] },
      {
        label: 'Quick replies',
        icon: 'message',
        path: '/quick-replies',
        permissions: [Permissions.Tickets.Work, Permissions.QuickReplies.Manage],
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Users', icon: 'users', path: '/users', permissions: [Permissions.Users.View] },
      { label: 'Roles & permissions', icon: 'shield', path: '/roles', permissions: [Permissions.Roles.View] },
      { label: 'Audit log', icon: 'history', path: '/audit-log', permissions: [Permissions.AuditLogs.View] },
    ],
  },
];
