import type { AuthService } from '../auth/auth.service';
import type { BillParty, Sale } from '../models/domain.models';

/** "KGS/2026-27/0001", or "#12" for bills made before invoice numbers. */
export const billLabel = (s: Pick<Sale, 'invoiceNo' | 'billNumber'>): string => s.invoiceNo ?? `#${s.billNumber}`;

/** Seller as printed: the snapshot saved with the bill, else today's settings (older bills). */
export function sellerOf(sale: Sale, auth: AuthService): BillParty {
  const u = auth.user();
  const b = u?.billing;
  return {
    name: sale.seller?.name || b?.shopName || u?.shopName || '',
    address: sale.seller?.address || b?.address || u?.shopAddress || '',
    phone: sale.seller?.phone || b?.phone || u?.phone || '',
    gstin: sale.seller?.gstin ?? '',
    stateCode: sale.seller?.stateCode ?? '',
  };
}

/** GST state codes, for "Place of supply: 29-Karnataka" (same list as the server's utils/gst.ts). */
export const GST_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep',
  '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory',
};

/** Amount the customer still has to pay on this bill (its udhaar part); nothing once cancelled. */
export const amountDue = (s: Sale): number => (s.status === 'cancelled' ? 0 : s.creditAmount);
