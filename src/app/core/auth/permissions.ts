/**
 * Permission keys used to gate UI elements. They mirror the backend's
 * PermissionRegistry. The permissions screen itself is fully data-driven
 * (it lists whatever the API returns), so this file only lists keys the UI checks.
 */
export const Permissions = {
  Dashboard: {
    View: 'Dashboard.View',
  },
  QuickReplies: {
    Manage: 'QuickReplies.Manage',
  },
  Customers: {
    View: 'Customers.View',
    Create: 'Customers.Create',
    Edit: 'Customers.Edit',
    Delete: 'Customers.Delete',
    AddActivity: 'Customers.AddActivity',
  },
  Tickets: {
    View: 'Tickets.View',
    Create: 'Tickets.Create',
    Edit: 'Tickets.Edit',
    Work: 'Tickets.Work',
    Assign: 'Tickets.Assign',
    Escalate: 'Tickets.Escalate',
    Delete: 'Tickets.Delete',
    ManageCategories: 'Tickets.ManageCategories',
  },
  Users: {
    View: 'Users.View',
    Create: 'Users.Create',
    Edit: 'Users.Edit',
    Delete: 'Users.Delete',
  },
  Roles: {
    View: 'Roles.View',
    Create: 'Roles.Create',
    Edit: 'Roles.Edit',
    Delete: 'Roles.Delete',
    ManagePermissions: 'Roles.ManagePermissions',
  },
} as const;
