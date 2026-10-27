import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guards';
import { Shell } from './layout/shell/shell';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
    title: 'Login · DukaanSathi',
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
    title: 'Register · DukaanSathi',
  },
  {
    // Customer's read-only khata from a shared link: no login, no app shell.
    path: 'k/:token',
    loadComponent: () => import('./features/public/khata-page').then((m) => m.KhataPage),
    title: 'Khata · DukaanSathi',
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Dashboard · DukaanSathi',
      },
      {
        path: 'products',
        title: 'Products · DukaanSathi',
        children: [
          { path: '', loadComponent: () => import('./features/products/products-list').then((m) => m.ProductsList) },
          { path: 'alerts', loadComponent: () => import('./features/products/stock-alerts').then((m) => m.StockAlertsPage), title: 'Low stock · DukaanSathi' },
          { path: ':id', loadComponent: () => import('./features/products/product-detail').then((m) => m.ProductDetail) },
        ],
      },
      {
        path: 'customers',
        title: 'Udhaar · DukaanSathi',
        children: [
          { path: '', loadComponent: () => import('./features/customers/customers-list').then((m) => m.CustomersList) },
          { path: ':id', loadComponent: () => import('./features/customers/customer-detail').then((m) => m.CustomerDetailPage) },
        ],
      },
      {
        path: 'suppliers',
        title: 'Suppliers · DukaanSathi',
        children: [
          { path: '', loadComponent: () => import('./features/suppliers/suppliers-list').then((m) => m.SuppliersList) },
          { path: ':id', loadComponent: () => import('./features/suppliers/supplier-detail').then((m) => m.SupplierDetail) },
        ],
      },
      {
        path: 'purchases',
        title: 'Purchases · DukaanSathi',
        children: [
          { path: '', loadComponent: () => import('./features/purchases/purchases-list').then((m) => m.PurchasesList) },
          { path: 'new', loadComponent: () => import('./features/purchases/purchase-form').then((m) => m.PurchaseForm), title: 'New purchase · DukaanSathi' },
        ],
      },
      {
        path: 'sales',
        title: 'Sales · DukaanSathi',
        children: [
          { path: '', loadComponent: () => import('./features/sales/sales-list').then((m) => m.SalesList) },
          { path: 'new', loadComponent: () => import('./features/sales/billing').then((m) => m.Billing), title: 'Billing · DukaanSathi' },
          { path: ':id', loadComponent: () => import('./features/sales/sale-view').then((m) => m.SaleView) },
        ],
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/reports/reports').then((m) => m.Reports),
        title: 'Reports · DukaanSathi',
      },
      {
        path: 'voice-history',
        loadComponent: () => import('./features/voice/voice-history').then((m) => m.VoiceHistory),
        title: 'Voice history · DukaanSathi',
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
        title: 'Settings · DukaanSathi',
      },
      {
        path: 'more',
        loadComponent: () => import('./features/more/more').then((m) => m.More),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
