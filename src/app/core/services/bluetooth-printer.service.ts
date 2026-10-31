import { Injectable, signal } from '@angular/core';

/** Minimal Web Bluetooth types (not in TypeScript's DOM lib). */
interface BtCharacteristic {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValue(data: BufferSource): Promise<void>;
  writeValueWithoutResponse?(data: BufferSource): Promise<void>;
}
interface BtService {
  getCharacteristics(): Promise<BtCharacteristic[]>;
}
interface BtServer {
  connected: boolean;
  connect(): Promise<BtServer>;
  getPrimaryService(uuid: string): Promise<BtService>;
}
interface BtDevice {
  name?: string;
  gatt?: BtServer;
}
interface Bluetooth {
  requestDevice(opts: { acceptAllDevices: boolean; optionalServices: string[] }): Promise<BtDevice>;
}

/** GATT services used by common cheap thermal printers (most use the first one). */
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
];

/** BLE writes are small; printers buffer the rest. */
const CHUNK = 180;

export type BtUnsupportedReason = 'ios' | 'browser' | 'insecure';

/**
 * Direct printing to a Bluetooth (BLE) ESC/POS thermal printer from Chrome on Android or
 * desktop. The chosen printer is remembered while the app is open.
 */
@Injectable({ providedIn: 'root' })
export class BluetoothPrinter {
  private device: BtDevice | null = null;
  private characteristic: BtCharacteristic | null = null;
  readonly printerName = signal<string | null>(null);

  /** null when it works here; otherwise why not (shown to the user). */
  unsupportedReason(): BtUnsupportedReason | null {
    if (typeof navigator === 'undefined') return 'browser';
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
    if (!('bluetooth' in navigator)) return 'browser';
    if (!window.isSecureContext) return 'insecure';
    return null;
  }

  async print(bytes: Uint8Array): Promise<void> {
    const ch = await this.connect();
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const part = bytes.slice(i, i + CHUNK);
      if (ch.properties.writeWithoutResponse && ch.writeValueWithoutResponse) await ch.writeValueWithoutResponse(part);
      else await ch.writeValue(part);
    }
  }

  forget(): void {
    this.device = null;
    this.characteristic = null;
    this.printerName.set(null);
  }

  private async connect(): Promise<BtCharacteristic> {
    if (this.characteristic && this.device?.gatt?.connected) return this.characteristic;
    const bt = (navigator as unknown as { bluetooth: Bluetooth }).bluetooth;
    if (!this.device) this.device = await bt.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICES });
    const server = await this.device.gatt!.connect();
    for (const uuid of PRINTER_SERVICES) {
      try {
        const service = await server.getPrimaryService(uuid);
        const ch = (await service.getCharacteristics()).find((c) => c.properties.write || c.properties.writeWithoutResponse);
        if (ch) {
          this.characteristic = ch;
          this.printerName.set(this.device.name ?? 'Printer');
          return ch;
        }
      } catch {
        /* not this service; try the next */
      }
    }
    this.forget();
    throw new Error('NO_PRINT_SERVICE');
  }
}
