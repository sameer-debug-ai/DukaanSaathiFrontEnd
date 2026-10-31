import type { BillParty, Sale } from '../models/domain.models';

/**
 * ESC/POS bytes for a bill on a 58 mm (32 columns) or 80 mm (48 columns) thermal printer.
 * These printers only have ASCII fonts, so ₹ becomes "Rs" and other non-ASCII letters (Hindi)
 * are dropped; for Hindi on paper, print through the system print dialog instead.
 */

const ESC = 0x1b;
const GS = 0x1d;

export const columnsFor = (size: '58mm' | '80mm'): number => (size === '58mm' ? 32 : 48);

/** Printable ASCII only. */
export function asciiOnly(text: string): string {
  return text
    .replace(/₹/g, 'Rs')
    .replace(/[×]/g, 'x')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const money = (paise: number): string => {
  const neg = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const r = (abs / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${neg ? '-' : ''}${r}`;
};

/** "left .......... right" in exactly `width` columns (left is cut when too long). */
export function leftRight(left: string, right: string, width: number): string {
  const r = asciiOnly(right);
  const room = Math.max(1, width - r.length - 1);
  const l = asciiOnly(left).slice(0, room);
  return l + ' '.repeat(width - l.length - r.length) + r;
}

/** Splits text into lines of at most `width` columns, on spaces where possible. */
export function wrap(text: string, width: number): string[] {
  const words = asciiOnly(text).split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (!line) line = w;
    else if (line.length + 1 + w.length <= width) line += ' ' + w;
    else {
      lines.push(line);
      line = w;
    }
    while (line.length > width) {
      lines.push(line.slice(0, width));
      line = line.slice(width);
    }
  }
  if (line) lines.push(line);
  return lines;
}

class Bytes {
  readonly out: number[] = [];
  raw(...b: number[]) {
    this.out.push(...b);
    return this;
  }
  text(s: string) {
    for (const ch of asciiOnly(s)) this.out.push(ch.charCodeAt(0));
    return this.raw(0x0a);
  }
  align(a: 'left' | 'center' | 'right') {
    return this.raw(ESC, 0x61, a === 'left' ? 0 : a === 'center' ? 1 : 2);
  }
  bold(on: boolean) {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }
  big(on: boolean) {
    return this.raw(GS, 0x21, on ? 0x11 : 0x00);
  }
  qr(data: string) {
    const d = [...data].map((c) => c.charCodeAt(0) & 0xff);
    const len = d.length + 3;
    return this.raw(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00) // model 2
      .raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06) // module size
      .raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31) // error level M
      .raw(GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30, ...d)
      .raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30)
      .raw(0x0a);
  }
}

export interface EscPosBill {
  sale: Sale;
  seller: BillParty;
  label: string;
  dateText: string;
  buyerName: string;
  footer: string;
  /** upi://pay link for the amount still due, or null. */
  upiLink: string | null;
}

export function buildEscPos(b: EscPosBill, size: '58mm' | '80mm'): Uint8Array {
  const W = columnsFor(size);
  const s = b.sale;
  const gst = s.docType === 'tax_invoice';
  const rule = '-'.repeat(W);
  const p = new Bytes().raw(ESC, 0x40); // init

  p.align('center').bold(true).big(true);
  for (const l of wrap(b.seller.name, Math.floor(W / 2))) p.text(l);
  p.big(false).bold(false);
  for (const l of wrap(b.seller.address, W)) p.text(l);
  if (b.seller.phone) p.text(`Ph: ${b.seller.phone}`);
  if (b.seller.gstin) p.text(`GSTIN: ${b.seller.gstin}`);
  if (s.status === 'cancelled') p.bold(true).text('*** CANCELLED ***').bold(false);
  p.bold(true).text(s.docType === 'tax_invoice' ? 'TAX INVOICE' : s.docType === 'bill_of_supply' ? 'BILL OF SUPPLY' : 'BILL').bold(false);

  p.align('left');
  p.text(`No: ${b.label}`);
  p.text(`Date: ${b.dateText}`);
  if (b.buyerName) p.text(`To: ${b.buyerName}`.slice(0, W));
  if (s.buyer?.gstin) p.text(`GSTIN: ${s.buyer.gstin}`);
  p.text(rule);
  for (const i of s.items) {
    for (const l of wrap(i.name, W)) p.text(l);
    const qty = `${Math.round(i.qty * 1000) / 1000} x ${money(i.rate)}${gst ? ` ${i.gstRate ?? 0}%` : ''}`;
    p.text(leftRight(`  ${qty}`, money(i.total), W));
  }
  p.text(rule);
  p.text(leftRight('Subtotal', money(s.subtotal), W));
  if (s.discount) p.text(leftRight('Discount', `-${money(s.discount)}`, W));
  if (gst) {
    p.text(leftRight('Taxable value', money(s.taxableTotal ?? 0), W));
    if (s.interState) p.text(leftRight('IGST', money(s.igst ?? 0), W));
    else {
      p.text(leftRight('CGST', money(s.cgst ?? 0), W));
      p.text(leftRight('SGST', money(s.sgst ?? 0), W));
    }
    if (s.roundOff) p.text(leftRight('Round off', money(s.roundOff), W));
  }
  p.bold(true).text(leftRight('TOTAL Rs', money(s.totalAmount), W)).bold(false);
  p.text(leftRight(`Paid (${s.paymentMode})`, money(s.paidAmount), W));
  if (s.creditAmount) p.text(leftRight('Udhaar', money(s.creditAmount), W));
  if (s.amountInWords) for (const l of wrap(s.amountInWords.en, W)) p.text(l);
  if (gst && s.taxSummary?.length) {
    p.text(rule);
    for (const t of s.taxSummary) p.text(leftRight(`GST ${t.rate}% on ${money(t.taxable)}`, money(t.cgst + t.sgst + t.igst), W));
  }
  if (s.docType === 'bill_of_supply') for (const l of wrap('Composition taxable person, not eligible to collect tax on supplies', W)) p.text(l);
  p.text(rule);
  p.align('center');
  if (b.upiLink) {
    p.text('Scan to pay (UPI)');
    p.qr(b.upiLink);
  }
  for (const l of wrap(b.footer || 'Thank you, visit again!', W)) p.text(l);
  p.raw(ESC, 0x64, 0x04); // feed 4 lines
  p.raw(GS, 0x56, 0x42, 0x00); // partial cut (ignored by printers without a cutter)
  return Uint8Array.from(p.out);
}
