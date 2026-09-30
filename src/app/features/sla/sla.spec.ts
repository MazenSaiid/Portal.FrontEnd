import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { SlaBadge } from './sla-badge';
import { formatMinutes, relative, TicketSla } from './sla.api';
import { SlaSettings } from './sla-settings';

const sla = (extra: Partial<TicketSla>): TicketSla => ({
  startedAt: new Date().toISOString(), firstResponseDueAt: null, firstRespondedAt: null, resolutionDueAt: null, resolvedAt: null,
  firstResponseState: 'None', resolutionState: 'None', ...extra,
});
const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

describe('SLA helpers', () => {
  it('formats minutes for people', () => {
    expect(formatMinutes(30)).toBe('30 min');
    expect(formatMinutes(240)).toBe('4 h');
    expect(formatMinutes(1440)).toBe('1 day');
    expect(formatMinutes(90)).toBe('1 h 30 min');
  });

  it('describes relative times', () => {
    const now = Date.parse('2026-09-30T10:00:00Z');
    expect(relative('2026-09-30T13:00:00Z', now)).toBe('in 3h');
    expect(relative('2026-09-28T10:00:00Z', now)).toBe('2d ago');
  });
});

describe('SlaBadge', () => {
  async function render(value: TicketSla): Promise<HTMLElement> {
    TestBed.configureTestingModule({ imports: [SlaBadge], providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(SlaBadge);
    fixture.componentRef.setInput('sla', value);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('warns loudest about a missed first response', async () => {
    const el = await render(sla({ firstResponseState: 'Breached', firstResponseDueAt: inHours(-1), resolutionState: 'OnTrack', resolutionDueAt: inHours(5) }));
    expect(el.textContent).toContain('Response overdue');
    expect(el.querySelector('.badge-danger')).not.toBeNull();
  });

  it('shows at-risk resolution as a warning with the time left', async () => {
    const el = await render(sla({ firstResponseState: 'Met', firstRespondedAt: inHours(-2), resolutionState: 'AtRisk', resolutionDueAt: inHours(1) }));
    expect(el.textContent).toContain('Due in 1h');
    expect(el.querySelector('.badge-warning')).not.toBeNull();
  });

  it('says "Missed" for tickets resolved late', async () => {
    const el = await render(sla({ firstResponseState: 'Met', firstRespondedAt: inHours(-9), resolutionState: 'Breached', resolutionDueAt: inHours(-5), resolvedAt: inHours(-1) }));
    expect(el.textContent).toContain('Missed');
  });
});

describe('SlaSettings', () => {
  let fixture: ComponentFixture<SlaSettings>;
  let http: HttpTestingController;
  const api = `${environment.apiUrl}/sla`;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SlaSettings],
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SlaSettings);
    fixture.detectChanges();
    http.expectOne(`${api}/policies`).flush([{ priority: 'Urgent', firstResponseMinutes: 30, resolutionMinutes: 240 }]);
    http.expectOne(`${api}/settings`).flush({ autoAssignEnabled: false });
    http.expectOne(`${api}/rules`).flush([]);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('toggles auto-assignment', async () => {
    (fixture.nativeElement.querySelector('.auto-assign button[role=switch]') as HTMLButtonElement).click();
    const req = http.expectOne(`${api}/settings`);
    expect(req.request.body).toEqual({ autoAssignEnabled: true });
    req.flush({ autoAssignEnabled: true });
  });

  it('refuses a rule without actions before calling the server', async () => {
    const addRule = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find((b) => b.textContent!.includes('Add rule'))!;
    addRule.click();
    await fixture.whenStable();
    const form = (fixture.componentInstance as unknown as { ruleForm: { patchValue(v: object): void } }).ruleForm;
    form.patchValue({ name: 'Nothing', escalate: false, notifyAssignee: false, notifySupervisors: false, raisePriorityTo: '' });
    (document.querySelector('#rule-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    http.expectNone(`${api}/rules`);
    expect(document.body.textContent).toContain('Choose at least one action.');
  });
});
