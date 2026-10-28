/** Client-side shapes of API resources. All money fields are integer paise. */

export const UNITS = ['kg', 'g', 'litre', 'ml', 'piece', 'packet', 'dozen', 'box'] as const;
export type Unit = (typeof UNITS)[number];
export type StockStatus = 'in' | 'low' | 'out';

export interface Product {
  id: string;
  name: string;
  nameHindi: string;
  aliases: string[];
  category: string;
  unit: Unit;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  currentStock: number;
  lowStockThreshold: number;
  barcode?: string;
  imageUrl?: string;
  supplierId?: string;
  isActive: boolean;
  stockStatus: StockStatus;
  createdAt: string;
  updatedAt: string;
  /** "Expiry track karo": stock kept in batches with expiry dates (FEFO). */
  trackExpiry?: boolean;
  /** Selling-rate forecast (list / detail / barcode lookups). */
  forecast?: StockForecast;
}

export interface StockForecast {
  /** Units sold per day, weighted towards recent days. */
  dailyRate: number;
  /** Whole days the stock will last; null when it is not selling. */
  daysLeft: number | null;
}

export interface ProductBatch {
  id: string;
  qty: number;
  initialQty: number;
  expiryDate: string | null;
  purchaseId: string | null;
  note: string;
  createdAt: string;
}

export interface RunOutItem {
  id: string;
  name: string;
  nameHindi: string;
  unit: Unit;
  currentStock: number;
  dailyRate: number;
  daysLeft: number;
}
export interface RunOutList {
  maxDays: number;
  within3: number;
  within7: number;
  items: RunOutItem[];
}

export interface ReorderItem {
  productId: string;
  name: string;
  nameHindi: string;
  unit: Unit;
  currentStock: number;
  dailyRate: number;
  daysLeft: number | null;
  qty: number;
  /** Last purchase price, paise per unit. */
  rate: number;
  reason: 'forecast' | 'low_stock';
}
export interface ReorderGroup {
  supplier: { id: string; name: string; phone: string } | null;
  items: ReorderItem[];
  total: number;
}
export interface ReorderList {
  days: number;
  groups: ReorderGroup[];
}

export interface ExpiryItem {
  batchId: string;
  productId: string;
  name: string;
  unit: Unit;
  qty: number;
  expiryDate: string;
  /** Negative when already expired. */
  daysLeft: number;
}
export interface ExpiryAlerts {
  days: number;
  expired: ExpiryItem[];
  expiringSoon: ExpiryItem[];
}

/** 'reversal' = a voice entry was undone and its stock put back. */
export type MovementType = 'purchase' | 'sale' | 'adjustment' | 'return' | 'damage' | 'reversal';

export interface StockMovement {
  id: string;
  productId: string;
  type: MovementType;
  quantity: number;
  balanceAfter: number;
  referenceType: 'sale' | 'purchase' | 'manual' | null;
  referenceId?: string;
  note: string;
  createdAt: string;
}

export interface StockAlerts {
  lowCount: number;
  outCount: number;
  total: number;
  items: Product[];
}

export interface Customer {
  id: string;
  name: string;
  aliases: string[];
  phone: string;
  address: string;
  creditLimit?: number;
  currentBalance: number;
  lastTransactionAt?: string;
  createdAt: string;
  /** Reminder every N days (0 = off). */
  reminderEveryDays?: 0 | 7 | 15 | 30;
  /** Promised payment day (ISO). */
  dueDate?: string | null;
  lastReminderAt?: string | null;
  /** Credit score from the payment history (list and detail). */
  credit?: CreditScore;
}

export type CreditBadge = 'good' | 'average' | 'risky' | 'new';

export interface CreditScore {
  /** 0-100; null for a new customer. */
  score: number | null;
  badge: CreditBadge;
  recoveredPct: number;
  avgDaysToPay: number | null;
  oldestDueDays: number | null;
}

/** New udhaar would cross the credit limit, or the customer is "Risky". */
export interface CreditWarning {
  customerId: string;
  overLimit: boolean;
  limit: number | null;
  balance: number;
  newBalance: number;
  badge: CreditBadge;
  score: number | null;
}

export interface ReminderItem {
  customerId: string;
  name: string;
  phone: string;
  balance: number;
  reason: 'due_date' | 'every';
  dueDate: string | null;
  lastReminderAt: string | null;
  upiLink: string | null;
}

export interface TodayReminders {
  day: string;
  items: ReminderItem[];
  sentToday: number;
}

export interface KhataLinkStatus {
  active: boolean;
  createdAt: string | null;
  lastViewedAt: string | null;
  views: number;
  /** Only right after creating: the link token (stored hashed on the server). */
  token?: string;
}

