import type { Unit } from '../../core/models/domain.models';

export interface OrderLine {
  name: string;
  nameHindi?: string;
  qty: number;
  unit: Unit | string;
}

const UNIT_HI: Record<string, string> = {
  kg: 'किलो',
  g: 'ग्राम',
  litre: 'लीटर',
  ml: 'ml',
  piece: 'पीस',
  packet: 'पैकेट',
  dozen: 'दर्जन',
  box: 'डिब्बा',
};

const qtyText = (n: number) => String(Math.round(n * 1000) / 1000);

/** WhatsApp order to a supplier. Hindi by default (what most suppliers read); English when asked. */
export function orderMessage(opts: { supplierName?: string | null; shopName: string; shopPhone?: string | null; items: OrderLine[]; lang: 'hi' | 'en' }): string {
  const hi = opts.lang === 'hi';
  const lines = opts.items
    .filter((i) => i.qty > 0)
    .map((i, n) => {
      const name = hi && i.nameHindi && i.nameHindi !== i.name ? `${i.name} (${i.nameHindi})` : i.name;
      const unit = hi ? UNIT_HI[i.unit] ?? i.unit : i.unit;
      return `${n + 1}. ${name} – ${qtyText(i.qty)} ${unit}`;
    });
  const who = opts.supplierName?.trim();
  const sign = `- ${opts.shopName}${opts.shopPhone ? `, ${opts.shopPhone}` : ''}`;
  return hi
    ? [`नमस्ते${who ? ` ${who} जी` : ''},`, `${opts.shopName} के लिए कृपया ये सामान भेज दीजिए:`, '', ...lines, '', 'धन्यवाद 🙏', sign].join('\n')
    : [`Hello${who ? ` ${who}` : ''},`, `Please send these items for ${opts.shopName}:`, '', ...lines, '', 'Thank you 🙏', sign].join('\n');
}
