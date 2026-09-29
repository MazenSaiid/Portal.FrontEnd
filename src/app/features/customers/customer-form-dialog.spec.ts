import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { CustomerFormDialog } from './customer-form-dialog';

describe('CustomerFormDialog', () => {
  let fixture: ComponentFixture<CustomerFormDialog>;
  let http: HttpTestingController;
  // The form is protected; tests reach it to check the rules directly.
  const form = () => (fixture.componentInstance as unknown as { form: FormGroup }).form;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CustomerFormDialog],
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CustomerFormDialog);
    fixture.componentRef.setInput('customer', null);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('requires an email or a phone (CR1)', () => {
    form().patchValue({ name: 'Acme', email: '', phone: '', preferredChannel: 'Phone' });
    expect(form().hasError('unreachable')).toBeTrue();

    form().patchValue({ phone: '+966 55 123 4567' });
    expect(form().hasError('unreachable')).toBeFalse();
  });

  it('requires details that match the preferred channel (CR2)', () => {
    form().patchValue({ name: 'Acme', email: 'a@acme.test', phone: '', preferredChannel: 'WhatsApp' });
    expect(form().hasError('channelMismatch')).toBeTrue();

    form().patchValue({ preferredChannel: 'Email' });
    expect(form().valid).toBeTrue();
  });

  it('sends trimmed values with blanks as null', async () => {
    form().patchValue({ name: '  Acme  ', email: 'a@acme.test', phone: '', city: ' Riyadh ', preferredChannel: 'Email' });
    (fixture.nativeElement.querySelector('#customer-form') as HTMLFormElement).dispatchEvent(new Event('submit'));

    const req = http.expectOne(`${environment.apiUrl}/customers`);
    expect(req.request.body).toEqual(jasmine.objectContaining({ name: 'Acme', phone: null, city: 'Riyadh', addressLine: null }));
    req.flush({ id: 1, code: 'CUS-00001', name: 'Acme' });
  });
});
