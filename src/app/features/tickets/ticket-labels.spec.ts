import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { statusAction } from './ticket-labels';
import { TicketTimeline } from './ticket-timeline';
import { TicketHistoryEntry } from './tickets.api';

describe('ticket labels', () => {
  it('uses a verb that fits where the ticket comes from', () => {
    expect(statusAction('Closed', 'Open')).toBe('Reopen');
    expect(statusAction('Resolved', 'Open')).toBe('Reopen');
    expect(statusAction('New', 'Open')).toBe('Open');
    expect(statusAction('InProgress', 'Open')).toBe('Back to open');
    expect(statusAction('Open', 'InProgress')).toBe('Start work');
  });
});

describe('TicketTimeline', () => {
  const entry = (e: Partial<TicketHistoryEntry>): TicketHistoryEntry =>
    ({ id: 1, type: 'Created', fromValue: null, toValue: null, message: null, createdAt: '', createdByName: 'Sara', ...e });

  it('describes history entries in plain language', async () => {
    TestBed.configureTestingModule({
      imports: [TicketTimeline],
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(TicketTimeline);
    fixture.componentRef.setInput('ticketId', 1);
    fixture.componentRef.setInput('history', [
      entry({ id: 1, type: 'Created', toValue: 'New' }),
      entry({ id: 2, type: 'StatusChanged', fromValue: 'Open', toValue: 'InProgress' }),
      entry({ id: 3, type: 'Assigned', fromValue: 'Omar', toValue: 'Lina' }),
      entry({ id: 4, type: 'Comment', message: 'Called the customer' }),
    ]);
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('Sara created the ticket as New');
    expect(text).toContain('changed status from Open to In progress');
    expect(text).toContain('reassigned it from Omar to Lina');
    expect(fixture.nativeElement.querySelector('.bubble')!.textContent).toContain('Called the customer');
  });
});
