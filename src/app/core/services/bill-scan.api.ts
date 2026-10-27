import { Injectable, inject, signal } from '@angular/core';
import type { EntityMatch, Unit } from '../models/domain.models';
import { ApiService } from './api.service';

export type ScanItemStatus = 'matched' | 'check' | 'new' | 'unreadable';

export interface BillScanItem {
  /** As printed on the bill. */
  name: string;
  qty: number | null;
  unit: Unit | null;
  /** Paise per unit. */
  rate: number | null;
  /** Paise. */
  total: number | null;
  legible: boolean;
  status: ScanItemStatus;
  match: EntityMatch;
}

/** What /ai/scan-bill read from a bill photo, matched to the shop's suppliers and products. */
export interface BillScanResult {
  /** Stored photo id (null when the photo could not be read and was not kept). */
  scanId: string | null;
  readable: boolean;
  problem: string | null;
  supplier: { name: string; match: EntityMatch } | null;
  invoiceNumber: string | null;
  date: string | null;
  items: BillScanItem[];
  /** Printed bill total, paise. */
  billTotal: number | null;
  /** Sum of the item lines, paise. */
  itemsTotal: number;
  mismatch: boolean;
  engine: string;
}

/** A scan plus a local preview of the photo (an object URL of the uploaded image). */
export interface BillScanDraft {
  result: BillScanResult;
  previewUrl: string;
}

@Injectable({ providedIn: 'root' })
export class BillScanApi {
  private readonly api = inject(ApiService);

  /** Sends the (already compressed) photo; the Content-Type comes from the blob. */
  scan(photo: Blob) {
    return this.api.post<BillScanResult>('/ai/scan-bill', photo);
  }
  image(id: string) {
    return this.api.getBlob(`/bill-images/${id}`);
  }
  purchaseImage(purchaseId: string) {
    return this.api.getBlob(`/purchases/${purchaseId}/bill-image`);
  }
  /** Keep the photo with the purchase saved from it. */
  attach(id: string, purchaseId: string) {
    return this.api.post<{ id: string; purchaseId: string }>(`/bill-images/${id}/attach`, { purchaseId });
  }
}

/** Hands a scan from the voice panel to the New Purchase page (read once). */
@Injectable({ providedIn: 'root' })
export class BillScanDrafts {
  private readonly draft = signal<BillScanDraft | null>(null);
  set(d: BillScanDraft): void {
    this.draft.set(d);
  }
  take(): BillScanDraft | null {
    const d = this.draft();
    this.draft.set(null);
    return d;
  }
}
