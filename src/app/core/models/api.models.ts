/** Shape every API response follows: { success, data, message, meta }. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  meta?: PageMeta & Record<string, unknown>;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}

export type Language = 'hi' | 'en';

export type PaperSize = '58mm' | '80mm' | 'a4';

/** What goes on a printed bill; empty name/address/phone fall back to the profile. */
export interface BillingSettings {
  shopName: string;
  address: string;
  phone: string;
  /** data: URL */
  logo: string;
  footerNote: string;
  paperSize: PaperSize;
  showUpiQr: boolean;
  invoicePrefix: string;
  gstEnabled: boolean;
  gstin: string;
  stateCode: string;
  composition: boolean;
}

export interface ShopSettings {
  lowStockDefault: number;
  allowOversell: boolean;
  darkMode: boolean;
  /** "Hamesha save se pehle poochho": always show the voice confirmation card. */
  voiceAlwaysConfirm?: boolean;
  /** Auto-save voice commands at or above this confidence (0-1). */
  voiceAutoSaveThreshold?: number;
  /** Seconds a saved voice entry can be undone. */
  voiceUndoSeconds?: number;
  /** Shop's UPI ID (VPA) for "Pay via UPI" links and QR codes. */
  upiId?: string;
  /** Name shown in the customer's UPI app (defaults to the shop name). */
  upiPayeeName?: string;
  /** Auto reorder list: order enough for this many days. */
  reorderDays?: number;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  shopName: string;
  shopAddress: string;
  gstNumber?: string;
  preferredLanguage: Language;
  settings: ShopSettings;
  /** Bill printing + GST (Settings -> Bill & GST). */
  billing?: BillingSettings;
  createdAt: string;
  updatedAt: string;
}

export interface AuthPayload {
  user: User;
  accessToken: string;
}
