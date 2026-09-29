import { HttpContextToken } from '@angular/common/http';

/** Set on a request when the caller shows the error itself (e.g. the login form). */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);
