# DukaanSathi Frontend

Mobile-first web app for **DukaanSathi**, a shop management app for Indian kirana / general
stores: dashboard, products & stock, udhaar khata, suppliers & purchases, quick billing,
reports, and a voice assistant (speak or type Hindi/Hinglish/English commands).

Backend API: [dukaanSathiBackend](https://github.com/sameer-debug-ai/dukaanSathiBackend)

**Stack:** Angular 21 (standalone components, signals, zoneless) · Angular Material + Tailwind 4 ·
ngx-translate (English / Hindi) · ng2-charts · jsPDF · SheetJS · PWA service worker · Vitest

## Run locally

Start the backend first (it listens on `http://localhost:4000`). Then:

```powershell
npm install
npm start          # http://localhost:4200
```

The dev server proxies `/api` to `http://localhost:4000` (see `proxy.conf.json`), so the
refresh-token cookie works without CORS setup.

Demo login (from the backend's seeded demo shop): **9876543210 / demo123**

| Script | Does |
| --- | --- |
| `npm start` | Dev server with live reload |
| `npx ng build` | Production build to `dist/client/browser` (PWA enabled) |
| `npx ng test --watch=false` | Unit tests |
| `node scripts/check-i18n.mjs` | Checks every UI label exists in English and Hindi |

## Production / Docker

`Dockerfile` builds the app and serves it with nginx. `nginx.conf` proxies `/api/` to
`http://server:4000`, i.e. a backend container named `server` on the same Docker network.
Change that address if your API runs elsewhere. The API URL used by the app is
`src/environments/environment*.ts` (`apiUrl: '/api'`).

## Features

- Responsive layout: bottom navigation + floating mic on phones, collapsible sidebar on desktop.
- Dashboard tiles and charts, low-stock alerts with reorder, top debtors, recent activity.
- Products: search, filters, stock badges, stock adjustments and history, CSV/Excel import, CSV export.
- Udhaar khata: running-balance ledger, add udhaar / receive payment, WhatsApp reminder, PDF statement.
- Suppliers and purchases (with inline new products), supplier payments.
- Billing: tap-to-add grid, barcode search, cash / UPI / udhaar / partial, printable bill, PDF and WhatsApp share.
- Reports with date ranges, CSV/PDF export.
- Voice assistant: Web Speech API (`hi-IN` / `en-IN`), text fallback, confirmation card before anything is saved, voice history.
- English UI by default (Hindi available in Settings), light / dark mode, installable PWA.

## Project structure

```
src/app/
  core/      auth, interceptors, guards, API + domain services, utils
  shared/    reusable components (stat card, badges, dialogs, date range...) and pipes
  layout/    app shell, navigation, mic button
  features/  dashboard, products, customers, suppliers, purchases, sales, reports, voice, settings
public/i18n/ en.json, hi.json
```
