import { IconName } from '../../shared/ui/icon';
import { TicketChannel, TicketPriority, TicketStatus } from './tickets.api';

/** Labels, badge styles and action verbs for ticket enums — one place, so every screen speaks the same language. */
export const STATUSES: { value: TicketStatus; label: string; badge: string; action: string }[] = [
  { value: 'New', label: 'New', badge: 'badge-info', action: 'Mark as new' },
  { value: 'Open', label: 'Open', badge: 'badge-primary', action: 'Reopen' },
  { value: 'InProgress', label: 'In progress', badge: 'badge-warning', action: 'Start work' },
  { value: 'OnHold', label: 'On hold', badge: '', action: 'Put on hold' },
  { value: 'Resolved', label: 'Resolved', badge: 'badge-success', action: 'Resolve' },
  { value: 'Closed', label: 'Closed', badge: '', action: 'Close' },
];

export const ACTIVE_STATUSES: TicketStatus[] = ['New', 'Open', 'InProgress', 'OnHold'];

export const PRIORITIES: { value: TicketPriority; label: string; badge: string }[] = [
  { value: 'Low', label: 'Low', badge: '' },
  { value: 'Medium', label: 'Medium', badge: 'badge-info' },
  { value: 'High', label: 'High', badge: 'badge-warning' },
  { value: 'Urgent', label: 'Urgent', badge: 'badge-danger' },
];

export const CHANNELS: { value: TicketChannel; label: string; icon: IconName }[] = [
  { value: 'Email', label: 'Email', icon: 'mail' },
  { value: 'Phone', label: 'Phone', icon: 'phone' },
  { value: 'WhatsApp', label: 'WhatsApp', icon: 'message' },
  { value: 'Sms', label: 'SMS', icon: 'message' },
  { value: 'LiveChat', label: 'Live chat', icon: 'message' },
  { value: 'WebForm', label: 'Web form', icon: 'globe' },
  { value: 'Other', label: 'Other', icon: 'activity' },
];

export const statusMeta = (v: string | null) => STATUSES.find((s) => s.value === v) ?? STATUSES[0];
export const priorityMeta = (v: string | null) => PRIORITIES.find((p) => p.value === v) ?? PRIORITIES[1];
export const channelMeta = (v: string | null) => CHANNELS.find((c) => c.value === v) ?? CHANNELS[CHANNELS.length - 1];

/** "Reopen" only makes sense from Resolved/Closed; from other states moving to Open is just "Open". */
export function statusAction(from: TicketStatus, to: TicketStatus): string {
  if (to === 'Open') return from === 'Resolved' || from === 'Closed' ? 'Reopen' : from === 'New' ? 'Open' : 'Back to open';
  return statusMeta(to).action;
}
