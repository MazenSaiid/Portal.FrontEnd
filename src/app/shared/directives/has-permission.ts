import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';

/**
 * Renders its template only when the user holds any of the given permissions,
 * and reacts live when permissions change.
 *
 *   <button *appHasPermission="Permissions.Users.Create">Add user</button>
 *   <div *appHasPermission="[Permissions.Roles.Edit, Permissions.Roles.Delete]">…</div>
 */
@Directive({ selector: '[appHasPermission]' })
export class HasPermission {
  private readonly auth = inject(AuthService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private rendered = false;

  readonly appHasPermission = input.required<string | readonly string[]>();

  constructor() {
    effect(() => {
      const required = this.appHasPermission();
      const allowed = this.auth.hasAnyPermission(...(typeof required === 'string' ? [required] : required));
      if (allowed && !this.rendered) {
        this.container.createEmbeddedView(this.template);
        this.rendered = true;
      } else if (!allowed && this.rendered) {
        this.container.clear();
        this.rendered = false;
      }
    });
  }
}
