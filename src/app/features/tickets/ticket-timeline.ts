import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Icon, IconName } from '../../shared/ui/icon';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { initials } from '../../shared/utils/format';
import { DashboardApi, fillPlaceholders, QuickReply } from '../dashboard/dashboard.api';
import { priorityMeta, statusMeta } from './ticket-labels';
import { TicketHistoryEntry, TicketsApi } from './tickets.api';

interface EntryView {
  icon: IconName;
  tone: 'comment' | 'event' | 'alert' | 'success';
  text: string;
}

/** Ticket history (oldest first) with the comment box. Comments render as bubbles; changes as compact event lines. */
@Component({
  selector: 'app-ticket-timeline',
  imports: [DatePipe, ReactiveFormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="timeline">
      @for (entry of history(); track entry.id) {
        @let view = describe(entry);
        @if (entry.type === 'Comment') {
          <li class="comment">
            <span class="avatar">{{ initials(entry.createdByName) }}</span>
            <div class="bubble">
              <div class="meta">
                <strong>{{ entry.createdByName ?? 'Former user' }}</strong>
                <span class="text-xs text-muted">{{ entry.createdAt | date: 'MMM d, y, h:mm a' }}</span>
              </div>
              <p>{{ entry.message }}</p>
            </div>
          </li>
        } @else {
          <li class="event" [class]="'event tone-' + view.tone">
            <span class="dot"><app-icon [name]="view.icon" [size]="14" /></span>
            <div class="event-body">
              <span><strong>{{ entry.createdByName ?? 'System' }}</strong> {{ view.text }}</span>
              <span class="text-xs text-muted">{{ entry.createdAt | date: 'MMM d, h:mm a' }}</span>
              @if (entry.message && entry.type !== 'Updated') {
                <p class="event-note">{{ entry.message }}</p>
              }
            </div>
          </li>
        }
      }
    </ol>

    @if (canComment()) {
      <div class="composer">
        <label for="tk-comment" class="sr-only">Add a comment</label>
        <textarea id="tk-comment" class="textarea" rows="3" [formControl]="draft"
          placeholder="Add an update for the team — what you checked, who you contacted, next steps…"></textarea>
        <div class="composer-actions">
          <div class="quick-replies">
            <button type="button" class="btn btn-ghost btn-sm" [attr.aria-expanded]="pickerOpen()" (click)="togglePicker()">
              <app-icon name="zap" [size]="14" /> Quick reply
            </button>
            @if (pickerOpen()) {
              <ul class="picker card" role="menu">
                @for (r of replies(); track r.id) {
                  <li><button type="button" role="menuitem" (click)="insert(r)">
                    <strong>{{ r.title }}</strong>
                    <span class="text-xs text-muted">{{ r.isShared ? 'Team' : 'Personal' }}</span>
                  </button></li>
                } @empty {
                  <li class="text-sm text-muted empty">No quick replies yet.</li>
                }
              </ul>
            }
          </div>
          <span class="text-xs text-muted hint">Internal to your team.</span>
          <button type="button" class="btn btn-primary btn-sm" [disabled]="draft.invalid || saving()" (click)="send()">
            {{ saving() ? 'Posting…' : 'Add comment' }}
          </button>
        </div>
      </div>
    } @else if (closed()) {
      <p class="text-sm text-muted closed-note"><app-icon name="lock" [size]="14" /> This ticket is closed. Reopen it to add comments.</p>
    }
  `,
  styleUrl: './ticket-timeline.scss',
})
export class TicketTimeline {
  private readonly api = inject(TicketsApi);
  private readonly toast = inject(ToastService);

  readonly ticketId = input.required<number>();
  readonly history = input.required<TicketHistoryEntry[]>();
  readonly canComment = input(false);
  readonly closed = input(false);
  /** Used to fill quick-reply placeholders. */
  readonly ticketCode = input<string | null>(null);
  readonly customerName = input<string | null>(null);
  readonly commented = output<TicketHistoryEntry>();

  private readonly dashboardApi = inject(DashboardApi);
  private readonly auth = inject(AuthService);
  protected readonly replies = signal<QuickReply[]>([]);
  protected readonly pickerOpen = signal(false);
  private repliesLoaded = false;

  protected readonly initials = initials;
  protected readonly saving = signal(false);
  protected readonly draft = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(4000), Validators.pattern(/\S/)],
  });

  protected togglePicker(): void {
    this.pickerOpen.update((open) => !open);
    if (this.pickerOpen() && !this.repliesLoaded) {
      this.repliesLoaded = true;
      this.dashboardApi.quickReplies().subscribe((r) => this.replies.set(r));
    }
  }

  /** Appends the reply with placeholders filled in; the agent can still edit before posting. */
  protected insert(reply: QuickReply): void {
    const text = fillPlaceholders(reply.body, {
      customer: this.customerName(),
      agent: this.auth.user()?.fullName,
      ticket: this.ticketCode(),
    });
    const current = this.draft.value.trim();
    this.draft.setValue(current ? `${current}\n\n${text}` : text);
    this.pickerOpen.set(false);
  }

  protected send(): void {
    if (this.draft.invalid) return;
    this.saving.set(true);
    this.api
      .comment(this.ticketId(), this.draft.value.trim())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe((entry) => {
        this.draft.reset();
        this.toast.success('Comment added.');
        this.commented.emit(entry);
      });
  }

  protected describe(e: TicketHistoryEntry): EntryView {
    const status = (v: string | null) => statusMeta(v).label;
    const priority = (v: string | null) => priorityMeta(v).label;
    switch (e.type) {
      case 'Created': return { icon: 'plus', tone: 'event', text: `created the ticket as ${status(e.toValue)}` };
      case 'StatusChanged':
        return {
          icon: e.toValue === 'Resolved' ? 'check' : 'activity',
          tone: e.toValue === 'Resolved' || e.toValue === 'Closed' ? 'success' : 'event',
          text: `changed status from ${status(e.fromValue)} to ${status(e.toValue)}`,
        };
      case 'PriorityChanged': return { icon: 'flag', tone: 'event', text: `changed priority from ${priority(e.fromValue)} to ${priority(e.toValue)}` };
      case 'CategoryChanged': return { icon: 'tag', tone: 'event', text: `moved it from ${e.fromValue} to ${e.toValue}` };
      case 'Assigned': return { icon: 'user', tone: 'event', text: e.fromValue ? `reassigned it from ${e.fromValue} to ${e.toValue}` : `assigned it to ${e.toValue}` };
      case 'Unassigned': return { icon: 'user', tone: 'event', text: `unassigned ${e.fromValue ?? 'the ticket'}` };
      case 'Escalated': return { icon: 'alert', tone: 'alert', text: 'escalated the ticket' };
      case 'DeEscalated': return { icon: 'check', tone: 'event', text: 'removed the escalation' };
      case 'Updated': return { icon: 'edit', tone: 'event', text: (e.message ?? 'updated the ticket.').replace(/^Changed/, 'changed') };
      default: return { icon: 'activity', tone: 'event', text: 'updated the ticket' };
    }
  }
}
