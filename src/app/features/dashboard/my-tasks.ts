import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { Icon } from '../../shared/ui/icon';
import { EmptyState } from '../../shared/ui/states';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { AgentTask, DashboardApi } from './dashboard.api';
import { RemindersService } from './reminders.service';
import { TaskDialog } from './task-dialog';

/** "My tasks" card: quick add, complete, edit, delete, and a toggle to see completed tasks. */
@Component({
  selector: 'app-my-tasks',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, Icon, EmptyState, TaskDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-tasks.html',
  styleUrl: './my-tasks.scss',
})
export class MyTasks implements OnInit {
  private readonly api = inject(DashboardApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly reminders = inject(RemindersService);

  /** Open tasks already loaded by the dashboard. */
  readonly initial = input.required<AgentTask[]>();

  protected readonly tasks = signal<AgentTask[]>([]);
  protected readonly showDone = signal(false);
  protected readonly busyId = signal<string | null>(null);
  protected readonly adding = signal(false);
  protected readonly editing = signal<AgentTask | 'new' | null>(null);
  protected readonly quickTitle = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200), Validators.pattern(/\S/)] });

  ngOnInit(): void {
    this.tasks.set(this.initial());
  }

  protected isDueToday(task: AgentTask): boolean {
    if (!task.dueAt || task.isOverdue) return false;
    const due = new Date(task.dueAt);
    return due.toDateString() === new Date().toDateString();
  }

  protected toggleDone(): void {
    this.showDone.update((v) => !v);
    this.load();
  }

  private load(): void {
    this.api.tasks(this.showDone() ? 'done' : 'open').subscribe((t) => this.tasks.set(t));
  }

  protected quickAdd(): void {
    if (this.quickTitle.invalid) return;
    this.adding.set(true);
    this.api
      .saveTask(null, { title: this.quickTitle.value.trim(), notes: null, dueAt: null, ticketId: null, customerId: null })
      .pipe(finalize(() => this.adding.set(false)))
      .subscribe((task) => {
        this.quickTitle.reset();
        if (!this.showDone()) this.tasks.update((list) => [...list, task]);
        this.toast.success('Task added.');
      });
  }

  protected setDone(task: AgentTask, isDone: boolean): void {
    this.busyId.set(task.id);
    this.api
      .setTaskDone(task.id, isDone)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe(() => {
        // It leaves the current view (open ↔ done).
        this.tasks.update((list) => list.filter((t) => t.id !== task.id));
        this.reminders.refresh(true);
        this.toast.success(isDone ? 'Task completed.' : 'Task reopened.');
      });
  }

  protected onSaved(): void {
    this.editing.set(null);
    this.load();
  }

  protected async remove(task: AgentTask): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Delete task?', message: `"${task.title}" will be permanently deleted.`, confirmText: 'Delete' });
    if (!ok) return;
    this.api.deleteTask(task.id).subscribe(() => {
      this.tasks.update((list) => list.filter((t) => t.id !== task.id));
      this.reminders.refresh(true);
      this.toast.success('Task deleted.');
    });
  }
}
