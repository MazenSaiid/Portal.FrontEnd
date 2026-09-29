import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatFileSize } from '../../shared/utils/format';
import { CustomerAttachments } from './customer-attachments';

describe('CustomerAttachments', () => {
  let fixture: ComponentFixture<CustomerAttachments>;
  let http: HttpTestingController;
  let toast: ToastService;
  const url = `${environment.apiUrl}/customers/7/attachments`;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CustomerAttachments],
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(CustomerAttachments);
    fixture.componentRef.setInput('customerId', 7);
    fixture.componentRef.setInput('canAdd', true);
    fixture.detectChanges();
    http.expectOne(url).flush([]);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  function pick(file: File): void {
    const input = fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
  }

  it('uploads an allowed file as multipart form data', () => {
    pick(new File(['%PDF'], 'contract.pdf', { type: 'application/pdf' }));

    const req = http.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect((req.request.body as FormData).get('file')).toBeInstanceOf(File);
    req.flush({ id: 'a1', fileName: 'contract.pdf', contentType: 'application/pdf', sizeBytes: 4, createdAt: '', createdByName: null, canManage: true });
  });

  it('rejects disallowed types before uploading', () => {
    const spy = spyOn(toast, 'error');
    pick(new File(['MZ'], 'setup.exe'));

    http.expectNone(url);
    expect(spy).toHaveBeenCalledWith(jasmine.stringContaining('.exe'));
  });

  it('rejects empty files before uploading', () => {
    const spy = spyOn(toast, 'error');
    pick(new File([], 'empty.pdf'));

    http.expectNone(url);
    expect(spy).toHaveBeenCalledWith('The file is empty.');
  });
});

describe('formatFileSize', () => {
  it('formats bytes, kilobytes and megabytes', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(10 * 1024 * 1024)).toBe('10 MB');
  });
});
