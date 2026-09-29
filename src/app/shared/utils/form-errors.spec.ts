import { FormControl, FormGroup } from '@angular/forms';
import { ApiError } from '../../core/models/api.models';
import { applyServerErrors, controlErrorMessage, passwordStrength } from './form-errors';

describe('form helpers', () => {
  it('passwordStrength lists what is missing and accepts strong passwords', () => {
    expect(passwordStrength(new FormControl('alllower'))).toEqual({
      passwordStrength: 'Password needs an uppercase letter, a digit, a symbol.',
    });
    expect(passwordStrength(new FormControl('Str0ng!pass'))).toBeNull();
    expect(passwordStrength(new FormControl(''))).toBeNull(); // "required" handles empty
  });

  it('applyServerErrors maps API field errors onto controls', () => {
    const form = new FormGroup({ email: new FormControl('a@b.c'), firstName: new FormControl('x') });
    const error = new ApiError(400, 'Validation failed', { email: ['Email already used.'], unknown: ['ignored'] });

    expect(applyServerErrors(form, error)).toBeTrue();
    expect(form.controls.email.errors).toEqual({ server: 'Email already used.' });
    expect(form.controls.email.touched).toBeTrue();
    expect(form.controls.firstName.errors).toBeNull();
    expect(controlErrorMessage(form.controls.email, 'Email')).toBe('Email already used.');
  });

  it('applyServerErrors ignores errors without field details', () => {
    const form = new FormGroup({ email: new FormControl('') });
    expect(applyServerErrors(form, new ApiError(409, 'Conflict'))).toBeFalse();
    expect(applyServerErrors(form, new Error('boom'))).toBeFalse();
  });
});
