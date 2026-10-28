import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, finalize, map, tap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/services/api.service';
import { AppEvents, StockAlertsService } from '../../core/services/app-events.service';
import { VoiceApi } from '../../core/services/data.services';
import { ToastService } from '../../core/services/toast.service';

/** How long the "Saved ✓ [Undo]" toast stays on screen. */
const TOAST_SECONDS = 5;

/**
 * Undo for entries saved by voice. Lives at the root so the "Undo" in the snackbar still
 * works after the voice panel is closed.
 */
@Injectable({ providedIn: 'root' })
export class VoiceUndo {
  private readonly api = inject(VoiceApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslateService);
  private readonly events = inject(AppEvents);
  private readonly alerts = inject(StockAlertsService);

  /** Log id currently being undone (disables the buttons). */
  readonly busy = signal<string | null>(null);

  /** Seconds a saved voice entry stays undoable (shop setting, default 60). */
  windowSeconds(): number {
    return this.auth.user()?.settings.voiceUndoSeconds ?? 60;
  }

  /** "Saved ✓ [Undo]" after a voice save; tapping Undo reverses it. */
  offer(logId: string, message: string): void {
    // The toast only lingers briefly; Undo stays available in the panel and Voice History for the full window.
    this.toast.withAction(`✓ ${message}`, 'voice.undo', Math.min(TOAST_SECONDS, this.windowSeconds())).subscribe(() => this.undo(logId).subscribe({ error: () => undefined }));
  }

  /** Reverses the entry; resolves to a message for the panel. Errors are toasted. */
  undo(logId: string): Observable<string> {
    this.busy.set(logId);
    return this.api.undo(logId).pipe(
      map((log) => this.t.instant('voice.undoneMsg', { text: log.rawText }) as string),
      tap({
        next: (msg) => {
          this.toast.success(msg);
          this.alerts.refresh();
          this.events.changed('any');
        },
        error: (e) => this.toast.error(apiErrorMessage(e)),
      }),
      finalize(() => this.busy.set(null)),
    );
  }
}
