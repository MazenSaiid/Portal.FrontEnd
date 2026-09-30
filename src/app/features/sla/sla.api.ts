import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { TicketPriority } from '../tickets/tickets.api';

export type SlaState = 'None' | 'OnTrack' | 'AtRisk' | 'Breached' | 'Met';
export type SlaTrigger = 'FirstResponseBreached' | 'ResolutionAtRisk' | 'ResolutionBreached' | 'UnassignedFor';

/** SLA status of a ticket (Spec 007, S5); states are computed by the server. */
export interface TicketSla {
  startedAt: string;
  firstResponseDueAt: string | null;
  firstRespondedAt: string | null;
  resolutionDueAt: string | null;
  resolvedAt: string | null;
  firstResponseState: SlaState;
  resolutionState: SlaState;
}

export interface SlaPolicy {
  priority: TicketPriority;
  firstResponseMinutes: number;
  resolutionMinutes: number;
}

export interface EscalationRule {
  id: number;
  name: string;
  isActive: boolean;
  trigger: SlaTrigger;
  thresholdMinutes: number | null;
  minPriority: TicketPriority | null;
  escalate: boolean;
  raisePriorityTo: TicketPriority | null;
  notifyAssignee: boolean;
  notifySupervisors: boolean;
  timesFired: number;
}

export type EscalationRulePayload = Omit<EscalationRule, 'id' | 'timesFired'>;

export const TRIGGERS: { value: SlaTrigger; label: string }[] = [
  { value: 'FirstResponseBreached', label: 'First response target missed' },
  { value: 'ResolutionAtRisk', label: 'Resolution target at risk (75% of time used)' },
  { value: 'ResolutionBreached', label: 'Resolution target missed' },
  { value: 'UnassignedFor', label: 'Unassigned for longer than…' },
];

export const triggerLabel = (t: SlaTrigger) => TRIGGERS.find((x) => x.value === t)?.label ?? t;

/** 30 → "30 min", 240 → "4 h", 1440 → "1 day", 90 → "1 h 30 min". */
export function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  const parts = [];
  if (days) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  if (hours) parts.push(`${hours} h`);
  if (minutes) parts.push(`${minutes} min`);
  return parts.join(' ');
}

/** Rough "in 3 h" / "2 d ago" for SLA badges. */
export function relative(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const minutes = Math.round(Math.abs(diff) / 60_000);
  const text = minutes < 60 ? `${Math.max(minutes, 1)}m` : minutes < 1440 ? `${Math.round(minutes / 60)}h` : `${Math.round(minutes / 1440)}d`;
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

@Injectable({ providedIn: 'root' })
export class SlaApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/sla`;

  policies(): Observable<SlaPolicy[]> {
    return this.http.get<SlaPolicy[]>(`${this.url}/policies`);
  }

  savePolicies(policies: SlaPolicy[]): Observable<SlaPolicy[]> {
    return this.http.put<SlaPolicy[]>(`${this.url}/policies`, policies);
  }

  settings(): Observable<{ autoAssignEnabled: boolean }> {
    return this.http.get<{ autoAssignEnabled: boolean }>(`${this.url}/settings`);
  }

  saveSettings(autoAssignEnabled: boolean): Observable<{ autoAssignEnabled: boolean }> {
    return this.http.put<{ autoAssignEnabled: boolean }>(`${this.url}/settings`, { autoAssignEnabled });
  }

  rules(): Observable<EscalationRule[]> {
    return this.http.get<EscalationRule[]>(`${this.url}/rules`);
  }

  saveRule(id: number | null, payload: EscalationRulePayload): Observable<EscalationRule> {
    return id ? this.http.put<EscalationRule>(`${this.url}/rules/${id}`, payload) : this.http.post<EscalationRule>(`${this.url}/rules`, payload);
  }

  deleteRule(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/rules/${id}`);
  }
}
