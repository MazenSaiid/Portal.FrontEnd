import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { RolePermissionsPage } from './role-permissions';
import { RolePermissions } from './roles.api';

const role: RolePermissions = {
  roleId: 'r1',
  roleName: 'Agent',
  isSystem: false,
  modules: [
    {
      module: 'Users',
      permissions: [
        { id: 1, key: 'Users.View', description: 'View users', isGranted: false },
        { id: 2, key: 'Users.Create', description: 'Create users', isGranted: false },
      ],
    },
  ],
};

describe('RolePermissionsPage', () => {
  let fixture: ComponentFixture<RolePermissionsPage>;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/roles/r1/permissions`;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RolePermissionsPage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { hasAnyPermission: () => true, user: () => null, refreshProfile: () => undefined, logout: () => undefined },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RolePermissionsPage);
    fixture.componentRef.setInput('id', 'r1');
    fixture.detectChanges();
    http.expectOne(url).flush(structuredClone(role));
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  const switches = () =>
    Array.from(fixture.nativeElement.querySelectorAll('.permission button[role=switch]')) as HTMLButtonElement[];

  it('renders a toggle per permission from the API', () => {
    expect(switches().length).toBe(2);
    expect(switches().every((s) => s.getAttribute('aria-checked') === 'false')).toBeTrue();
  });

  it('switches on optimistically and sends a single-permission grant', async () => {
    switches()[0].click();
    await fixture.whenStable();
    expect(switches()[0].getAttribute('aria-checked')).toBe('true');

    const req = http.expectOne(url);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ permissionIds: [1], isGranted: true });

    const granted = structuredClone(role);
    granted.modules[0].permissions[0].isGranted = true;
    req.flush(granted);
    await fixture.whenStable();
    expect(switches()[0].getAttribute('aria-checked')).toBe('true');
  });

  it('rolls the toggle back when the server refuses', async () => {
    switches()[0].click();
    await fixture.whenStable();

    http.expectOne(url).flush({ detail: 'Nope' }, { status: 422, statusText: 'Unprocessable Entity' });
    await fixture.whenStable();

    expect(switches()[0].getAttribute('aria-checked')).toBe('false');
  });

  it('module toggle grants every permission of the module in one request', async () => {
    (fixture.nativeElement.querySelector('.module-toggle button') as HTMLButtonElement).click();
    await fixture.whenStable();

    const req = http.expectOne(url);
    expect(req.request.body).toEqual({ permissionIds: [1, 2], isGranted: true });
    req.flush(structuredClone(role));
  });
});
