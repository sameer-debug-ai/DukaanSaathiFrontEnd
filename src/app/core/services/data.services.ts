import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Paged } from '../models/api.models';
import type {
  AiStatus,
  KhataLinkStatus,
  PublicKhata,
  TodayReminders,
  Customer,
  CustomerDetail,
  CustomerLedger,
  DashboardCharts,
  DashboardSummary,
  DataCounts,
  LedgerEntry,
  PaymentMode,
  Product,
  Purchase,
  Report,
  ReportName,
  Sale,
  SalePaymentMode,
  StockAlerts,
  ExpiryAlerts,
  ProductBatch,
  ReorderList,
  RunOutList,
  StockMovement,
  Supplier,
  SupplierHistoryRow,
  SupplierPayment,
  Unit,
  VoiceBatchOutcome,
  VoiceLog,
  VoiceParseResult,
} from '../models/domain.models';
import { ApiService, type QueryParams } from './api.service';

export interface ProductInput {
  name: string;
  nameHindi?: string;
  aliases?: string[];
  category?: string;
  unit: Unit;
  purchasePrice: number;
  sellingPrice: number;
  mrp?: number;
  lowStockThreshold?: number;
  barcode?: string;
  openingStock?: number;
  supplierId?: string;
  trackExpiry?: boolean;
  hsnCode?: string;
  gstRate?: number;
  priceIncludesGst?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private readonly api = inject(ApiService);
  list(params: QueryParams): Observable<Paged<Product>> {
    return this.api.getPaged<Product>('/products', params);
  }
  get(id: string) {
    return this.api.get<Product>(`/products/${id}`);
  }
  create(body: ProductInput & VoiceLink) {
    return this.api.post<Product>('/products', body);
  }
  update(id: string, body: Partial<ProductInput>) {
    return this.api.patch<Product>(`/products/${id}`, body);
  }
  remove(id: string) {
    return this.api.delete(`/products/${id}`);
  }
  categories() {
    return this.api.get<string[]>('/products/categories');
  }
  alerts() {
    return this.api.get<StockAlerts>('/products/alerts');
  }
  exportCsv(params: QueryParams) {
    return this.api.getBlob('/products/export', params);
  }
  import(rows: ProductInput[], updateExisting = true) {
    return this.api.post<{ created: number; updated: number; failed: number; errors: { row: number; message: string }[] }>(
      '/products/import',
      { rows, updateExisting },
    );
  }
  adjustStock(
    body: { productId: string; quantity: number; type: 'adjustment' | 'damage' | 'return' | 'purchase'; note?: string; batchId?: string; expiryDate?: string | null } & VoiceLink,
  ) {
    return this.api.post<Product>('/stock/adjust', body);
  }
  history(productId: string, params: QueryParams) {
    return this.api.getPaged<StockMovement>(`/stock/history/${productId}`, params);
  }
  /** Camera scan lookup; 404 when no product has this barcode. */
  byBarcode(code: string) {
    return this.api.get<Product>(`/products/barcode/${encodeURIComponent(code)}`);
  }
  batches(productId: string) {
    return this.api.get<ProductBatch[]>(`/products/${productId}/batches`);
  }
}

/** Smart stock: run-out forecast, reorder list, expiry alerts. */
@Injectable({ providedIn: 'root' })
export class SmartStockApi {
  private readonly api = inject(ApiService);
  runOut(days = 7) {
    return this.api.get<RunOutList>('/stock/runout', { days });
  }
  reorder(days?: number) {
    return this.api.get<ReorderList>('/stock/reorder', days ? { days } : {});
  }
  expiry(days = 7) {
    return this.api.get<ExpiryAlerts>('/stock/expiry', { days });
  }
}

export interface CustomerInput {
  name: string;
  aliases?: string[];
  phone?: string;
  address?: string;
  creditLimit?: number;
  reminderEveryDays?: 0 | 7 | 15 | 30;
  /** "YYYY-MM-DD"; null clears it. */
  dueDate?: string | null;
  /** B2B (GST shops): GSTIN, and its state code. */
  gstin?: string;
  stateCode?: string;
}

