// Verifies that en.json and hi.json have identical keys and that every
// statically referenced translation key in src/ exists. Run: node scripts/check-i18n.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const load = (lang) => JSON.parse(readFileSync(join(root, 'public/i18n', `${lang}.json`), 'utf8'));
const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

const en = new Set(flatten(load('en')));
const hi = new Set(flatten(load('hi')));
let failed = false;
const report = (title, list) => {
  if (!list.length) return;
  failed = true;
  console.error(`\n${title} (${list.length}):\n  ${list.join('\n  ')}`);
};
report('Missing in hi.json', [...en].filter((k) => !hi.has(k)));
report('Missing in en.json', [...hi].filter((k) => !en.has(k)));

const files = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|html)$/.test(f) && !f.endsWith('.spec.ts')) files.push(p);
  }
};
walk(join(root, 'src/app'));

const NAMESPACES = Object.keys(load('en'));
const keyRx = new RegExp(`['"\`]((?:${NAMESPACES.join('|')})\\.[A-Za-z0-9_.]+)['"\`]`, 'g');
const used = new Set();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(keyRx)) {
    const k = m[1];
    if (k.endsWith('.')) continue; // dynamic prefix like 'pay.' + mode
    used.add(k);
  }
}
report('Used in code but missing from en.json', [...used].filter((k) => !en.has(k)).sort());

// Dynamic families: every value the code can produce must exist.
const families = {
  'pay.': ['cash', 'upi', 'bank', 'udhaar', 'partial'],
  'units.': ['kg', 'g', 'litre', 'ml', 'piece', 'packet', 'dozen', 'box'],
  'movement.': ['purchase', 'sale', 'adjustment', 'return', 'damage'],
  'txn.': ['sale', 'udhaar', 'payment', 'purchase', 'supplier_payment'],
  'voice.status.': ['confirmed', 'cancelled', 'failed', 'pending'],
  'ledger.source.': ['voice', 'sale', 'manual'],
  'voice.intent.': ['add_credit', 'receive_payment', 'add_purchase', 'supplier_payment', 'add_sale', 'adjust_stock', 'add_product', 'query_balance', 'query_stock', 'query_summary', 'unknown'],
  'voice.ask.': ['add_credit', 'receive_payment', 'add_purchase', 'supplier_payment', 'add_sale', 'adjust_stock', 'add_product', 'creditItems', 'stockDown'],
  'reports.col.': ['day', 'bills', 'cash', 'upi', 'credit', 'discount', 'total', 'revenue', 'cost', 'profit', 'margin', 'name', 'phone', 'given', 'received', 'balance', 'purchases', 'items', 'paid', 'payable', 'category', 'currentStock', 'unit', 'purchasePrice', 'costValue', 'saleValue', 'qty'],
  'reports.series.': ['Sales', 'Profit'],
};
report(
  'Dynamic keys missing',
  Object.entries(families).flatMap(([p, vals]) => vals.map((v) => p + v)).filter((k) => !en.has(k)),
);

if (failed) process.exit(1);
console.log(`i18n OK: ${en.size} keys in both languages, ${used.size} static references checked.`);
