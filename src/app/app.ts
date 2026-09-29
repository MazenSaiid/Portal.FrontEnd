import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmHost } from './shared/ui/confirm/confirm-host';
import { Toasts } from './shared/ui/toast/toasts';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toasts, ConfirmHost],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <app-toasts />
    <app-confirm-host />
  `,
})
export class App {}
