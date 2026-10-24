import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { EmptyState } from './empty-state/empty-state';
import { StatCard } from './stat-card/stat-card';
import { StockBadge } from './stock-badge/stock-badge';

describe('shared components', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTranslateService(), provideRouter([])] });
  });

  it('StockBadge shows the right tone and label key for each status', async () => {
    const fixture = TestBed.createComponent(StockBadge);
    for (const [status, cls, key] of [
      ['in', 'ok', 'stock.in'],
      ['low', 'warn', 'stock.low'],
      ['out', 'danger', 'stock.out'],
    ] as const) {
      fixture.componentRef.setInput('status', status);
      await fixture.whenStable();
      const badge = (fixture.nativeElement as HTMLElement).querySelector('.ds-badge')!;
      expect(badge.classList).toContain(cls);
      // No translations loaded in tests, so the pipe returns the key itself.
      expect(badge.textContent).toContain(key);
    }
  });

  it('StatCard renders label, value and hint, and links when given a route', async () => {
    const fixture = TestBed.createComponent(StatCard);
    fixture.componentRef.setInput('label', "Today's sales");
    fixture.componentRef.setInput('value', '₹1,25,000');
    fixture.componentRef.setInput('hint', '12 bills');
    fixture.componentRef.setInput('link', '/sales');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.label')?.textContent).toContain("Today's sales");
    expect(el.querySelector('.value')?.textContent).toContain('₹1,25,000');
    expect(el.querySelector('.hint')?.textContent).toContain('12 bills');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/sales');
  });

  it('EmptyState shows title and hint', async () => {
    const fixture = TestBed.createComponent(EmptyState);
    fixture.componentRef.setInput('title', 'No products found');
    fixture.componentRef.setInput('hint', 'Add a product');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent).toContain('No products found');
    expect(el.textContent).toContain('Add a product');
  });
});
