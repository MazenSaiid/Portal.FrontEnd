import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { of, startWith, switchMap } from 'rxjs';
import { controlErrorMessage } from '../utils/form-errors';

/**
 * Label + projected control + a single error line. Client-side validators and
 * server-side errors (applied with `applyServerErrors`) show in the same place.
 */
@Component({
  selector: 'app-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'field' },
  template: `
    <label [attr.for]="for()">
      {{ label() }}
      @if (required()) {
        <span class="required" aria-hidden="true">*</span>
      }
    </label>
    <ng-content />
    @if (error(); as message) {
      <span class="error" role="alert">{{ message }}</span>
    } @else if (hint()) {
      <span class="hint">{{ hint() }}</span>
    }
  `,
})
export class FormField {
  readonly label = input.required<string>();
  readonly for = input<string>();
  readonly control = input<AbstractControl | null>(null);
  readonly hint = input<string>();
  readonly required = input(false);

  // Re-evaluate whenever the control's value/status/touched state changes.
  private readonly events = toSignal(
    toObservable(this.control).pipe(switchMap((c) => (c ? c.events.pipe(startWith(null)) : of(null)))),
  );

  protected readonly error = computed(() => {
    this.events();
    const control = this.control();
    return control && control.invalid && (control.touched || control.dirty) ? controlErrorMessage(control, this.label()) : null;
  });
}