@Injectable({ providedIn: 'root' })
export class CustomersApi {
  private readonly api = inject(ApiService);
  list(params: QueryParams) {
    return this.api.getRaw<Customer[]>('/customers', params);
  }
  get(id: string) {
    return this.api.get<CustomerDetail>(`/customers/${id}`);
  }
  create(body: CustomerInput & VoiceLink) {
    return this.api.post<Customer>('/customers', body);
  }
  update(id: string, body: Partial<CustomerInput>) {
    return this.api.patch<Customer>(`/customers/${id}`, body);
  }
  remove(id: string) {
    return this.api.delete(`/customers/${id}`);
  }
  ledger(id: string, params?: QueryParams) {
    return this.api.get<CustomerLedger>(`/customers/${id}/ledger`, params);
  }
  addCredit(id: string, body: { amount: number; note?: string; items?: { productId?: string; name: string; qty: number; rate: number }[]; date?: string; source?: 'manual' | 'voice'; rawVoiceText?: string } & VoiceLink) {
    return this.api.post<{ entry: LedgerEntry; customer: Customer }>(`/customers/${id}/ledger/credit`, body);
  }
  addPayment(id: string, body: { amount: number; mode: PaymentMode; note?: string; date?: string; source?: 'manual' | 'voice'; rawVoiceText?: string } & VoiceLink) {
    return this.api.post<{ entry: LedgerEntry; customer: Customer }>(`/customers/${id}/ledger/payment`, body);
  }
  /** A payment reminder was sent (WhatsApp); drops them from "Aaj ke reminders". */
  reminderSent(id: string) {
    return this.api.post<Customer>(`/customers/${id}/reminder-sent`);
  }
  shareLink(id: string) {
    return this.api.get<KhataLinkStatus>(`/customers/${id}/share-link`);
  }
  /** New public khata link; the old one stops working. The token comes back only here. */
  createShareLink(id: string) {
    return this.api.post<KhataLinkStatus & { token: string }>(`/customers/${id}/share-link`);
  }
  revokeShareLink(id: string) {
    return this.api.delete<KhataLinkStatus>(`/customers/${id}/share-link`);
  }
}

@Injectable({ providedIn: 'root' })
export class RemindersApi {
  private readonly api = inject(ApiService);
  today() {
    return this.api.get<TodayReminders>('/reminders/today');
  }
}

/** No login: the customer's own khata page. */
@Injectable({ providedIn: 'root' })
export class PublicKhataApi {
  private readonly api = inject(ApiService);
  get(token: string) {
    return this.api.get<PublicKhata>(`/public/khata/${encodeURIComponent(token)}`);
  }
}

export interface SupplierInput {
  name: string;
  phone?: string;
  company?: string;
  address?: string;
  gstNumber?: string;
  aliases?: string[];
}

export interface PurchaseInput {
  supplierId: string;
  items: { productId?: string; newProduct?: { name: string; unit: Unit; category?: string; sellingPrice?: number }; qty: number; rate: number; expiryDate?: string }[];
  paidAmount: number;
  paymentMode?: PaymentMode;
  invoiceNumber?: string;
  date?: string;
  note?: string;
  updatePurchasePrice?: boolean;
  source?: 'manual' | 'voice';
}

@Injectable({ providedIn: 'root' })
export class SuppliersApi {
  private readonly api = inject(ApiService);
  list(params: QueryParams) {
    return this.api.getRaw<Supplier[]>('/suppliers', params);
  }
  get(id: string) {
    return this.api.get<Supplier>(`/suppliers/${id}`);
  }
  create(body: SupplierInput) {
    return this.api.post<Supplier>('/suppliers', body);
  }
  update(id: string, body: Partial<SupplierInput>) {
    return this.api.patch<Supplier>(`/suppliers/${id}`, body);
  }
  remove(id: string) {
    return this.api.delete(`/suppliers/${id}`);
  }
  history(id: string) {
    return this.api.get<{ supplier: Supplier; history: SupplierHistoryRow[] }>(`/suppliers/${id}/history`);
  }
  purchases(params: QueryParams) {
    return this.api.getPaged<Purchase>('/purchases', params);
  }
  purchase(id: string) {
    return this.api.get<Purchase>(`/purchases/${id}`);
  }
  createPurchase(body: PurchaseInput & VoiceLink) {
    return this.api.post<Purchase>('/purchases', body);
  }
  payments(params: QueryParams) {
    return this.api.getPaged<SupplierPayment>('/supplier-payments', params);
  }
  pay(body: { supplierId: string; amount: number; mode: PaymentMode; note?: string; date?: string; source?: 'manual' | 'voice' } & VoiceLink) {
    return this.api.post<{ payment: SupplierPayment; supplier: Supplier }>('/supplier-payments', body);
  }
}

