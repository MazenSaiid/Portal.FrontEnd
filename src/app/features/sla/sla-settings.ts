import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { FormField } from '../../shared/ui/form-field';
import { Icon } from '../../shared/ui/icon';
import { Modal } from '../../shared/ui/modal';
import { PageHeader } from '../../shared/ui/page-header';
import { EmptyState, Spinner } from '../../shared/ui/states';
import { ToggleSwitch } from '../../shared/ui/toggle-switch';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ApiError } from '../../core/models/api.models';
import { applyServerErrors } from '../../shared/utils/form-errors';
import { PRIORITIES, priorityMeta } from '../tickets/ticket-labels';
import { TicketPriority } from '../tickets/tickets.api';
import { EscalationRule, formatMinutes, SlaApi, SlaPolicy, SlaTrigger, TRIGGERS, triggerLabel } from './sla.api';

/** Admin page for Spec 007: SLA targets, auto-assignment and escalation rules. */
@Component({
  selector: 'app-sla-settings',
  imports: [FormsModule, ReactiveFormsModule, PageHeader, FormField, Icon, Modal, EmptyState, Spinner, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sla-settings.html',
  styleUrl: './sla-settings.scss',
})
export class SlaSettings implements OnInit {
  private readonly api = inject(SlaApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly priorities = PRIORITIES;
  protected readonly triggers = TRIGGERS;
  protected readonly priorityMeta = priorityMeta;
  protected readonly triggerLabel = triggerLabel;
  protected readonly formatMinutes = formatMinutes;

  protected readonly policies = signal<SlaPolicy[]>([]);
  protected readonly savingPolicies = signal(false);
  protected readonly autoAssign = signal(false);
  protected readonly savingAutoAssign = signal(false);
  protected readonly rules = signal<EscalationRule[]>([]);
  protected readonly loading = signal(true);
  protected readonly busyRuleId = signal<number | null>(null);
  protected readonly editing = signal<EscalationRule | 'new' | null>(null);
  protected readonly savingRule = signal(false);
  /** Errors that belong to the rule as a whole (e.g. no action chosen). */
  protected readonly ruleError = signal<string | null>(null);

  protected readonly ruleForm = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    isActive: [true],
    trigger: ['ResolutionBreached' as SlaTrigger],
    thresholdMinutes: [60],
    minPriority: ['' as TicketPriority | ''],
    escalate: [true],
    raisePriorityTo: ['' as TicketPriority | ''],
    notifyAssignee: [true],
    notifySupervisors: [false],
  });

  ngOnInit(): void {
    this.api.policies().subscribe((p) => this.policies.set(p));
    this.api.settings().subscribe((s) => this.autoAssign.set(s.autoAssignEnabled));
    this.loadRules();
  }

  private loadRules(): void {
    this.api.rules().pipe(finalize(() => this.loading.set(false))).subscribe((r) => this.rules.set(r));
  }

  // ---------- Targets ----------

  protected setMinutes(priority: TicketPriority, field: 'firstResponseMinutes' | 'resolutionMinutes', value: number): void {
    this.policies.update((list) => list.map((p) => (p.priority === priority ? { ...p, [field]: Math.max(0, Math.round(value || 0)) } : p)));
  }

  protected savePolicies(): void {
    this.savingPolicies.set(true);
    this.api
      .savePolicies(this.policies())
      .pipe(finalize(() => this.savingPolicies.set(false)))
      .subscribe({
        next: (p) => {
          this.policies.set(p);
          this.toast.success('SLA targets saved. They apply to new tickets and priority changes.');
        },
        error: () => this.api.policies().subscribe((p) => this.policies.set(p)),
      });
  }

  // ---------- Auto-assignment ----------

  protected setAutoAssign(enabled: boolean): void {
    this.savingAutoAssign.set(true);
    this.api
      .saveSettings(enabled)
      .pipe(finalize(() => this.savingAutoAssign.set(false)))
      .subscribe((s) => {
        this.autoAssign.set(s.autoAssignEnabled);
        this.toast.success(s.autoAssignEnabled ? 'Auto-assignment is on.' : 'Auto-assignment is off.');
      });
  }

  // ---------- Rules ----------

  protected describeActions(r: EscalationRule): string {
    const parts: string[] = [];
    if (r.escalate) parts.push('escalate');
    if (r.raisePriorityTo) parts.push(`raise to ${priorityMeta(r.raisePriorityTo).label}`);
    if (r.notifyAssignee) parts.push('notify assignee');
    if (r.notifySupervisors) parts.push('notify supervisors');
    return parts.join(' · ');
  }

  protected open(rule: EscalationRule | null): void {
    this.ruleForm.reset({
      name: rule?.name ?? '',
      isActive: rule?.isActive ?? true,
      trigger: rule?.trigger ?? 'ResolutionBreached',
      thresholdMinutes: rule?.thresholdMinutes ?? 60,
      minPriority: rule?.minPriority ?? '',
      escalate: rule?.escalate ?? true,
      raisePriorityTo: rule?.raisePriorityTo ?? '',
      notifyAssignee: rule?.notifyAssignee ?? true,
      notifySupervisors: rule?.notifySupervisors ?? false,
    });
    this.ruleError.set(null);
    this.editing.set(rule ?? 'new');
  }

  protected saveRule(): void {
    if (this.ruleForm.invalid) {
      this.ruleForm.markAllAsTouched();
      return;
    }
    const v = this.ruleForm.getRawValue();
    if (!v.escalate && !v.raisePriorityTo && !v.notifyAssignee && !v.notifySupervisors) {
      this.ruleError.set('Choose at least one action.'); // SL2, checked again by the server
      return;
    }
    this.ruleError.set(null);
    const target = this.editing();
    this.savingRule.set(true);
    this.api
      .saveRule(target && target !== 'new' ? target.id : null, {
        name: v.name.trim(),
        isActive: v.isActive,
        trigger: v.trigger,
        thresholdMinutes: v.trigger === 'UnassignedFor' ? Number(v.thresholdMinutes) : null,
        minPriority: v.minPriority || null,
        escalate: v.escalate,
        raisePriorityTo: v.raisePriorityTo || null,
        notifyAssignee: v.notifyAssignee,
        notifySupervisors: v.notifySupervisors,
      })
      .pipe(finalize(() => this.savingRule.set(false)))
      .subscribe({
        next: (saved) => {
          this.toast.success(`Rule "${saved.name}" saved.`);
          this.editing.set(null);
          this.loadRules();
        },
        error: (err) => {
          applyServerErrors(this.ruleForm, err);
          if (err instanceof ApiError) this.ruleError.set(err.fieldErrors['actions']?.[0] ?? null);
        },
      });
  }

  protected setRuleActive(rule: EscalationRule, isActive: boolean): void {
    this.busyRuleId.set(rule.id);
    const { id: _id, timesFired: _fired, ...payload } = rule;
    this.api
      .saveRule(rule.id, { ...payload, isActive })
      .pipe(finalize(() => this.busyRuleId.set(null)))
      .subscribe((saved) => this.rules.update((list) => list.map((r) => (r.id === saved.id ? saved : r))));
  }

  protected async removeRule(rule: EscalationRule): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Delete rule?', message: `"${rule.name}" will be permanently deleted.`, confirmText: 'Delete' });
    if (!ok) return;
    this.api.deleteRule(rule.id).subscribe(() => {
      this.toast.success(`"${rule.name}" was deleted.`);
      this.loadRules();
    });
  }
}
