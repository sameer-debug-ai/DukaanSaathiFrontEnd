import type { ShopSettings } from '../models/api.models';

/**
 * UPI deep links (NPCI "upi://pay") and QR codes for the pending udhaar.
 * Same format as the server's (`src/utils/upi.ts` in the backend). Amounts are paise.
 */

export const VPA_RX = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

const enc = (s: string) => encodeURIComponent(s.trim());

/**
 * Plain person-to-person link (pa, pn, am, cu). No transaction note: on a personal UPI ID some
 * receiver banks declined QR payments carrying one ("duplicate RRN").
 */
export function upiLink(opts: { vpa: string; name: string; amount?: number | null; note?: string }): string {
  const parts = [`pa=${opts.vpa.trim()}`, `pn=${enc(opts.name || opts.vpa)}`];
  if (opts.amount && opts.amount > 0) parts.push(`am=${(Math.round(opts.amount) / 100).toFixed(2)}`);
  parts.push('cu=INR');
  return `upi://pay?${parts.join('&')}`;
}

/** Same as the shop's own UPI app QR: no amount, the customer types it. */
export function shopStaticUpiLink(settings: ShopSettings | undefined, shopName: string): string | null {
  const vpa = settings?.upiId?.trim();
  if (!vpa || !VPA_RX.test(vpa)) return null;
  return upiLink({ vpa, name: settings?.upiPayeeName?.trim() || shopName });
}

/** The shop's link for an amount, or null when no valid UPI ID is set in Settings. */
export function shopUpiLink(settings: ShopSettings | undefined, shopName: string, amount: number, note: string): string | null {
  const vpa = settings?.upiId?.trim();
  if (!vpa || !VPA_RX.test(vpa)) return null;
  return upiLink({ vpa, name: settings?.upiPayeeName?.trim() || shopName, amount, note });
}

/** PNG data URL of a QR code (the library loads only when a QR is shown). */
export async function qrDataUrl(text: string, size = 320): Promise<string> {
  const QR = await import('qrcode');
  return QR.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: 'M' });
}
