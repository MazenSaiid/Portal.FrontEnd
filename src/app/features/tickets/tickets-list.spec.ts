import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { TicketsList } from './tickets-list';

describe('TicketsList deep links', () => {
  let http: HttpTestingController;

  async function open(query: Record<string, string>) {
    TestBed.configureTestingModule({
      imports: [TicketsList],
      providers: [
        provideZonelessChangeDetection(), provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
        { provide: AuthService, useValue: { hasAnyPermission: () => true } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TicketsList);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/ticket-categories?activeOnly=false`).flush([]);
    http.expectOne(`${environment.apiUrl}/tickets/assignees`).flush([]);
    await fixture.whenStable();
    return http.expectOne((r) => r.url === `${environment.apiUrl}/tickets`);
  }

  afterEach(() => http.verify());

  it('applies filters from the URL', async () => {
    const req = await open({ assignedTo: 'me', status: 'InProgress', escalated: 'true' });
    expect(req.request.params.getAll('status')).toEqual(['InProgress']);
    expect(req.request.params.get('assignedTo')).toBe('me');
    expect(req.request.params.get('escalated')).toBe('true');
    req.flush({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 });
  });

  it('ignores unknown values and falls back to active tickets', async () => {
    const req = await open({ status: 'Bogus' });
    expect(req.request.params.getAll('status')).toEqual(['New', 'Open', 'InProgress', 'OnHold']);
    req.flush({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 });
  });
});
