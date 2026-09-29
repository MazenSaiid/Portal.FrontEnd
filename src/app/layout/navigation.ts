import { Permissions } from '../core/auth/permissions';
import { IconName } from '../shared/ui/icon';

export interface NavItem {
  label: string;
  icon: IconName;
  path: string;
  /** Shown when the user holds any of these; empty means every signed-in user. */
  permissions: string[];
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

/** Sidebar menu. New modules add an entry here; items the user cannot access are hidden. */
export const NAVIGATION: NavSection[] = [
  {
    items: [{ label: 'Overview', icon: 'dashboard', path: '/', permissions: [] }],
  },
  {
    title: 'Workspace',
    items: [{ label: 'Customers', icon: 'building', path: '/customers', permissions: [Permissions.Customers.View] }],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Users', icon: 'users', path: '/users', permissions: [Permissions.Users.View] },
      { label: 'Roles & permissions', icon: 'shield', path: '/roles', permissions: [Permissions.Roles.View] },
    ],
  },
];
