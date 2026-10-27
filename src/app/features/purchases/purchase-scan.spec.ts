import type { EntityMatch, Product } from '../../core/models/domain.models';
import type { BillScanItem, BillScanResult } from '../../core/services/bill-scan.api';
import { fitWithin } from '../../core/utils/image-compress';
import { scanAliases, scanToRows, totalsMismatch } from './purchase-scan';

const product = (id: string, name: string): Product => ({ id, name, unit: 'packet', purchasePrice: 40000, aliases: [] }) as unknown as Product;
const m = (status: EntityMatch['status'], ids: [string, string][] = []): EntityMatch => ({
  query: 'q',
  status,
  best: ids[0] ? { id: ids[0][0], name: ids[0][1], score: 0.9 } : null,
  candidates: ids.map(([id, name]) => ({ id, name, score: 0.9 })),
});
const item = (name: string, status: BillScanItem['status'], match: EntityMatch, over: Partial<BillScanItem> = {}): BillScanItem => ({
  name, qty: 5, unit: 'packet', rate: 42000, total: 210000, legible: status !== 'unreadable', status, match, ...over,
});
const scan = (items: BillScanItem[], over: Partial<BillScanResult> = {}): BillScanResult => ({
  scanId: 'img1', readable: true, problem: null, supplier: { name: 'RT Wholesale', match: m('matched', [['s1', 'Ramesh Traders']]) },
  invoiceNumber: 'RT-1', date: '2026-10-25', items, billTotal: 210000, itemsTotal: 210000, mismatch: false, engine: 'fake', ...over,
});

describe('scanToRows: bill lines -> purchase form rows', () => {
  const products = [product('p1', 'Aata 10kg'), product('p3', 'Rice 1kg'), product('p4', 'Rice 5kg')];

  it('matched -> product row in rupees; unknown -> "new product"; look-alike -> candidates; unreadable kept for checking', () => {
    const rows = scanToRows(
      scan([
        item('Aashirvaad Atta 10kg', 'matched', m('matched', [['p1', 'Aata 10kg']])),
        item('Fortune Oil', 'new', m('not_found'), { unit: 'litre' }),
        item('Rice', 'check', m('ambiguous', [['p3', 'Rice 1kg'], ['p4', 'Rice 5kg']])),
        item('Hld', 'unreadable', m('not_found'), { qty: null, rate: null }),
      ]),
      products,
    );
    expect(rows[0]).toMatchObject({ product: { id: 'p1' }, query: 'Aata 10kg', qty: 5, rate: 420, isNew: false, scanName: 'Aashirvaad Atta 10kg', scanStatus: 'matched' });
    expect(rows[1]).toMatchObject({ product: null, query: 'Fortune Oil', isNew: true, newUnit: 'litre', scanStatus: 'new' });
    expect(rows[2]).toMatchObject({ product: null, isNew: false, scanStatus: 'check' });
    expect(rows[2]!.candidates.map((c) => c.id)).toEqual(['p3', 'p4']);
    expect(rows[3]).toMatchObject({ product: null, isNew: false, qty: null, rate: null, scanStatus: 'unreadable' });
  });

  it('a match to a product that is no longer in the list falls back to "check"', () => {
    const [row] = scanToRows(scan([item('Old', 'matched', m('matched', [['gone', 'Old']]))]), products);
    expect(row).toMatchObject({ product: null, scanStatus: 'check' });
  });
});

describe('totalsMismatch (live, while the user edits rows)', () => {
  it('ignores rupee rounding, reports bigger gaps with sign', () => {
    expect(totalsMismatch(210000, 210050)).toBeNull();
    expect(totalsMismatch(210000, 213000)).toBe(3000);
    expect(totalsMismatch(213000, 210000)).toBe(-3000);
    expect(totalsMismatch(5000, null)).toBeNull();
  });
});

describe('scanAliases: bill names the user linked by hand', () => {
  it('learns product + supplier names the user linked, not ones that matched already', () => {
    const s = scan([], { supplier: { name: 'Sharma Distributors', match: m('not_found') } });
    const rows = [
      { scanName: 'Aashirvaad Atta 10kg', scanStatus: 'matched' as const, product: product('p1', 'Aata 10kg') },
      { scanName: 'Basmati Chawal', scanStatus: 'check' as const, product: product('p3', 'Rice 1kg') },
      { scanName: 'rice 5kg', scanStatus: 'new' as const, product: product('p4', 'Rice 5kg') }, // same as the name
      { scanName: 'Haldi', scanStatus: 'unreadable' as const, product: null },
    ];
    expect(scanAliases(rows, s, 's9')).toEqual([
      { kind: 'product', id: 'p3', alias: 'Basmati Chawal' },
      { kind: 'supplier', id: 's9', alias: 'Sharma Distributors' },
    ]);
    // Supplier recognised automatically: nothing to learn.
    expect(scanAliases([], scan([]), 's1')).toEqual([]);
  });
});

describe('fitWithin (photo resize before upload)', () => {
  it('scales the longest side down to the limit, keeps the ratio, never upscales', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(0, 600)).toEqual({ width: 0, height: 0 });
  });
});
