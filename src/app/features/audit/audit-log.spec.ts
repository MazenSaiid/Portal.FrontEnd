import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AuditEntry, entityLabel } from './audit.api';
import { AuditLog } from './audit-log';

const entry = (extra: Partial<AuditEntry>): AuditEntry => ({
  id: 1, occurredAt: '2026-09-30T10:00:00Z', userId: 'u', userName: 'Sara Ali', ipAddress: '10.0.0.5', action: 'Updated',
  entityType: 'Customer', entityId: '3', summary: 'Customer Al Noor (CUS-00003) updated',
  changes: [{ field: 'City', from: 'Riyadh', to: 'Jeddah' }], ...extra,
});

describe('AuditLog page', () => {
  let fixture: ComponentFixture<AuditLog>;
  let http: HttpTestingController;
  const api = `${environment.apiUrl}/audit-logs`;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AuditLog],
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AuditLog);
    fixture.detectChanges();
    http.expectOne(`${api}/entity-types`).flush(['Customer', 'Security']);
    await fixture.whenStable();
    http.expectOne((r) => r.url === api).flush({
      items: [entry({}), entry({ id: 2, action: 'SignInFailed', entityType: 'Security', summary: 'Failed sign-in', changes: [] })],
      page: 1, pageSize: 25, totalCount: 2, totalPages: 1,
    });
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('lists entries with user, IP and action', () => {
    const rows = el().querySelectorAll('tbody > tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Sara Ali');
    expect(rows[0].textContent).toContain('10.0.0.5');
    expect(rows[1].querySelector('.badge')!.textContent!.trim()).toBe('Sign-in failed');
  });

  it('expands an entry to show before and after values', async () => {
    (el().querySelector('tbody > tr') as HTMLElement).click();
    await fixture.whenStable();
    const details = el().querySelector('.changes')!;
    expect(details.querySelector('.from')!.textContent).toBe('Riyadh');
    expect(details.querySelector('.to')!.textContent).toBe('Jeddah');
  });

  it('filters by action', async () => {
    const select = el().querySelector('select[aria-label="Filter by action"]') as HTMLSelectElement;
    select.value = 'Deleted';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    const req = http.expectOne((r) => r.url === api);
    expect(req.request.params.get('action')).toBe('Deleted');
    req.flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
  });
});

describe('entityLabel', () => {
  it('turns type names into words', () => {
    expect(entityLabel('CustomerContact')).toBe('Customer contact');
    expect(entityLabel('Ticket')).toBe('Ticket');
  });
});
