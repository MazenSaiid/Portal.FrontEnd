import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { CustomerNotes } from './customer-notes';

describe('CustomerNotes', () => {
  let fixture: ComponentFixture<CustomerNotes>;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/customers/3/notes`;

  async function create(canAdd: boolean): Promise<void> {
    fixture = TestBed.createComponent(CustomerNotes);
    fixture.componentRef.setInput('customerId', 3);
    fixture.componentRef.setInput('canAdd', canAdd);
    fixture.detectChanges();
    http.expectOne(url).flush([
      { id: 'n1', content: 'Mine', createdAt: '', createdByName: 'Sara Ali', updatedAt: null, canManage: true },
      { id: 'n2', content: 'Theirs', createdAt: '', createdByName: 'Omar', updatedAt: null, canManage: false },
    ]);
    await fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CustomerNotes],
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // Regression: the "Add note" button once did nothing because it relied on ngSubmit without a form directive.
  it('posts a note when "Add note" is clicked', async () => {
    await create(true);
    const textarea = fixture.nativeElement.querySelector('#note-new') as HTMLTextAreaElement;
    textarea.value = '  Call back on Thursday  ';
    textarea.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    (fixture.nativeElement.querySelector('.new-note .btn-primary') as HTMLButtonElement).click();

    const req = http.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ content: 'Call back on Thursday' });
    req.flush({ id: 'n3', content: 'Call back on Thursday', createdAt: '', createdByName: 'Sara Ali', updatedAt: null, canManage: true });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.note').length).toBe(3);
  });

  it('only shows edit and delete on notes the user may manage', async () => {
    await create(true);
    const notes = fixture.nativeElement.querySelectorAll('.note') as NodeListOf<HTMLElement>;
    expect(notes[0].querySelector('[aria-label="Delete note"]')).not.toBeNull();
    expect(notes[1].querySelector('[aria-label="Delete note"]')).toBeNull();
  });

  it('hides the composer without the AddActivity permission', async () => {
    await create(false);
    expect(fixture.nativeElement.querySelector('#note-new')).toBeNull();
  });
});
