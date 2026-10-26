import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import type { Observable } from 'rxjs';
import { apiErrorMessage } from './api.service';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snack = inject(MatSnackBar);
  private readonly t = inject(TranslateService);

  success(messageOrKey: string, params?: Record<string, unknown>): void {
    this.open(this.t.instant(messageOrKey, params), 'ds-toast-success', 3000);
  }

  error(messageOrKey: string, params?: Record<string, unknown>): void {
    this.open(this.t.instant(messageOrKey, params), 'ds-toast-error', 5000);
  }

  info(messageOrKey: string, params?: Record<string, unknown>): void {
    this.open(this.t.instant(messageOrKey, params), '', 3000);
  }

  /** "Saved ✓  [Undo]": emits once if the user taps the action before it closes. */
  withAction(message: string, actionKey: string, seconds: number): Observable<void> {
    return this.snack
      .open(message, this.t.instant(actionKey), {
        duration: seconds * 1000,
        panelClass: 'ds-toast-success',
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      })
      .onAction();
  }

  /** Shows the server's message for a failed request. */
  apiError(err: unknown): void {
    this.error(apiErrorMessage(err, this.t.instant('common.genericError')));
  }

  private open(message: string, panelClass: string, duration: number): void {
    this.snack.open(message, this.t.instant('common.ok'), {
      duration,
      panelClass: panelClass || undefined,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
}
