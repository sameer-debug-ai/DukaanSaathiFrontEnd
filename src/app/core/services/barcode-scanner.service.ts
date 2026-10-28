import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import type { Observable } from 'rxjs';
import { BarcodeScannerDialog, type BarcodeScannerData } from '../../shared/components/barcode-scanner/barcode-scanner-dialog';

/** Opens the camera scanner; emits the barcode text, or undefined when closed. */
@Injectable({ providedIn: 'root' })
export class BarcodeScanner {
  private readonly dialog = inject(MatDialog);

  scan(data: BarcodeScannerData = {}): Observable<string | undefined> {
    return this.dialog
      .open<BarcodeScannerDialog, BarcodeScannerData, string>(BarcodeScannerDialog, {
        data,
        width: '480px',
        maxWidth: '96vw',
        autoFocus: false,
        panelClass: 'ds-scan-dialog',
      })
      .afterClosed();
  }
}
