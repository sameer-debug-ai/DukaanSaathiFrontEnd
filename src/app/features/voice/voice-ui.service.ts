import { BreakpointObserver } from '@angular/cdk/layout';
import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { VoicePanel } from './voice-panel';

/** Opens the voice assistant (bottom sheet on phones, dialog on desktop). */
@Injectable({ providedIn: 'root' })
export class VoiceUi {
  private readonly dialog = inject(MatDialog);
  private readonly bp = inject(BreakpointObserver);
  private ref: MatDialogRef<VoicePanel> | null = null;

  open(text?: string): void {
    if (this.ref) return;
    const phone = this.bp.isMatched('(max-width: 599.98px)');
    this.ref = this.dialog.open(VoicePanel, {
      data: text ? { text } : null,
      width: phone ? '100vw' : '560px',
      maxWidth: phone ? '100vw' : '96vw',
      panelClass: phone ? ['ds-dialog-mobile', 'ds-voice-dialog'] : ['ds-voice-dialog'],
      position: phone ? { bottom: '0' } : undefined,
      autoFocus: false,
    });
    this.ref.afterClosed().subscribe(() => (this.ref = null));
  }
}
