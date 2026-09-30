import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { AgentDashboard } from './agent-dashboard';
import { AgentDashboard as Dashboard, DashboardTicket, fillPlaceholders } from './dashboard.api';

const ticket = (id: number, extra: Partial<DashboardTicket> = {}): DashboardTicket => ({
  id, code: `TCK-0000${id}`, subject: `Ticket ${id}`, priority: 'High', status: 'Open', isEscalated: false,
  categoryName: 'Billing', createdAt: '', lastActivityAt: '',
  customer: { id: 1, code: 'CUS-00001', name: 'Al Noor', email: null, phone: '+966 55', otherActiveTickets: 2 },
  sla: { startedAt: '', firstResponseDueAt: null, firstRespondedAt: null, resolutionDueAt: null, resolvedAt: null, firstResponseState: 'None', resolutionState: 'None' },
  ...extra,
});

const data = (extra: Partial<Dashboard> = {}): Dashboard => ({
  canViewTickets: true,
  summary: { myActive: 3, inProgress: 1, escalated: 1, highPriority: 2, unassigned: 4, resolvedLast7Days: 5 },
  myTickets: [ticket(1, { isEscalated: true })],
  unassignedQueue: [ticket(9, { priority: 'Urgent' })],
  team: [{ id: 'me', fullName: 'Sara Ali', email: '', activeTickets: 3 }],
  teamActivity: [{ id: 1, ticketId: 1, ticketCode: 'TCK-00001', ticketSubject: 'x', type: 'Comment', fromValue: null, toValue: null,
    message: 'Customer called', createdAt: '', createdByName: 'Omar' }],
  tasks: [],
  reminders: { overdue: 0, dueToday: 0, total: 0 },
  ...extra,
});

describe('AgentDashboard', () => {
  let fixture: ComponentFixture<AgentDashboard>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  async function render(d: Dashboard, permissions = ['Dashboard.View', 'Tickets.View', 'Tickets.Work']): Promise<void> {
    TestBed.configureTestingModule({
      imports: [AgentDashboard],
      providers: [
        provideZonelessChangeDetection(), provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { hasAnyPermission: (...p: string[]) => p.some((x) => permissions.includes(x)), user: () => ({ id: 'me', firstName: 'Sara', fullName: 'Sara Ali' }) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AgentDashboard);
    fixture.detectChanges();
    http.expectOne((r) => r.url === `${environment.apiUrl}/dashboard`).flush(d);
    await fixture.whenStable();
  }

  afterEach(() => http.verify());

  it('shows summary tiles that deep-link to the filtered ticket list', async () => {
    await render(data());
    const tiles = Array.from(el().querySelectorAll('.tile')) as HTMLAnchorElement[];
    expect(tiles.map((t) => t.querySelector('.tile-value')!.textContent!.trim())).toEqual(['3', '1', '1', '2', '4', '5']);
    expect(tiles[2].getAttribute('href')).toBe('/tickets?assignedTo=me&escalated=true');
    expect(tiles[4].getAttribute('href')).toBe('/tickets?assignedTo=unassigned');
  });

  it('shows customer context on my tickets and the team feed', async () => {
    await render(data());
    const mine = el().querySelector('.ticket')!.textContent!;
    expect(mine).toContain('Al Noor');
    expect(mine).toContain('+2 open');
    expect(el().querySelector('.feed')!.textContent).toContain('Omar commented on TCK-00001');
  });

  it('takes a ticket from the queue', async () => {
    await render(data());
    (el().querySelector('.queue-item button') as HTMLButtonElement).click();

    const req = http.expectOne(`${environment.apiUrl}/tickets/9/assign`);
    expect(req.request.body).toEqual({ assigneeId: 'me' });
    req.flush({});
    http.expectOne((r) => r.url === `${environment.apiUrl}/dashboard`).flush(data({ unassignedQueue: [] }));
  });

  it('hides ticket sections for users without ticket access', async () => {
    await render(data({ canViewTickets: false, myTickets: [], unassignedQueue: [] }), ['Dashboard.View']);
    expect(el().querySelector('.tiles')).toBeNull();
    expect(el().textContent).not.toContain('Unassigned queue');
    expect(el().querySelector('app-my-tasks')).not.toBeNull();
  });
});

describe('fillPlaceholders', () => {
  it('fills customer, agent and ticket, with friendly fallbacks', () => {
    expect(fillPlaceholders('Hi {customer}, re {ticket}. {agent}', { customer: 'Al Noor', agent: 'Sara', ticket: 'TCK-00001' }))
      .toBe('Hi Al Noor, re TCK-00001. Sara');
    expect(fillPlaceholders('Hi {customer}, re {ticket}', {})).toBe('Hi there, re your request');
  });
});
