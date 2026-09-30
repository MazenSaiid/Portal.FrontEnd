import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { AgentTask } from './dashboard.api';
import { MyTasks } from './my-tasks';

const task = (extra: Partial<AgentTask>): AgentTask => ({
  id: 't1', title: 'Call back', notes: null, dueAt: null, isDone: false, completedAt: null, ticketId: null, ticketCode: null,
  ticketSubject: null, customerId: null, customerCode: null, customerName: null, isOverdue: false, createdAt: '', ...extra,
});

describe('MyTasks', () => {
  let fixture: ComponentFixture<MyTasks>;
  let http: HttpTestingController;
  const api = `${environment.apiUrl}/tasks`;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [MyTasks],
      providers: [
        provideZonelessChangeDetection(), provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthService, useValue: { hasAnyPermission: () => true, user: () => ({ id: 'me' }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyTasks);
    fixture.componentRef.setInput('initial', [
      task({ id: 'a', title: 'Overdue call', dueAt: new Date(Date.now() - 3600_000).toISOString(), isOverdue: true }),
      task({ id: 'b', title: 'Ticket follow-up', ticketId: 5, ticketCode: 'TCK-00005' }),
    ]);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('marks overdue tasks and links tasks to their ticket', () => {
    const items = el().querySelectorAll('.task');
    expect(items[0].querySelector('.badge-danger')!.textContent).toContain('Overdue');
    expect(items[1].querySelector('a')!.getAttribute('href')).toBe('/tickets/5');
  });

  it('adds a task with Enter', async () => {
    const input = el().querySelector('#quick-task') as HTMLInputElement;
    input.value = '  Send quote  ';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    (el().querySelector('.quick-add') as HTMLFormElement).dispatchEvent(new Event('submit'));

    const req = http.expectOne(api);
    expect(req.request.body).toEqual({ title: 'Send quote', notes: null, dueAt: null, ticketId: null, customerId: null });
    req.flush(task({ id: 'c', title: 'Send quote' }));
    await fixture.whenStable();
    expect(el().querySelectorAll('.task').length).toBe(3);
  });

  it('completing a task removes it from the open list and refreshes reminders', async () => {
    (el().querySelector('.task .check') as HTMLButtonElement).click();
    http.expectOne(`${api}/a/complete`).flush(task({ id: 'a', isDone: true }));
    http.expectOne((r) => r.url === `${api}/reminders`).flush({ overdue: 0, dueToday: 0, total: 0 });
    await fixture.whenStable();
    expect(el().querySelectorAll('.task').length).toBe(1);
  });
});
