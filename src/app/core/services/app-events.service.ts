import { Injectable, inject, signal } from '@angular/core';
import { ProductsApi } from './data.services';
import { AuthService } from '../auth/auth.service';

export type DataTopic = 'products' | 'customers' | 'suppliers' | 'sales' | 'purchases' | 'any';

/**
 * Tiny change-notification bus. After a save (from a form or the voice assistant),
 * call `changed('customers')`; pages that read `version()` reload their data.
 */
@Injectable({ providedIn: 'root' })
export class AppEvents {
  readonly version = signal(0);
  readonly lastTopic = signal<DataTopic>('any');

  changed(topic: DataTopic = 'any'): void {
    this.lastTopic.set(topic);
    this.version.update((v) => v + 1);
  }
}

/** Stock-alert count for the header bell; refreshed on login and after any data change. */
@Injectable({ providedIn: 'root' })
export class StockAlertsService {
  private readonly api = inject(ProductsApi);
  private readonly auth = inject(AuthService);
  readonly count = signal(0);
  readonly outCount = signal(0);

  refresh(): void {
    if (!this.auth.isLoggedIn()) return;
    this.api.alerts().subscribe({
      next: (a) => {
        this.count.set(a.total);
        this.outCount.set(a.outCount);
      },
      error: () => undefined,
    });
  }
}
