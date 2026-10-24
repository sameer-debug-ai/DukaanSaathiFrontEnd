import { formatPaise } from '../../shared/pipes/inr.pipe';

/** Polite payment reminder in the UI language (Hindi by default for customers). */
export function reminderMessage(opts: { customerName: string; amount: number; shopName: string; shopPhone?: string; lang: 'hi' | 'en' }): string {
  const amount = formatPaise(opts.amount);
  if (opts.lang === 'en') {
    return (
      `Namaste ${opts.customerName} ji,\n` +
      `This is a gentle reminder from ${opts.shopName}. Your pending balance is ${amount}.\n` +
      `Please pay at your convenience (cash or UPI). Thank you!` +
      (opts.shopPhone ? `\n- ${opts.shopName}, ${opts.shopPhone}` : '')
    );
  }
  return (
    `नमस्ते ${opts.customerName} जी,\n` +
    `${opts.shopName} की ओर से विनम्र निवेदन है कि आपके खाते में ${amount} बाकी हैं।\n` +
    `सुविधा अनुसार भुगतान (नकद या UPI) कर दें। धन्यवाद! 🙏` +
    (opts.shopPhone ? `\n- ${opts.shopName}, ${opts.shopPhone}` : '')
  );
}
