export interface NavItem {
  path: string;
  labelKey: string;
  icon: string;
}

/** Full navigation (desktop sidebar, mobile "More" page). */
export const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', labelKey: 'nav.dashboard', icon: 'space_dashboard' },
  { path: '/sales/new', labelKey: 'nav.sales', icon: 'point_of_sale' },
  { path: '/products', labelKey: 'nav.products', icon: 'inventory_2' },
  { path: '/customers', labelKey: 'nav.udhaar', icon: 'menu_book' },
  { path: '/suppliers', labelKey: 'nav.suppliers', icon: 'local_shipping' },
  { path: '/purchases', labelKey: 'nav.purchases', icon: 'shopping_cart' },
  { path: '/products/reorder', labelKey: 'nav.reorder', icon: 'playlist_add_check' },
  { path: '/reports', labelKey: 'nav.reports', icon: 'bar_chart' },
  { path: '/voice-history', labelKey: 'nav.voiceHistory', icon: 'graphic_eq' },
  { path: '/settings', labelKey: 'nav.settings', icon: 'settings' },
];

/** Mobile bottom bar: the four most used sections plus "More". */
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', labelKey: 'nav.dashboard', icon: 'space_dashboard' },
  { path: '/products', labelKey: 'nav.products', icon: 'inventory_2' },
  { path: '/customers', labelKey: 'nav.udhaar', icon: 'menu_book' },
  { path: '/suppliers', labelKey: 'nav.suppliers', icon: 'local_shipping' },
  { path: '/more', labelKey: 'nav.more', icon: 'menu' },
];

/** Items the "More" page lists (everything not in the bottom bar). */
export const MORE_ITEMS: NavItem[] = NAV_ITEMS.filter(
  (i) => !BOTTOM_NAV_ITEMS.some((b) => b.path === i.path),
);
