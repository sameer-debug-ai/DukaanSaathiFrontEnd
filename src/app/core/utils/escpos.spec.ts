import type { Sale } from '../models/domain.models';
import { asciiOnly, buildEscPos, columnsFor, leftRight, wrap } from './escpos';

const sale = (over: Partial<Sale> = {}): Sale => ({
  id: 's1',
  billNumber: 1,
  invoiceNo: 'KGS/2026-27/0001',
  docType: 'bill',
  customerName: '',
  items: [{ productId: 'p1', name: 'Basmati Rice चावल', unit: 'kg', qty: 2, rate: 10500, total: 21000 }],
  subtotal: 21000,
  discount: 0,
  totalAmount: 21000,
  paymentMode: 'cash',
  paidAmount: 21000,
  creditAmount: 0,
  date: '2026-10-31T06:00:00Z',
  note: '',
  source: 'manual',
  ...over,
});

const text = (bytes: Uint8Array) => String.fromCharCode(...bytes);

describe('ESC/POS bill', () => {
  it('lines fit the roll exactly: 32 columns on 58 mm, 48 on 80 mm', () => {
    expect(columnsFor('58mm')).toBe(32);
    expect(columnsFor('80mm')).toBe(48);
    expect(leftRight('Subtotal', '210.00', 32)).toHaveLength(32);
    expect(leftRight('A very long item name that does not fit at all', '1,23,456.00', 32)).toHaveLength(32);
  });

  it('drops what thermal fonts cannot print and spells out the rupee sign', () => {
    expect(asciiOnly('₹105 चावल Rice')).toBe('Rs105 Rice');
    expect(wrap('one two three four', 9)).toEqual(['one two', 'three', 'four']);
  });

  it('builds a printable receipt: init, bill number, items, total, cut', () => {
    const out = buildEscPos(
      { sale: sale(), seller: { name: 'Kumar Store', address: 'Main Road', phone: '9876543210', gstin: '', stateCode: '' }, label: 'KGS/2026-27/0001', dateText: '31 Oct 2026', buyerName: '', footer: '', upiLink: null },
      '58mm',
    );
    const t = text(out);
    expect(Array.from(out.slice(0, 2))).toEqual([0x1b, 0x40]);
    expect(t).toContain('No: KGS/2026-27/0001');
    expect(t).toContain('Basmati Rice');
    expect(t).not.toContain('चावल');
    expect(t).toMatch(/TOTAL Rs\s+210\.00/);
    expect(Array.from(out.slice(-4))).toEqual([0x1d, 0x56, 0x42, 0x00]);
  });

  it('GST bills show the tax split; a UPI QR is added when money is due', () => {
    const out = buildEscPos(
      {
        sale: sale({ docType: 'tax_invoice', taxableTotal: 20000, cgst: 500, sgst: 500, taxSummary: [{ rate: 5, taxable: 20000, cgst: 500, sgst: 500, igst: 0 }], creditAmount: 21000, paidAmount: 0, paymentMode: 'udhaar' }),
        seller: { name: 'Kumar Store', address: '', phone: '', gstin: '27AAPFU0939F1ZV', stateCode: '27' },
        label: 'KGS/2026-27/0002',
        dateText: '31 Oct 2026',
        buyerName: 'Sharma ji',
        footer: 'Dhanyavaad',
        upiLink: 'upi://pay?pa=kumar@okaxis&pn=Kumar&am=210.00&cu=INR',
      },
      '80mm',
    );
    const t = text(out);
    expect(t).toContain('TAX INVOICE');
    expect(t).toContain('GSTIN: 27AAPFU0939F1ZV');
    expect(t).toMatch(/CGST\s+5\.00/);
    expect(t).toContain('upi://pay?pa=kumar@okaxis');
    expect(t).toContain('Dhanyavaad');
  });
});
