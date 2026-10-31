import { Injectable, inject } from '@angular/core';
import { tap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import type { BillingSettings } from '../models/api.models';
import type { BillParty, DocType, GstLine, LineItem, Sale, TaxRow } from '../models/domain.models';
import { ApiService } from './api.service';

export interface BillingSettingsView extends BillingSettings {
  /** Prefix used when invoicePrefix is empty (initials of the shop name). */
  defaultPrefix: string;
  states: { code: string; name: string }[];
}

export interface SaleQuote {
  docType: DocType;
  items: (LineItem & GstLine)[];
  subtotal: number;
  discount: number;
  totalAmount: number;
  taxableTotal?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  taxTotal?: number;
  taxAdded?: number;
  roundOff?: number;
  taxSummary?: TaxRow[];
  interState?: boolean;
  buyer: BillParty;
}

export interface QuoteInput {
  customerId?: string;
  items: { productId: string; qty: number; rate?: number }[];
  discount: number;
  buyerName?: string;
  buyerGstin?: string;
  buyerStateCode?: string;
}

/** Bill settings, GST preview, cancelling a bill, GST rate by category. */
@Injectable({ providedIn: 'root' })
export class BillingApi {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  settings() {
    return this.api.get<BillingSettingsView>('/billing/settings');
  }

  /** Saves and refreshes the signed-in user's copy, so bills print the new details at once. */
  update(patch: Partial<BillingSettings>) {
    return this.api.patch<BillingSettingsView>('/billing/settings', patch).pipe(
      tap((s) => {
        const { defaultPrefix: _d, states: _s, ...billing } = s;
        this.auth.patchUser({ billing, ...(billing.gstin ? { gstNumber: billing.gstin } : {}) });
      }),
    );
  }

  quote(body: QuoteInput) {
    return this.api.post<SaleQuote>('/sales/quote', body);
  }

  cancel(id: string, reason: string) {
    return this.api.post<Sale>(`/sales/${id}/cancel`, { reason });
  }

  gstByCategory(body: { category: string; gstRate: number; hsnCode?: string; priceIncludesGst?: boolean }) {
    return this.api.post<{ updated: number; matched: number }>('/billing/gst-by-category', body);
  }
}

/** Common GST slabs; any other rate can be typed. */
export const GST_RATES = [0, 5, 12, 18, 28] as const;

/** Format check only (the server also verifies the check character). */
export const GSTIN_RX = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
