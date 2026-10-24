import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Paged } from '../models/api.models';
import type {
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
  StockMovement,
  Supplier,
  SupplierHistoryRow,
  SupplierPayment,
  Unit,
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
  create(body: ProductInput) {
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
  adjustStock(body: { productId: string; quantity: number; type: 'adjustment' | 'damage' | 'return' | 'purchase'; note?: string }) {
    return this.api.post<Product>('/stock/adjust', body);
  }
  history(productId: string, params: QueryParams) {
    return this.api.getPaged<StockMovement>(`/stock/history/${productId}`, params);
  }
}

export interface CustomerInput {
  name: string;
  aliases?: string[];
  phone?: string;
  address?: string;
  creditLimit?: number;
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
  create(body: CustomerInput) {
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
  addCredit(id: string, body: { amount: number; note?: string; items?: { productId?: string; name: string; qty: number; rate: number }[]; date?: string; source?: 'manual' | 'voice'; rawVoiceText?: string }) {
    return this.api.post<{ entry: LedgerEntry; customer: Customer }>(`/customers/${id}/ledger/credit`, body);
  }
  addPayment(id: string, body: { amount: number; mode: PaymentMode; note?: string; date?: string; source?: 'manual' | 'voice'; rawVoiceText?: string }) {
    return this.api.post<{ entry: LedgerEntry; customer: Customer }>(`/customers/${id}/ledger/payment`, body);
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
  items: { productId?: string; newProduct?: { name: string; unit: Unit; category?: string; sellingPrice?: number }; qty: number; rate: number }[];
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
  createPurchase(body: PurchaseInput) {
    return this.api.post<Purchase>('/purchases', body);
  }
  payments(params: QueryParams) {
    return this.api.getPaged<SupplierPayment>('/supplier-payments', params);
  }
  pay(body: { supplierId: string; amount: number; mode: PaymentMode; note?: string; date?: string; source?: 'manual' | 'voice' }) {
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
  create(body: SaleInput) {
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

@Injectable({ providedIn: 'root' })
export class VoiceApi {
  private readonly api = inject(ApiService);
  parse(text: string, lang: 'hi' | 'en') {
    return this.api.post<VoiceParseResult>('/ai/parse-command', { text, lang });
  }
  status() {
    return this.api.get<{ provider: string; available: boolean }>('/ai/status');
  }
  logs(params: QueryParams) {
    return this.api.getPaged<VoiceLog>('/voice-logs', params);
  }
  updateLog(id: string, body: { status: 'confirmed' | 'cancelled' | 'failed'; resultMessage?: string; error?: string }) {
    return this.api.patch<VoiceLog>(`/voice-logs/${id}`, body);
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
