import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyState } from '../../shared/ui/states';

@Component({
  selector: 'app-forbidden',
  imports: [EmptyState, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page card">
      <app-empty-state icon="lock" title="Access denied" message="Your role does not include permission to view this page.">
        <a routerLink="/" class="btn btn-primary">Back to overview</a>
      </app-empty-state>
    </div>
  `,
})
export class Forbidden {}

@Component({
  selector: 'app-not-found',
  imports: [EmptyState, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page card">
      <app-empty-state icon="search" title="Page not found" message="The page you are looking for does not exist.">
        <a routerLink="/" class="btn btn-primary">Back to overview</a>
      </app-empty-state>
    </div>
  `,
})
export class NotFound {}
