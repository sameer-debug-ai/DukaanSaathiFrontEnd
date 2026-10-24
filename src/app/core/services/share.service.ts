import { Injectable } from '@angular/core';

/** Downloads, WhatsApp links and the native share sheet. */
@Injectable({ providedIn: 'root' })
export class ShareService {
  download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /** wa.me link; phone is a 10-digit Indian number (country code added here). */
  whatsappUrl(phone: string | null | undefined, text: string): string {
    const digits = (phone ?? '').replace(/\D/g, '').slice(-10);
    const target = digits.length === 10 ? `91${digits}` : '';
    return `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
  }

  openWhatsapp(phone: string | null | undefined, text: string): void {
    window.open(this.whatsappUrl(phone, text), '_blank', 'noopener');
  }

  /** Native share (Android/iOS) with a file when supported, else false. */
  async shareFile(file: File, title: string, text: string): Promise<boolean> {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title, text });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}
