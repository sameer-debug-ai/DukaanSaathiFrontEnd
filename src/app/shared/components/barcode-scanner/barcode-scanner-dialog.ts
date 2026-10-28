import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { scanFeedback } from '../../../core/utils/scan-feedback';

export interface BarcodeScannerData {
  /** Translation key for the title (default "Scan barcode"). */
  titleKey?: string;
}

type ScanError = 'denied' | 'noCamera' | 'insecure' | 'failed';

/**
 * Live camera barcode scanner (EAN/UPC/Code128/QR via ZXing, loaded only when opened).
 * Beeps + vibrates and closes with the code on the first read. Typing the code also works,
 * for desktops without a camera or a damaged label.
 */
@Component({
  selector: 'app-barcode-scanner-dialog',
  imports: [FormsModule, MatDialogModule, MatButton, MatIconButton, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <h2 mat-dialog-title>{{ data.titleKey ?? 'scan.title' | translate }}</h2>
      <button mat-icon-button mat-dialog-close [attr.aria-label]="'common.close' | translate"><span class="material-symbols-outlined">close</span></button>
    </div>
    <mat-dialog-content class="body">
      @if (error(); as e) {
        <div class="err" role="alert">
          <span class="material-symbols-outlined" aria-hidden="true">no_photography</span>
          <p>{{ 'scan.error.' + e | translate }}</p>
        </div>
      } @else {
        <div class="viewport">
          <video #video playsinline muted></video>
          <div class="frame" aria-hidden="true"><span class="laser"></span></div>
          @if (starting()) {
            <div class="starting">{{ 'scan.starting' | translate }}</div>
          }
        </div>
        <p class="hint">{{ 'scan.hint' | translate }}</p>
      }
      <form class="manual" (ngSubmit)="submitManual()">
        <input [(ngModel)]="manual" name="code" inputmode="numeric" autocomplete="off" [placeholder]="'scan.typeCode' | translate" [attr.aria-label]="'scan.typeCode' | translate" />
        <button mat-stroked-button type="submit" [disabled]="!manual.trim()">{{ 'common.ok' | translate }}</button>
      </form>
    </mat-dialog-content>
  `,
  styles: `
    .head { display: flex; align-items: center; justify-content: space-between; padding-right: 8px; }
    .body { display: flex; flex-direction: column; gap: 12px; }
    .viewport { position: relative; width: 100%; aspect-ratio: 4 / 3; border-radius: 14px; overflow: hidden; background: #000; }
    video { width: 100%; height: 100%; object-fit: cover; display: block; }
    .frame {
      position: absolute; inset: 22% 10%; border: 2px solid rgba(255, 255, 255, 0.85); border-radius: 12px;
      box-shadow: 0 0 0 999px rgba(0, 0, 0, 0.35);
    }
    .laser { position: absolute; left: 6%; right: 6%; top: 50%; height: 2px; background: #ef4444; box-shadow: 0 0 8px #ef4444; animation: sweep 1.6s ease-in-out infinite; }
    @keyframes sweep { 0%, 100% { top: 15%; } 50% { top: 85%; } }
    @media (prefers-reduced-motion: reduce) { .laser { animation: none; } }
    .starting { position: absolute; inset: 0; display: grid; place-items: center; color: #fff; font-size: 0.9rem; }
    .hint { margin: 0; text-align: center; color: var(--ds-muted); font-size: 0.9rem; }
    .err { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 20px 12px; text-align: center; border-radius: 12px; background: var(--ds-danger-soft); color: var(--ds-danger); }
    .err .material-symbols-outlined { font-size: 36px; }
    .err p { margin: 0; }
    .manual { display: flex; gap: 8px; }
    .manual input {
      flex: 1; min-width: 0; min-height: 44px; padding: 0 12px; border: 1px solid var(--ds-line); border-radius: 10px;
      background: var(--ds-card); color: var(--ds-text); font: inherit;
    }
  `,
})
export class BarcodeScannerDialog implements OnDestroy {
  protected readonly data = inject<BarcodeScannerData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<BarcodeScannerDialog, string>);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');

  protected readonly error = signal<ScanError | null>(null);
  protected readonly starting = signal(true);
  protected manual = '';
  private controls: { stop: () => void } | null = null;
  private done = false;

  constructor() {
    afterNextRender(() => void this.start());
  }

  private async start(): Promise<void> {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.error.set(window.isSecureContext ? 'noCamera' : 'insecure');
      return;
    }
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const el = this.video()?.nativeElement;
      if (!el || this.done) return;
      const reader = new BrowserMultiFormatReader();
      this.controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, el, (result) => {
        if (result) this.finish(result.getText());
      });
      this.starting.set(false);
      // Dialog closed while the camera was starting.
      if (this.done) this.controls.stop();
    } catch (e) {
      const name = (e as { name?: string })?.name;
      this.error.set(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'noCamera' : 'failed');
    }
  }

  private finish(code: string): void {
    const text = code.trim();
    if (this.done || !text) return;
    this.done = true;
    this.controls?.stop();
    scanFeedback();
    this.ref.close(text);
  }

  protected submitManual(): void {
    this.finish(this.manual);
  }

  ngOnDestroy(): void {
    this.done = true;
    this.controls?.stop();
  }
}
