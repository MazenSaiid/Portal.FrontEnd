import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { TicketDetails } from './ticket-details';
import { Ticket } from './tickets.api';

const baseTicket: Ticket = {
  id: 5, code: 'TCK-00005', subject: 'Invoice wrong', description: 'Charged twice',
  customer: { id: 1, code: 'CUS-00001', name: 'Al Noor', email: null, phone: null, isActive: true },
  categoryId: 1, categoryName: 'Billing', priority: 'Medium', status: 'Open', channel: 'Email',
  assigneeId: null, assigneeName: null, isEscalated: false, escalatedAt: null, escalationReason: null,
  resolvedAt: null, closedAt: null, createdAt: '', createdByName: 'Sara', lastActivityAt: '',
  allowedStatuses: ['InProgress', 'OnHold', 'Resolved', 'Closed'],
  sla: { startedAt: '', firstResponseDueAt: null, firstRespondedAt: null, resolutionDueAt: null, resolvedAt: null, firstResponseState: 'None', resolutionState: 'None' },
};

describe('TicketDetails', () => {
  let fixture: ComponentFixture<TicketDetails>;
  let http: HttpTestingController;
  const api = `${environment.apiUrl}/tickets/5`;
  const permissions = signal<string[]>([]);

  async function create(ticket: Ticket, perms: string[]): Promise<void> {
    permissions.set(perms);
    fixture = TestBed.createComponent(TicketDetails);
    fixture.componentRef.setInput('id', '5');
    fixture.detectChanges();
    http.expectOne(api).flush(ticket);
    http.expectOne(`${api}/history`).flush([]);
    if (perms.includes('Tickets.Assign')) http.expectOne(`${environment.apiUrl}/tickets/assignees`).flush([]);
    await fixture.whenStable();
  }

  const buttons = () => Array.from(fixture.nativeElement.querySelectorAll('.action-buttons button')) as HTMLButtonElement[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TicketDetails],
      providers: [
        provideZonelessChangeDetection(), provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            hasAnyPermission: (...p: string[]) => p.some((x) => permissions().includes(x)),
            user: () => ({ id: 'me', fullName: 'Me' }),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('offers only the statuses the workflow allows', async () => {
    await create(baseTicket, ['Tickets.View', 'Tickets.Work']);
    expect(buttons().map((b) => b.textContent!.trim())).toEqual(['Start work', 'Put on hold', 'Resolve', 'Close']);
  });

  it('hides workflow actions from users without Tickets.Work', async () => {
    await create(baseTicket, ['Tickets.View']);
    expect(buttons().length).toBe(0);
    expect(fixture.nativeElement.querySelector('#tk-comment')).toBeNull();
  });

  it('requires a note before resolving, then sends it', async () => {
    await create(baseTicket, ['Tickets.View', 'Tickets.Work']);
    buttons().find((b) => b.textContent!.includes('Resolve'))!.click();
    await fixture.whenStable();

    const submit = () => (Array.from(fixture.nativeElement.querySelectorAll('app-modal .btn-primary')) as HTMLButtonElement[])
      .find((b) => b.textContent!.includes('Resolve'))!.click();
    submit();
    await fixture.whenStable();
    http.expectNone(`${api}/status`);
    expect(fixture.nativeElement.textContent).toContain('Please add a note.');

    const note = fixture.nativeElement.querySelector('#tk-note') as HTMLTextAreaElement;
    note.value = 'Refund issued';
    note.dispatchEvent(new Event('input'));
    submit();

    const req = http.expectOne(`${api}/status`);
    expect(req.request.body).toEqual({ status: 'Resolved', comment: 'Refund issued' });
    req.flush({ ...baseTicket, status: 'Resolved', allowedStatuses: ['Open', 'Closed'] });
    http.expectOne(`${api}/history`).flush([]);
  });

  it('lets an agent take an unassigned ticket', async () => {
    await create(baseTicket, ['Tickets.View', 'Tickets.Work']);
    const take = fixture.nativeElement.querySelector('.take') as HTMLButtonElement;
    expect(take.textContent!.trim()).toBe('Assign to me');
    take.click();

    const req = http.expectOne(`${api}/assign`);
    expect(req.request.body).toEqual({ assigneeId: 'me' });
    req.flush({ ...baseTicket, assigneeId: 'me', assigneeName: 'Me' });
    http.expectOne(`${api}/history`).flush([]);
  });

  it('shows closed tickets as read-only', async () => {
    await create({ ...baseTicket, status: 'Closed', allowedStatuses: ['Open'] }, ['Tickets.View', 'Tickets.Work', 'Tickets.Edit', 'Tickets.Escalate']);
    expect(buttons().map((b) => b.textContent!.trim())).toEqual(['Reopen']);
    expect(fixture.nativeElement.querySelector('#tk-comment')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Escalate');
  });
});
