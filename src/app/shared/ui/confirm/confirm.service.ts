import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  tone?: 'danger' | 'primary';
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/** Promise-based confirmation dialog: `if (await confirm.ask({...})) { ... }`. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _pending = signal<PendingConfirm | null>(null);
  readonly pending = this._pending.asReadonly();

  ask(options: ConfirmOptions): Promise<boolean> {
    this._pending()?.resolve(false);
    return new Promise((resolve) => this._pending.set({ ...options, resolve }));
  }

  answer(confirmed: boolean): void {
    this._pending()?.resolve(confirmed);
    this._pending.set(null);
  }
}
