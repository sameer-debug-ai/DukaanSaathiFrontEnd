import { Pipe, PipeTransform } from '@angular/core';

const whole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Formats integer paise as rupees with Indian grouping: 12500000 -> "₹1,25,000", 5050 -> "₹50.50". */
export function formatPaise(paise: number | null | undefined, opts: { sign?: boolean } = {}): string {
  if (paise === null || paise === undefined || Number.isNaN(paise)) return '₹0';
  const abs = Math.abs(Math.round(paise));
  const body = abs % 100 === 0 ? whole.format(abs / 100) : decimal.format(abs / 100);
  const minus = paise < 0 ? '-' : opts.sign && paise > 0 ? '+' : '';
  return `${minus}₹${body}`;
}

@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(paise: number | null | undefined, sign = false): string {
    return formatPaise(paise, { sign });
  }
}