export interface SaleInput {
  customerId?: string;
  items: { productId: string; qty: number; rate?: number }[];
  discount: number;
  paymentMode: SalePaymentMode;
  paidAmount?: number;
  note?: string;
  allowOversell?: boolean;
  date?: string;
  source?: 'manual' | 'voice';
  /** GST shops, B2B: buyer typed on the bill. */
  buyerName?: string;
  buyerGstin?: string;
}

@Injectable({ providedIn: 'root' })
export class SalesApi {
  private readonly api = inject(ApiService);
  list(params: QueryParams) {
    return this.api.getRaw<Sale[]>('/sales', params);
  }
  get(id: string) {
    return this.api.get<Sale>(`/sales/${id}`);
  }
  create(body: SaleInput & VoiceLink) {
    return this.api.post<Sale & { warnings?: unknown[] }>('/sales', body);
  }
}

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly api = inject(ApiService);
  summary() {
    return this.api.get<DashboardSummary>('/dashboard/summary');
  }
  charts(days: number) {
    return this.api.get<DashboardCharts>('/dashboard/charts', { days });
  }
}

@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private readonly api = inject(ApiService);
  get(name: ReportName, from?: string, to?: string) {
    return this.api.get<Report>(`/reports/${name}`, { from, to });
  }
  csv(name: ReportName, from?: string, to?: string) {
    return this.api.getBlob(`/reports/${name}`, { from, to, format: 'csv' });
  }
}

/** One reviewed action of a multi-action voice command, as sent to /ai/execute-batch. */
export interface VoiceBatchAction {
  intent: VoiceParseResult['intent'];
  customerId?: string;
  newCustomerName?: string;
  supplierId?: string;
  productId?: string;
  productName?: string;
  amount: number | null;
  paidAmount: number | null;
  quantity: number | null;
  unit: string | null;
  sellingPrice: number | null;
  paymentMode: 'cash' | 'upi' | 'udhaar' | 'bank' | null;
  date?: string;
  items: { productId?: string; name: string; qty: number; unit: string | null; rate: number | null }[];
}

export interface AliasLearning {
  kind: 'customer' | 'product' | 'supplier';
  id: string;
  alias: string;
}

/** Sent with an entry the voice assistant saves, so it can be undone. */
export interface VoiceLink {
  voiceLogId?: string;
}

@Injectable({ providedIn: 'root' })
export class VoiceApi {
  private readonly api = inject(ApiService);
  parse(text: string, lang: 'hi' | 'en') {
    return this.api.post<VoiceParseResult>('/ai/parse-command', { text, lang });
  }
  status() {
    return this.api.get<AiStatus>('/ai/status');
  }
  /** High-accuracy speech-to-text: the recording goes up as raw audio, the text comes back. */
  transcribe(audio: Blob, lang: 'hi' | 'en') {
    return this.api.post<{ text: string; provider: string }>(`/ai/transcribe?lang=${lang}`, audio);
  }
  logs(params: QueryParams) {
    return this.api.getPaged<VoiceLog>('/voice-logs', params);
  }
  updateLog(id: string, body: { status: 'confirmed' | 'cancelled' | 'failed'; resultMessage?: string; error?: string }) {
    return this.api.patch<VoiceLog>(`/voice-logs/${id}`, body);
  }
  /** Reverse everything a saved voice command did (within the undo window). */
  undo(logId: string) {
    return this.api.post<VoiceLog>(`/ai/undo/${logId}`, {});
  }
  undoLast() {
    return this.api.post<VoiceLog>('/ai/undo-last', {});
  }
  /** Save every action of a multi-action command together, in one transaction (Undo reverses all). */
  executeBatch(body: { logId: string; text: string; note: string; actions: VoiceBatchAction[] }) {
    return this.api.post<VoiceBatchOutcome[]>('/ai/execute-batch', body);
  }
  /** Remember spoken names for records the user picked, so they match directly next time. */
  learnAliases(items: AliasLearning[]) {
    return this.api.post<(AliasLearning & { added: boolean; reason?: string })[]>('/ai/learn-aliases', { items });
  }
}

@Injectable({ providedIn: 'root' })
export class SettingsApi {
  private readonly api = inject(ApiService);
  counts() {
    return this.api.get<DataCounts>('/settings/data-counts');
  }
  loadSample() {
    return this.api.post<Record<string, number>>('/settings/sample-data');
  }
  backup() {
    return this.api.getBlob('/settings/backup');
  }
}
