import { formatPaise } from './shared/pipes/inr.pipe';
import { formatIstDate } from './shared/pipes/ist-date.pipe';
import { normalizePhone } from './shared/validators';

describe('formatPaise', () => {
  it('uses Indian digit grouping', () => {
    expect(formatPaise(12500000)).toBe('₹1,25,000');
    expect(formatPaise(50000)).toBe('₹500');
  });

  it('shows paise only when present', () => {
    expect(formatPaise(5050)).toBe('₹50.50');
  });

  it('handles negatives, signs and empty values', () => {
    expect(formatPaise(-30000)).toBe('-₹300');
    expect(formatPaise(30000, { sign: true })).toBe('+₹300');
    expect(formatPaise(null)).toBe('₹0');
  });
});

describe('formatIstDate', () => {
  it('formats as DD MMM YYYY in Asia/Kolkata', () => {
    // 20:00 UTC on 22 Oct is already 23 Oct in India.
    expect(formatIstDate('2026-10-22T20:00:00.000Z')).toBe('23 Oct 2026');
  });
});

describe('normalizePhone', () => {
  it('strips +91, spaces and leading zero', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('9876543210');
    expect(normalizePhone('09876543210')).toBe('9876543210');
  });
});
