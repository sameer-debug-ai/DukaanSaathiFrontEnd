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
  createdAt: string;
  updatedAt: string;
}

export interface AuthPayload {
  user: User;
  accessToken: string;
}
