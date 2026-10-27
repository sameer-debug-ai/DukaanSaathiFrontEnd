import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from '../../core/services/api.service';
import { BillScanApi, type BillScanDraft } from '../../core/services/bill-scan.api';
import { compressImage } from '../../core/utils/image-compress';

/**
 * "Bill ki photo lo": opens the camera on phones (file picker on desktop), shrinks the photo,
 * reads it on the server and emits the draft. Blurry / unreadable photos are handled here with a
 * friendly message and a retake button; only readable scans are emitted.
 */
@Component({
  selector: 'app-bill-scan-button',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input #file type="file" accept="image/*" capture="environment" hidden (change)="picked($event)" />
    <button type="button" class="scan-btn" [class.compact]="compact()" [disabled]="busy()" (click)="file.click()">
      <span class="icon"><span class="material-symbols-outlined" aria-hidden="true">{{ busy() ? 'progress_activity' : 'document_scanner' }}</span></span>
      <span class="text">
        <strong>{{ (busy() ? 'billScan.reading' : 'billScan.button') | translate }}</strong>
        @if (!compact()) {
          <small>{{ (busy() ? 'billScan.readingHint' : 'billScan.buttonHint') | translate }}</small>
        }
      </span>
    </button>
    @if (error(); as e) {
      <div class="scan-error" role="alert">
        <span class="material-symbols-outlined" aria-hidden="true">{{ e.blurry ? 'blur_on' : 'error' }}</span>
        <div>
          <p>{{ e.message | translate }}</p>
          <button type="button" class="retake" (click)="file.click()">{{ 'billScan.retake' | translate }}</button>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .scan-btn {
      display: flex; align-items: center; gap: 14px; width: 100%; padding: 14px 16px;
      border: 1.5px dashed var(--ds-brand); border-radius: 16px; background: var(--ds-brand-soft); color: var(--ds-brand);
      font: inherit; text-align: left; cursor: pointer; transition: filter 0.15s;
    }
    .scan-btn:hover { filter: brightness(0.97); }
    .scan-btn:disabled { cursor: progress; opacity: 0.85; }
    .scan-btn.compact { padding: 10px 14px; border-radius: 999px; width: auto; }
    .icon { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; border-radius: 12px; background: var(--ds-brand); color: #fff; }
    .compact .icon { width: 32px; height: 32px; border-radius: 50%; }
    .compact .icon .material-symbols-outlined { font-size: 18px; }
    .text { display: flex; flex-direction: column; gap: 2px; }
    .text strong { font-size: 1rem; }
    .text small { color: var(--ds-muted); font-size: 0.85rem; }
    :host-context(.dark) .text small { color: var(--ds-muted); }
    .scan-btn:disabled .icon .material-symbols-outlined { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .scan-error {
      display: flex; gap: 10px; align-items: flex-start; margin-top: 10px; padding: 12px 14px;
      border-radius: 12px; background: var(--ds-warn-soft); color: var(--ds-warn);
    }
    .scan-error p { margin: 0 0 6px; font-weight: 600; }
    .retake { border: 0; background: none; padding: 0; color: var(--ds-brand); font: inherit; font-weight: 600; cursor: pointer; text-decoration: underline; }
  `,
})
export class BillScanButton {
  readonly compact = input(false);
  readonly scanned = output<BillScanDraft>();

  private readonly api = inject(BillScanApi);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('file');
  protected readonly busy = signal(false);
  protected readonly error = signal<{ message: string; blurry: boolean } | null>(null);

  protected async picked(ev: Event): Promise<void> {
    const file = (ev.target as HTMLInputElement).files?.[0];
    this.fileInput().nativeElement.value = ''; // the same photo can be picked again
    if (!file) return;
    this.error.set(null);
    this.busy.set(true);
    let photo: Blob;
    try {
      photo = await compressImage(file);
    } catch {
      this.busy.set(false);
      this.error.set({ message: 'billScan.notImage', blurry: false });
      return;
    }
    this.api.scan(photo).subscribe({
      next: (result) => {
        this.busy.set(false);
        if (!result.readable || !result.scanId) {
          this.error.set({ message: 'billScan.unreadable', blurry: true });
          return;
        }
        this.scanned.emit({ result, previewUrl: URL.createObjectURL(photo) });
      },
      error: (e: unknown) => {
        this.busy.set(false);
        const status = (e as HttpErrorResponse)?.status;
        const key =
          status === 413 ? 'billScan.tooBig' : status === 429 ? 'billScan.tooMany' : status === 503 ? 'billScan.noAi' : status === 415 ? 'billScan.notImage' : status === 502 ? 'billScan.failed' : '';
        this.error.set({ message: key || apiErrorMessage(e), blurry: false });
      },
    });
  }
}
