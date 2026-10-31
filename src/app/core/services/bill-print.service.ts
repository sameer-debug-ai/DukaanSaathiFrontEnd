import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import type { PaperSize } from '../models/api.models';

const PX_PER_MM = 96 / 25.4;

/**
 * Prints one element (the bill) through the device's print dialog, so any printer the phone or
 * PC has installed works: USB / Bluetooth thermal printers that show up as system printers, or A4.
 *
 * The bill is copied into a hidden iframe with the app's styles, so the page around it never
 * prints. Thermal pages are exactly as tall as the bill: no blank paper fed out after it.
 */
@Injectable({ providedIn: 'root' })
export class BillPrintService {
  private readonly doc = inject(DOCUMENT);

  async print(el: HTMLElement, size: PaperSize): Promise<void> {
    const frame = this.doc.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: size === 'a4' ? '210mm' : size, height: '10px', border: '0', opacity: '0', pointerEvents: 'none' });
    this.doc.body.appendChild(frame);
    try {
      const w = frame.contentWindow!;
      const d = w.document;
      // Component styles live in <style>/<link> tags in <head>; copy them so the bill looks the same.
      const styles = [...this.doc.querySelectorAll('style, link[rel="stylesheet"]')].map((n) => n.outerHTML).join('');
      d.open();
      d.write(`<!doctype html><html><head><meta charset="utf-8">${styles}<style id="page"></style></head><body style="margin:0;background:#fff"></body></html>`);
      d.close();
      d.body.appendChild(d.importNode(el, true));
      await Promise.all([...d.images].map((img) => (img.complete ? Promise.resolve() : new Promise((r) => ((img.onload = r), (img.onerror = r))))));
      await new Promise((r) => setTimeout(r, 50));

      const page = d.getElementById('page')!;
      if (size === 'a4') {
        page.textContent = '@page { size: A4; margin: 12mm; }';
      } else {
        const heightMm = Math.ceil(d.body.scrollHeight / PX_PER_MM) + 6;
        page.textContent = `@page { size: ${size} ${heightMm}mm; margin: 0; } html, body { width: ${size}; }`;
      }
      w.focus();
      w.print();
    } finally {
      // Some browsers return from print() before the dialog closes; give it time.
      setTimeout(() => frame.remove(), 60_000);
    }
  }
}
