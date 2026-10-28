import { Injectable, signal } from '@angular/core';

/** An order from the reorder list, handed to the purchase form when the goods arrive. */
export interface OrderDraft {
  supplierId: string | null;
  items: { productId: string; qty: number; rate: number }[];
}

/** One-shot hand-off (like BillScanDrafts): the purchase form takes it on ?order=1. */
@Injectable({ providedIn: 'root' })
export class OrderDrafts {
  private readonly draft = signal<OrderDraft | null>(null);
  set(d: OrderDraft): void {
    this.draft.set(d);
  }
  take(): OrderDraft | null {
    const d = this.draft();
    this.draft.set(null);
    return d;
  }
}
