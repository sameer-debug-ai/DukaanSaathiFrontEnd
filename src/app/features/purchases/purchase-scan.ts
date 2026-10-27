import type { Candidate, Product, Unit } from '../../core/models/domain.models';
import type { AliasLearning } from '../../core/services/data.services';
import type { BillScanResult, ScanItemStatus } from '../../core/services/bill-scan.api';
import { toRupees } from '../../core/utils/format';

/** The purchase-form row fields a scanned bill line fills in (rupees, like the form). */
export interface ScannedRow {
  query: string;
  product: Product | null;
  isNew: boolean;
  newUnit: Unit;
  newSellingPrice: number | null;
  qty: number | null;
  rate: number | null;
  /** Name as printed on the bill (kept to learn it as an alias when the user links a product). */
  scanName: string;
  scanStatus: ScanItemStatus;
  /** Close look-alikes to pick from ("check"). */
  candidates: Candidate[];
}

/**
 * Bill lines -> purchase-form rows. Matched lines get their product, unknown names become
 * "new product" rows, look-alikes and unreadable lines are left for the user to resolve.
 */
export function scanToRows(scan: BillScanResult, products: Product[]): ScannedRow[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  return scan.items.map((it) => {
    const product = it.status === 'matched' && it.match.best ? byId.get(it.match.best.id) ?? null : null;
    return {
      query: product?.name ?? it.name,
      product,
      isNew: !product && it.status === 'new',
      newUnit: it.unit ?? 'piece',
      newSellingPrice: null,
      qty: it.qty,
      rate: it.rate === null ? null : toRupees(it.rate),
      scanName: it.name,
      scanStatus: product ? 'matched' : it.status === 'matched' ? 'check' : it.status,
      candidates: it.status === 'check' ? it.match.candidates : [],
    };
  });
}

/** Rupee difference beyond which the items "don't add up" (bills round to the rupee). */
const ROUNDING_PAISE = 100;

/** Live check of the rows the user is editing against the bill's printed total (paise). */
export function totalsMismatch(itemsTotalPaise: number, billTotalPaise: number | null): number | null {
  if (billTotalPaise === null) return null;
  const diff = billTotalPaise - itemsTotalPaise;
  return Math.abs(diff) > ROUNDING_PAISE ? diff : null;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Bill names the user linked by hand to an existing product / supplier, to remember as aliases
 * (the server skips ones the record already answers to, or that belong to someone else).
 */
export function scanAliases(
  rows: { scanName?: string; scanStatus?: ScanItemStatus; product: Product | null }[],
  scan: BillScanResult,
  supplierId: string,
): AliasLearning[] {
  const out: AliasLearning[] = [];
  for (const r of rows) {
    if (!r.product || !r.scanName || r.scanStatus === 'matched') continue;
    if (norm(r.scanName) === norm(r.product.name)) continue;
    out.push({ kind: 'product', id: r.product.id, alias: r.scanName });
  }
  const s = scan.supplier;
  const autoMatched = s?.match.status === 'matched' && s.match.best?.id === supplierId;
  if (s && supplierId && !autoMatched) out.push({ kind: 'supplier', id: supplierId, alias: s.name });
  return out;
}
