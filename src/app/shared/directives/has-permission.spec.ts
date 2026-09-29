import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { HasPermission } from './has-permission';

@Component({
  imports: [HasPermission],
  template: `
    <button id="single" *appHasPermission="'Users.Create'">Add</button>
    <button id="any" *appHasPermission="['Users.Edit', 'Users.Delete']">Manage</button>
  `,
})
class Host {}

describe('HasPermission directive', () => {
  const permissions = signal<string[]>([]);

  beforeEach(() => {
    permissions.set([]);
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: AuthService,
          useValue: { hasAnyPermission: (...p: string[]) => p.some((x) => permissions().includes(x)) },
        },
      ],
    });
  });

  it('hides elements the user has no permission for', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('#single')).toBeNull();
    expect(fixture.nativeElement.querySelector('#any')).toBeNull();
  });

  it('shows elements when any listed permission is held and reacts to changes', async () => {
    const fixture = TestBed.createComponent(Host);
    permissions.set(['Users.Delete']);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('#single')).toBeNull();
    expect(fixture.nativeElement.querySelector('#any')).not.toBeNull();

    permissions.set(['Users.Create']);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('#single')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#any')).toBeNull();
  });
});
