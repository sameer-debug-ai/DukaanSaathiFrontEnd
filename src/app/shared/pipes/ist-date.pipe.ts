import { Pipe, PipeTransform } from '@angular/core';

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** "23 Oct 2026", or "23 Oct 2026, 5:30 pm" with withTime. Always in IST. */
export function formatIstDate(value: string | Date | null | undefined, withTime = false): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const date = dateFmt.format(d);
  return withTime ? `${date}, ${timeFmt.format(d)}` : date;
}

@Pipe({ name: 'istDate' })
export class IstDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined, withTime = false): string {
    return formatIstDate(value, withTime);
  }
}