/** What the customer sees on their public khata page. */
export interface PublicKhata {
  shop: { name: string; phone: string; address: string };
  customer: { name: string };
  balance: number;
  entries: { date: string; type: 'credit' | 'payment'; amount: number; note: string; items: { name: string; qty: number }[]; balance: number }[];
  truncated: boolean;
  upiLink: string | null;
  upiId: string | null;
  generatedAt: string;
}

export interface CustomerDetail extends Customer {
  stats: { totalCredit: number; totalPaid: number; entries: number };
}

export interface LedgerItem {
  productId?: string;
  name: string;
  qty: number;
  rate: number;
}

export interface LedgerEntry {
  id: string;
  customerId: string;
  type: 'credit' | 'payment';
  amount: number;
  items: LedgerItem[];
  note: string;
  source: 'manual' | 'voice' | 'sale';
  saleId?: string;
  mode?: 'cash' | 'upi' | 'bank' | null;
  date: string;
  credit: number;
  payment: number;
  balance: number;
}

export interface CustomerLedger {
  customer: Customer;
  openingBalance: number;
  closingBalance: number;
  entries: LedgerEntry[];
}

export interface Supplier {
  id: string;
  name: string;
  aliases: string[];
  phone: string;
  company: string;
  address: string;
  gstNumber: string;
  currentPayable: number;
  lastTransactionAt?: string;
  totalPurchased: number;
  totalPaid: number;
  purchaseCount: number;
  createdAt: string;
}

export interface LineItem {
  productId: string;
  name: string;
  unit: string;
  qty: number;
  rate: number;
  total: number;
  costRate?: number;
}

export interface Purchase {
  id: string;
  supplierId: string;
  supplier?: { id: string; name: string; company?: string; phone?: string } | null;
  items: LineItem[];
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  invoiceNumber: string;
  date: string;
  note: string;
}

export type PaymentMode = 'cash' | 'upi' | 'bank';

export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplier?: { id: string; name: string; company?: string } | null;
  amount: number;
  mode: PaymentMode;
  date: string;
  note: string;
}

export interface SupplierHistoryRow {
  kind: 'purchase' | 'payment';
  id: string;
  date: string;
  amount: number;
  paid: number;
  due: number;
  balance: number;
  description: string;
  ref: Purchase | SupplierPayment;
}

export type SalePaymentMode = 'cash' | 'upi' | 'udhaar' | 'partial';

export interface Sale {
  id: string;
  billNumber: number;
  customerId?: string;
  customer?: { id: string; name: string; phone?: string; address?: string; currentBalance?: number } | null;
  customerName: string;
  items: LineItem[];
  subtotal: number;
  discount: number;
  totalAmount: number;
  paymentMode: SalePaymentMode;
  paidAmount: number;
  creditAmount: number;
  date: string;
  note: string;
  source: 'manual' | 'voice';
}

export interface RecentTxn {
  kind: 'sale' | 'udhaar' | 'payment' | 'purchase' | 'supplier_payment';
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  date: string;
  link: string;
}

export interface DashboardSummary {
  today: { sales: number; salesCount: number; udhaarGiven: number; paymentsReceived: number };
  totalOutstanding: number;
  customersWithDue: number;
  totalPayable: number;
  lowStockCount: number;
  outOfStockCount: number;
  lowStockProducts: Product[];
  topDebtors: Customer[];
  recentTransactions: RecentTxn[];
}

export interface DashboardCharts {
  days: number;
  sales: { day: string; total: number; count: number }[];
  topProducts: { productId: string; name: string; unit: string; qty: number; total: number }[];
  udhaar: { day: string; given: number; recovered: number }[];
}

export type ReportName = 'sales' | 'profit' | 'udhaar' | 'supplier-purchases' | 'stock-valuation' | 'product-sales' | 'aging';

export interface Report {
  title: string;
  from?: string;
  to?: string;
  columns: { key: string; label: string; type: 'text' | 'money' | 'number' | 'date' }[];
  rows: Record<string, unknown>[];
  totals: Record<string, number>;
  chart?: { labels: string[]; series: { label: string; data: number[] }[] };
}

export interface DataCounts {
  products: number;
  customers: number;
  suppliers: number;
  sales: number;
  purchases: number;
  isEmpty: boolean;
}

// ---------- Voice ----------
export type Intent =
  | 'add_credit'
  | 'receive_payment'
  | 'add_purchase'
  | 'supplier_payment'
  | 'add_sale'
  | 'adjust_stock'
  | 'add_product'
  | 'query_balance'
  | 'query_stock'
  | 'query_summary'
  | 'query_analytics'
  | 'undo_last'
  | 'reset_context'
  | 'unknown';

export interface Candidate {
  id: string;
  name: string;
  subtitle?: string;
  score: number;
}

