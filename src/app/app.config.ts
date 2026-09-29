import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { authInterceptor } from './core/http/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    // Order matters: errorInterceptor sees responses last, after authInterceptor has tried to renew on 401.
    provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
    // Restore the session (and fresh permissions) before the first route guard runs.
    provideAppInitializer(() => inject(AuthService).restoreSession()),
  ],
};
