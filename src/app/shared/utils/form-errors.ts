import { AbstractControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { ApiError } from '../../core/models/api.models';

/** Human-readable message for the first error on a control. */
export function controlErrorMessage(control: AbstractControl, label: string): string | null {
  const errors = control.errors;
  if (!errors) return null;
  if (errors['server']) return errors['server'] as string;
  if (errors['required']) return `${label} is required.`;
  if (errors['email']) return 'Enter a valid email address.';
  if (errors['minlength']) return `${label} must be at least ${errors['minlength'].requiredLength} characters.`;
  if (errors['maxlength']) return `${label} must be at most ${errors['maxlength'].requiredLength} characters.`;
  if (errors['pattern']) return `${label} is not in a valid format.`;
  if (errors['passwordStrength']) return errors['passwordStrength'] as string;
  if (errors['mismatch']) return 'Passwords do not match.';
  return `${label} is invalid.`;
}

/**
 * Maps a 400 response's field errors (camelCase keys from the API) onto form controls.
 * Returns true when at least one error was attached, so the caller can skip a generic message.
 */
export function applyServerErrors(form: FormGroup, error: unknown): boolean {
  if (!(error instanceof ApiError) || !error.hasFieldErrors) return false;
  let applied = false;
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const control = form.get(field);
    if (control && messages.length) {
      control.setErrors({ ...control.errors, server: messages[0] });
      control.markAsTouched();
      applied = true;
    }
  }
  return applied;
}

/** Mirrors the backend Identity password policy so users get instant feedback. */
export const passwordStrength: ValidatorFn = (control) => {
  const value = (control.value as string) ?? '';
  if (!value) return null;
  const missing: string[] = [];
  if (!/[a-z]/.test(value)) missing.push('a lowercase letter');
  if (!/[A-Z]/.test(value)) missing.push('an uppercase letter');
  if (!/\d/.test(value)) missing.push('a digit');
  if (!/[^a-zA-Z0-9]/.test(value)) missing.push('a symbol');
  return missing.length ? { passwordStrength: `Password needs ${missing.join(', ')}.` } : null;
};

export const passwordValidators = [Validators.required, Validators.minLength(8), passwordStrength];

export const PHONE_PATTERN = /^\+?[0-9\s\-()]{6,20}$/;