export interface EntityMatch {
  query: string;
  status: 'matched' | 'ambiguous' | 'not_found';
  best: Candidate | null;
  candidates: Candidate[];
}

export interface VoiceItem {
  spokenName: string;
  qty: number;
  unit: string | null;
  rate: number | null;
  total: number | null;
  match: EntityMatch;
}

export interface VoiceParseResult {
  logId: string;
  text: string;
  engine: 'ai' | 'rules';
  engineNote?: string;
  /** rule = local fast parser (no AI call), ai = the AI, offline = offline parser. */
  parsePath?: 'rule' | 'ai' | 'offline';
  intent: Intent;
  confidence: number;
  parsed: {
    customerName: string | null;
    supplierName: string | null;
    productName: string | null;
    sellingPrice: number | null;
    unit: Unit | null;
    note: string | null;
  };
  customer?: EntityMatch;
  supplier?: EntityMatch;
  product?: EntityMatch;
  items: VoiceItem[];
  amount: number | null;
  paidAmount: number | null;
  quantity: number | null;
  paymentMode: 'cash' | 'upi' | 'udhaar' | 'bank' | null;
  date: string | null;
  /** Language the command was spoken in; answers, spoken replies and success messages use it. */
  replyLang: 'hi' | 'en';
  /** "Sara udhaar de diya": the amount is the picked party's whole balance. */
  settleFull: boolean;
  /** Customer not in the khata yet: suggested name (Roman letters) for a new entry. */
  newCustomerName?: string;
  /** Pending balance (paise) per candidate customer/supplier id. */
  balances?: Record<string, number>;
  answer?: string;
  answerData?: VoiceAnswerData;
  needsConfirmation: boolean;
  missing: string[];
  /** 0-1: parser confidence x the weakest name match. */
  autoSaveConfidence?: number;
  /** Clear enough (and the shop allows it): save without the confirmation card. */
  autoSave?: boolean;
  /** Several entries in one sentence: each one resolved (top-level fields repeat the first). Saved together. */
  actions?: VoiceParseResult[];
  /** Udhaar over the credit limit / for a "Risky" customer: shown on the card, never auto-saved. */
  creditWarning?: CreditWarning;
}

/** What one action of a multi-action voice command saved (POST /ai/execute-batch). */
export interface VoiceBatchOutcome {
  intent: Intent;
  name: string;
  amount: number;
  /** Customer's udhaar / supplier's due after this entry (paise). */
  balance?: number;
  billNumber?: number;
  stock?: number;
  unit?: string;
}

export interface VoiceStockRow {
  id: string;
  name: string;
  stock: number;
  unit: string;
  status: StockStatus;
  lowStockThreshold: number;
}

/** In stock, but the selling rate says it runs out within a week. */
export interface VoiceRunOutRow {
  id: string;
  name: string;
  stock: number;
  unit: string;
  daysLeft: number;
}

/** Structured answer to a voice question, shown as a list/card instead of a sentence. */
export type VoiceAnswerData =
  | { kind: 'stock_list'; onlyOut: boolean; outCount: number; lowCount: number; items: VoiceStockRow[]; soon?: VoiceRunOutRow[] }
  | { kind: 'stock_item'; productId: string; name: string; stock: number; unit: string; status: StockStatus; lowStockThreshold: number }
  | { kind: 'balance'; customerId: string; name: string; balance: number }
  | { kind: 'summary'; period: string; from: string; to: string; sales: number; bills: number; udhaarGiven: number; paymentsReceived: number }
  | { kind: 'choose'; choose: Candidate[] }
  | { kind: 'undo'; logId: string | null; text: string }
  | VoiceAnalyticsData;

export type VoiceAnalyticsFn = 'top_products' | 'inactive_debtors' | 'compare_sales' | 'profit' | 'top_debtors';
export type VoiceAnalyticsPeriod = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month';

/** Answer to a voice analytics question ("Is mahine sabse zyada kya bika?"): a small table, maybe a chart. Money in paise. */
export interface VoiceAnalyticsData {
  kind: 'analytics';
  fn: VoiceAnalyticsFn;
  period?: VoiceAnalyticsPeriod;
  from?: string;
  to?: string;
  days?: number;
  columns: { key: string; type: 'text' | 'money' | 'number' | 'date' }[];
  rows: Record<string, unknown>[];
  totals?: Record<string, number>;
  chart?: { labels: string[]; data: number[]; money: boolean };
}

export interface AiStatus {
  provider: string;
  available: boolean;
  /** High-accuracy speech-to-text on the server. */
  stt?: { provider: string; available: boolean };
}

export interface VoiceLog {
  id: string;
  rawText: string;
  intent: Intent;
  status: 'pending' | 'confirmed' | 'cancelled' | 'failed' | 'undone';
  engine: string;
  resultMessage: string;
  error?: string;
  createdAt: string;
}
