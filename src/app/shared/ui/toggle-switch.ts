import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * On/off switch. Stateless: the parent owns `checked` and reacts to `toggled`,
 * which makes optimistic updates with rollback straightforward.
 */
@Component({
  selector: 'app-toggle-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      role="switch"
      class="switch"
      [class.on]="checked()"
      [class.mixed]="mixed() && !checked()"
      [class.busy]="busy()"
      [attr.aria-checked]="mixed() && !checked() ? 'mixed' : checked()"
      [attr.aria-label]="label()"
      [disabled]="disabled() || busy()"
      (click)="toggled.emit(!checked())"
    >
      <span class="thumb"></span>
    </button>
  `,
  styles: `
    :host { display: inline-flex; }
    .switch {
      position: relative;
      flex: none;
      width: 40px;
      height: 22px;
      padding: 0;
      border: 0;
      border-radius: var(--radius-pill);
      background: var(--color-border-strong);
      cursor: pointer;
      transition: background var(--transition);
      &.on { background: var(--color-primary); }
      &.mixed { background: var(--color-accent); opacity: 0.7; }
      &:disabled { cursor: not-allowed; opacity: 0.5; }
      &.busy { cursor: progress; opacity: 0.7; }
    }
    .thumb {
      position: absolute;
      inset-block-start: 3px;
      inset-inline-start: 3px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #fff;
      box-shadow: var(--shadow-sm);
      transition: transform var(--transition);
    }
    .on .thumb { transform: translateX(18px); }
    .mixed .thumb { transform: translateX(9px); }
    :host-context([dir='rtl']) .on .thumb { transform: translateX(-18px); }
    :host-context([dir='rtl']) .mixed .thumb { transform: translateX(-9px); }
  `,
})
export class ToggleSwitch {
  readonly checked = input(false);
  /** Partially on (e.g. some permissions of a module are granted). */
  readonly mixed = input(false);
  readonly disabled = input(false);
  readonly busy = input(false);
  readonly label = input.required<string>();
  readonly toggled = output<boolean>();
}
