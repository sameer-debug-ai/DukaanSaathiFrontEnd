/** Rupees typed by the user -> integer paise sent to the API. */
export const toPaise = (rupees: number | string | null | undefined): number => {
  const n = typeof rupees === 'string' ? Number(rupees.replace(/[^\d.]/g, '')) : Number(rupees ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/** Paise -> rupees for pre-filling number inputs. */
export const toRupees = (paise: number | null | undefined): number => Math.round(paise ?? 0) / 100;

/** Plain-text money for PDFs / WhatsApp (jsPDF's built-in fonts have no ₹ glyph). */
export function rsText(paise: number): string {
  const abs = Math.abs(paise) / 100;
  const body = abs.toLocaleString('en-IN', { minimumFractionDigits: abs % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return `${paise < 0 ? '-' : ''}Rs. ${body}`;
}

const IST = 'Asia/Kolkata';

/** "YYYY-MM-DD" for the IST calendar day of `d`. */
export function istDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function daysAgo(n: number): string {
  return istDay(new Date(Date.now() - n * 86_400_000));
}

/** "Oct 23" style short label for chart axes. */
export function shortDay(isoDay: string): string {
  const d = new Date(`${isoDay}T12:00:00+05:30`);
  return new Intl.DateTimeFormat('en-IN', { timeZone: IST, day: 'numeric', month: 'short' }).format(d);
}

/** Compact Indian number for axes: 1.2K, 3.4L, 1.1Cr (input in rupees). */
export function compactInr(rupees: number): string {
  const a = Math.abs(rupees);
  if (a >= 1e7) return `${(rupees / 1e7).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (a >= 1e5) return `${(rupees / 1e5).toFixed(1).replace(/\.0$/, '')}L`;
  if (a >= 1e3) return `${(rupees / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(rupees));
}

export function formatQty(qty: number, unit?: string | null): string {
  const q = Math.round(qty * 1000) / 1000;
  return unit ? `${q} ${unit}` : String(q);
}

/** Converts an <input type="date"> value (YYYY-MM-DD, IST day) to an ISO instant at the current IST time. */
export function dayToIso(day: string | null | undefined): string | undefined {
  if (!day) return undefined;
  if (day === istDay()) return new Date().toISOString();
  return new Date(`${day}T12:00:00+05:30`).toISOString();
}
