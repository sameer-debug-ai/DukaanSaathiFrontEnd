import type { VoiceParseResult } from '../../core/models/domain.models';
import { dayToIso } from '../../core/utils/format';
import type { ConfirmedCommand } from './voice-executor.service';

/**
 * The command the confirmation card would hand over if the user tapped "Yes" without
 * editing anything. Used for auto-save, where the card is skipped.
 */
export function toConfirmedCommand(r: VoiceParseResult): ConfirmedCommand {
  const picked = (m: VoiceParseResult['customer']) => (m?.status === 'matched' && m.best ? m.best : undefined);
  const customer = picked(r.customer);
  const supplier = picked(r.supplier);
  const product = r.intent === 'add_product' ? undefined : picked(r.product);

  const items = r.items.map((i) => ({
    productId: i.match.status !== 'not_found' ? i.match.best?.id : undefined,
    name: (i.match.status !== 'not_found' ? i.match.best?.name : undefined) ?? i.spokenName,
    qty: i.qty,
    unit: i.unit,
    rate: i.rate,
  }));
  const itemsTotal = items.length && items.every((i) => i.rate !== null) ? items.reduce((s, i) => s + Math.round(i.qty * (i.rate ?? 0)), 0) : null;
  const allItemsMatched = items.length > 0 && items.every((i) => !!i.productId && i.rate !== null);
  const fromItems = r.intent === 'add_sale' || r.intent === 'add_purchase' || (r.intent === 'add_credit' && allItemsMatched);

  return {
    intent: r.intent,
    text: r.text,
    logId: r.logId,
    customerId: customer?.id,
    customerName: customer?.name ?? r.newCustomerName,
    newCustomerName: customer ? undefined : r.newCustomerName,
    supplierId: supplier?.id,
    supplierName: supplier?.name,
    productId: product?.id,
    productName: r.intent === 'add_product' ? (r.parsed.productName ?? undefined) : product?.name,
    amount: fromItems && itemsTotal !== null ? itemsTotal : r.amount,
    paidAmount: r.paidAmount,
    quantity: r.quantity,
    unit: r.parsed.unit,
    sellingPrice: r.parsed.sellingPrice,
    paymentMode: r.paymentMode ?? (r.intent === 'add_sale' && r.customer ? 'udhaar' : 'cash'),
    date: r.date ? dayToIso(r.date) : undefined,
    items,
  };
}
