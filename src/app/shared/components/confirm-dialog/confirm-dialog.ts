import { ChangeDetectionStrategy, Component, Injectable, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, map } from 'rxjs';

export interface ConfirmData {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButton, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title || ('common.confirmTitle' | translate) }}</h2>
    <mat-dialog-content>
      <p class="m-0">{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">{{ data.cancelText || ('common.cancel' | translate) }}</button>
      <button
        mat-flat-button
        [mat-dialog-close]="true"
        [style.background]="data.danger ? 'var(--ds-danger)' : null"
        cdkFocusInitial
      >
        {{ data.confirmText || ('common.yes' | translate) }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmData>(MAT_DIALOG_DATA);
}

/** `confirm.ask({...}).subscribe(ok => ...)` - resolves false when dismissed. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);

  ask(data: ConfirmData): Observable<boolean> {
    return this.dialog
      .open(ConfirmDialog, { data, width: '400px', maxWidth: '92vw', autoFocus: 'dialog' })
      .afterClosed()
      .pipe(map((r) => r === true));
  }
}
