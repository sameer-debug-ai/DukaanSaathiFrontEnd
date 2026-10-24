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
