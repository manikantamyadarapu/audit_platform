# HAA Audit Platform — Frontend

React single-page application for **Scrutiny & Vouching** audits. Users upload Excel ledgers, run validation against backend Python engines, review exceptions in interactive tables, and export results as Excel, CSV, or PDF.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 |
| Build tool | Vite 8 |
| Routing | React Router 7 |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`) |
| HTTP | Axios |
| Tables | TanStack React Table |
| Charts | ApexCharts |
| Animation | Framer Motion |
| Icons | Lucide React |
| Toasts | react-hot-toast |
| Client exports | `xlsx`, `jspdf`, `jspdf-autotable` |

---

## Getting Started

```bash
# From the frontend folder
npm install
npm run dev      # Start dev server (default port 4000)
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # ESLint
```

The dev server proxies `/api` requests to the Node.js backend (default port `4002`). See [Environment Variables](#environment-variables).

**Bootstrap order:**

```
index.html → src/main.jsx → src/App.jsx → src/routes/AppRoutes.jsx
```

---

## Top-Level Structure

```
frontend/
├── index.html              # HTML shell, theme bootstrap, boot skeleton
├── package.json            # Dependencies and npm scripts
├── vite.config.js          # Vite + React + Tailwind; dev proxy to backend
├── eslint.config.js        # Flat ESLint config (React hooks, refresh)
├── vercel.json             # SPA rewrite rules for deployment
├── .env                    # Local VITE_* environment variables (not committed)
└── src/
    ├── main.jsx            # React entry point
    ├── App.jsx             # Root component (renders AppRoutes)
    ├── index.css           # Tailwind v4 theme, design tokens, global styles
    ├── routes/             # Route definitions
    ├── pages/              # Page-level views
    ├── components/         # Reusable UI (auth, layout, audit, tables, …)
    ├── services/           # API / HTTP layer
    ├── utils/              # Helpers, filters, export utilities
    ├── hooks/              # Custom React hooks
    ├── context/            # React Context providers
    ├── config/             # App and audit configuration
    ├── constants/          # Static rule-book defaults
    ├── types/              # JSDoc typedefs
    └── styles/             # Supplemental CSS (fonts, login animations)
```

There is no `public/` folder. Static assets are served from the Vite root or bundled from `src/`.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │   Pages     │→ │  Components  │→ │  Utils / Hooks      │ │
│  └──────┬──────┘  └──────────────┘  └─────────────────────┘ │
│         │                                                    │
│  ┌──────▼──────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │  Services   │→ │  apiClient   │→ │  Node backend /api   │ │
│  └─────────────┘  └──────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

- **No Redux/Zustand** — state lives in React Context, custom hooks, component `useState`, and browser storage.
- **Lazy-loaded routes** — audit pages are code-split via `React.lazy()` + `Suspense`.
- **Config-driven audits** — Sales/Purchase variants share one page implementation with different config objects.

---

## Entry Points

| File | Role |
|------|------|
| `index.html` | Document shell; inline theme bootstrap from `localStorage`; loading skeleton; loads `/src/main.jsx` |
| `src/main.jsx` | Creates React root; wraps app in `BrowserRouter` + `AppUiProvider`; mounts `ThemedToaster` |
| `src/App.jsx` | Thin root — renders `<AppRoutes />` |
| `src/routes/AppRoutes.jsx` | All route definitions, auth guards, lazy page loading |

---

## Routing

Routes are defined in `src/routes/AppRoutes.jsx`.

### Auth guards

| Component | Purpose |
|-----------|---------|
| `RequireAuth` | Protects authenticated routes; runs `bootstrapAuthSession()` before rendering |
| `GuestRoute` | Redirects logged-in users away from login pages |

### Layout

All protected routes render inside `AppLayout` (sidebar + top navbar + animated page outlet).

### Route map

#### Public / guest

| Path | Page |
|------|------|
| `/login` | Login |
| `/forgot-password` | Forgot Password |
| `/reset-password` | Reset Password |

#### Platform

| Path | Page |
|------|------|
| `/` | Redirect → `/dashboard` |
| `/dashboard` | Dashboard |
| `/scrutiny` | Scrutiny Hub (module launcher) |
| `/vouching` | Vouching Hub |
| `/reports` | Reports |
| `/settings` | Settings |
| `/profile` | Profile |
| `/users` | Users |

#### Scrutiny audits

| Path | Page | File |
|------|------|------|
| `/scrutiny/pan` | PAN / ID Proof Audit | `PanVerification.jsx` |
| `/scrutiny/gross-weight` | Sales Gross Weight | `GrossWeight.jsx` |
| `/scrutiny/purchase/gross-weight` | Purchase Gross Weight | `PurchaseGrossWeight.jsx` |
| `/scrutiny/sales-ledger` | Sales Rate & Ledger | `SalesPage.jsx` |
| `/scrutiny/purchase/rate-ledger` | Purchase Rate & Ledger | `PurchasePage.jsx` |
| `/scrutiny/purchase/return-rate` | Purchase Return Audit | `PurchaseReturnPage.jsx` |
| `/scrutiny/sales-return-rate` | Sales Return Audit | `SalesReturnPage.jsx` |
| `/scrutiny/cash-ledger` | Cash Ledger Audit | `CashLedgerPage.jsx` |
| `/scrutiny/negative-bank` | Negative Bank Audit | `NegativeBankPage.jsx` |
| `/scrutiny/rate-rule-book` | Metal Rate Rule Book | `RateRuleBook.jsx` |
| `/scrutiny/rate-rules` | Alias → Rate Rule Book | same |
| `/scrutiny/rule-book` | Alias → Rate Rule Book | same |
| `/scrutiny/diamond-gem-rates` | Diamond/Gem Rates | `DiamondGemRateBook.jsx` |
| `/scrutiny/tds/rule-book` | TDS Rule Book | `TdsPage.jsx` |
| `/scrutiny/tds/party-wise-summary` | Party-Wise TDS Summary | `PartyWiseTdsSummaryPage.jsx` |
| `/scrutiny/tds/rate-0.1` | TDS @ 0.1% Audit | `TdsRate01Page.jsx` |
| `/scrutiny/section44ab` | Section 44AB Cash & Bank | `Section44ABPage.jsx` |
| `/sales-audit/product-average-rates` | Product Average Rates | `ProductAverageRates.jsx` |
| `/scrutiny/making-charges` | Coming Soon | `ModuleSoon.jsx` |
| `/scrutiny/duplicate-invoice` | Coming Soon | `ModuleSoon.jsx` |
| `/scrutiny/vendor-reconciliation` | Coming Soon | `ModuleSoon.jsx` |

#### Vouching (placeholders)

| Path | Page |
|------|------|
| `/vouching/voucher-matching` | `VouchingHold.jsx` |
| `/vouching/ledger-review` | `VouchingHold.jsx` |
| `/vouching/entry-verification` | `VouchingHold.jsx` |

**Catch-all:** unknown paths redirect to `/dashboard`.

---

## `src/pages/` — Page Layer

30 page files. Three main patterns:

### Pattern A — Config-driven wrappers

Sales/Purchase variants share one implementation + config:

| Wrapper | Shared implementation | Config file |
|---------|----------------------|-------------|
| `SalesPage.jsx` | `LedgerAuditPage.jsx` | `config/ledgerAuditConfig.js` |
| `PurchasePage.jsx` | `LedgerAuditPage.jsx` | `config/ledgerAuditConfig.js` |
| `GrossWeight.jsx` | `GrossWeightAuditPage.jsx` | `config/grossWeightAuditConfig.js` |
| `PurchaseGrossWeight.jsx` | `GrossWeightAuditPage.jsx` | `config/grossWeightAuditConfig.js` |
| `PurchaseReturnPage.jsx` | `SalesReturnPage.jsx` | `config/salesReturnAuditConfig.js` |

### Pattern B — Standalone audit pages

Each implements the full audit workspace UX:

- `PanVerification.jsx`
- `CashLedgerPage.jsx`
- `NegativeBankPage.jsx`
- `TdsRate01Page.jsx`
- `PartyWiseTdsSummaryPage.jsx`
- `Section44ABPage.jsx`

### Pattern C — Rule-book / CRUD (no file upload)

- `RateRuleBook.jsx` — metal rate rules
- `TdsPage.jsx` — TDS rule book
- `DiamondGemRateBook.jsx` — diamond/gem rates
- `ProductAverageRates.jsx` — sales product averages

### Hub & placeholder pages

- `ScrutinyHub.jsx` — card grid linking to scrutiny modules
- `VouchingHub.jsx` — vouching module launcher
- `ModuleSoon.jsx` — "coming soon" placeholder
- `VouchingHold.jsx` — vouching placeholder

### Common audit workspace UX (Patterns A & B)

1. `FileUploadZone` — drag-and-drop Excel upload (`.xlsx`, `.xls`, `.xlsm`)
2. `AuditValidationOverlay` — full-screen processing spinner
3. `AuditSummaryWidget` + `AuditSummaryGrid` + `KpiCard` — result KPIs
4. `AuditFilterStrip` — filter by exception category
5. `AuditUploadResultsTable` — paginated TanStack table
6. `AuditSessionBanner` + `useAuditSessionPersistence` — restore/save workspace
7. Export toolbar — Excel (client or server), CSV, PDF

---

## `src/components/` — Component Layer

```
components/
├── auth/           # Authentication UI and route guards
├── layout/         # App shell (sidebar, navbar, skeletons)
├── ui/             # Design system primitives
├── audit/          # Shared audit workspace widgets
├── tables/         # Data table components
├── cards/          # Dashboard and hub cards
├── charts/         # ApexCharts wrappers
└── upload/         # File upload zone
```

### `auth/`

| File | Description |
|------|-------------|
| `RequireAuth.jsx` | Blocks routes until auth session is bootstrapped |
| `GuestRoute.jsx` | Redirects authenticated users away from login |
| `SessionBootstrap.jsx` | Deprecated alias for `RequireAuth` |
| `AuditSearchIllustration.jsx` | Login page illustration |
| `AuditIntelligenceBackground.jsx` | Login background visuals |

### `layout/`

| File | Description |
|------|-------------|
| `AppLayout.jsx` | Sidebar + TopNavbar + animated page outlet |
| `Sidebar.jsx` | Navigation; preloads audit routes on hover |
| `TopNavbar.jsx` | Page header bar |
| `NotificationBell.jsx` | Notification dropdown |
| `AppShellSkeleton.jsx` | Loading skeletons |
| `LoginSkeleton.jsx` | Login / lazy-route fallback |

### `ui/`

Core design system: `Button`, `Input`, `Card`, `Badge`, `CustomSelect`, `Pagination`, `Skeleton`, `ChartSkeleton`, `EmptyState`, `ThemeToggle`, `ThemedToaster`, `AuditValidationOverlay`.

### `audit/`

| File | Description |
|------|-------------|
| `AuditFilterStrip.jsx` | Filter chips for exception categories |
| `AuditSessionBanner.jsx` | Saved session restore / new audit banner |
| `AuditSummaryGrid.jsx` | KPI summary grid for audit results |

### `tables/`

| File | Description |
|------|-------------|
| `AuditUploadResultsTable.jsx` | Generic TanStack Table for audit rows |
| `SalesReturnRateComparisonTable.jsx` | Sales return rate comparison table |

### `charts/`

| File | Description |
|------|-------------|
| `AuditActivityTrendChart.jsx` | Audit activity line chart |
| `IssuesByCategoryBarChart.jsx` | Issue breakdown bar chart |
| `IssuesByCategoryPanel.jsx` | Issue category panel |

### `upload/`

| File | Description |
|------|-------------|
| `FileUploadZone.jsx` | Drag-and-drop Excel upload |

---

## `src/services/` — API Layer

All HTTP calls go through a shared Axios client.

| File | Description |
|------|-------------|
| `apiClient.js` | Shared Axios instance; Bearer auth; 401 refresh interceptor |
| `auth.service.js` | Login, logout, forgot/reset password |
| `sales.service.js` | Sales ledger validation, export, product average rates |
| `purchase.service.js` | Purchase ledger validation |
| `salesReturn.service.js` | Sales return audit, rate comparison, exports |
| `purchaseReturn.service.js` | Purchase return audit (mirrors sales return) |
| `grossWeight.service.js` | Gross weight validation and export |
| `pan.service.js` | PAN/ID proof validation and export |
| `cashLedger.service.js` | Cash ledger validation and export |
| `negativeBank.service.js` | Negative bank validation and export |
| `tds.service.js` | TDS rule book CRUD |
| `tds01.service.js` | TDS @ 0.1% validation and report export |
| `partyWiseTds.service.js` | Party-wise TDS summary validation/export |
| `rateRule.service.js` | Metal rate rule book fetch/save |
| `rateBook.service.js` | Diamond/gem rate book fetch/save |
| `section44ab.service.js` | Section 44AB multi-file validation |
| `dashboard.service.js` | Dashboard widgets, trends, issues, recent audits |
| `notification.service.js` | Fetch/mark-read notifications |
| `auditSession.service.js` | Optional remote DB audit session sync |
| `scrutinyExport.js` | Shared blob download helper for server Excel exports |

### Typical audit service flow

```
FormData upload → POST /api/v1/process/{module}/validate → JSON result
Optional export → POST /api/v1/process/{module}/export-* → Excel blob
```

Base URL is configured in `src/config/api.js` (`VITE_API_BASE_URL`).

---

## `src/utils/` — Utilities

### Auth & session

| File | Description |
|------|-------------|
| `authUser.js` | Token/user storage, refresh, bootstrap, redirect-to-login |
| `auditSessionStorage.js` | User-scoped localStorage for audit workspaces (7-day TTL) |
| `auditRoutePreload.js` | Preload audit page chunks on sidebar hover |

### Formatting & UI

| File | Description |
|------|-------------|
| `cn.js` | `clsx` + `tailwind-merge` class combiner |
| `format.js` | Number/percent formatting |
| `dateTime.js` | Date/time display helpers |
| `auditToast.js` / `auditToast.jsx` | Toast wrappers for audit success/error |
| `processingErrorUtils.js` | Human-readable API/processing errors |

### Per-audit filters & columns

| File | Audit |
|------|-------|
| `salesRecordFilters.js` | Sales / return |
| `grossRecordFilters.js`, `grossTableColumns.js` | Gross weight |
| `panRecordFilters.js` | PAN |
| `cashLedgerRecordFilters.js`, `cashLedgerTableColumns.js`, `cashLedgerTotalErrorReport.js` | Cash ledger |
| `negativeBankRecordFilters.js`, `negativeBankTableColumns.js` | Negative bank |
| `auditTableColumns.js` | Shared column order / export mapping |

### Dashboard helpers

| File | Description |
|------|-------------|
| `dashboardWidgets.js` | Dashboard data shaping |
| `dashboardRecentAudits.js` | Recent audit list formatting |
| `dashboardIssueCategories.js` | Issue category breakdown |

### Export utilities

| File | Format | Description |
|------|--------|-------------|
| `csvExport.js` | CSV | `exportRowsToCsv(filename, columns, rows)` |
| `pdfExport.js` | PDF | `exportRowsToPdf(filename, title, columnDefs, rows)` via jsPDF |
| `salesReturnXlsxExport.js` | XLSX | Exception and row downloads |
| `grossXlsxExport.js` | XLSX | Gross weight record export |
| `panXlsxExport.js` | XLSX | PAN record export |
| `auditMultiSheetExcelExport.js` | XLSX | Multi-sheet workbooks |
| `cashLedgerTotalErrorReport.js` | XLSX | One sheet per audit rule |

Server-generated Excel exports are handled via `services/scrutinyExport.js` and per-module service export functions.

---

## `src/hooks/`

| Hook | Description |
|------|-------------|
| `useAuditSessionPersistence.js` | Auto-save/restore audit workspace to `localStorage` |
| `useAnimatedNumber.js` | Animated KPI counters for dashboard metrics |

---

## `src/context/`

| File | Description |
|------|-------------|
| `AppUiContext.jsx` | Theme (dark/light), sidebar collapse, active division, session stats, activity feed |

Theme is persisted to `localStorage` under key `audit-platform-theme`.

---

## `src/config/`

| File | Description |
|------|-------------|
| `api.js` | `VITE_API_BASE_URL` with localhost fallback |
| `auditSessionConfig.js` | Registry mapping audit types → routes + localStorage keys |
| `ledgerAuditConfig.js` | Sales vs Purchase ledger audit configs |
| `grossWeightAuditConfig.js` | Sales vs Purchase gross weight configs |
| `salesReturnAuditConfig.js` | Sales vs Purchase return audit configs |

---

## `src/constants/`

| File | Description |
|------|-------------|
| `tdsRuleBook.js` | Static TDS rule book defaults |
| `metalRateRuleBook.js` | Metal product list and variation percentages |

---

## `src/types/`

| File | Description |
|------|-------------|
| `dashboard.js` | JSDoc typedefs for dashboard API response shapes |

---

## State Management

No global state library. Patterns used:

| Mechanism | Usage |
|-----------|-------|
| **React Context** | `AppUiContext` — theme, sidebar, session stats |
| **Custom hooks** | `useAuditSessionPersistence` — per-audit workspace persistence |
| **Component state** | `useState` for file, results, filters, loading on audit pages |
| **sessionStorage** | Auth token when "Remember me" is off |
| **localStorage** | Auth token when "Remember me" is on; theme; audit workspaces |

### Audit session storage

Key pattern: `audit_session_{userId}_{suffix}`

Registry in `config/auditSessionConfig.js` maps each audit type to its route and storage suffix. Workspaces expire after 7 days.

---

## Authentication Flow

```
Login.jsx
  └─ POST /api/auth/login (credentials: include → HttpOnly refresh cookie)
  └─ persistAuthSession({ accessToken, user, rememberMe })
       ├─ rememberMe=true  → localStorage
       └─ rememberMe=false → sessionStorage

RequireAuth (on mount)
  └─ bootstrapAuthSession() [utils/authUser.js]
       ├─ No token → tryRefreshAccessToken() via POST /api/auth/refresh
       ├─ fetchCurrentUser() → GET /api/auth/me
       └─ Failure → clearAuthSession() → redirect /login

apiClient.js
  └─ Request interceptor: attach Bearer token
  └─ Response interceptor: on 401 → refresh → retry once → else redirectToLogin()
```

Key files: `pages/Login.jsx`, `utils/authUser.js`, `components/auth/RequireAuth.jsx`, `services/auth.service.js`.

---

## Export Strategy

Most audit pages offer three export formats:

| Format | Where generated | Utility / service |
|--------|-----------------|-------------------|
| **Excel** | Server (primary) or client | `scrutinyExport.js`, `*.service.js` export endpoints, or `*XlsxExport.js` |
| **CSV** | Client | `utils/csvExport.js` |
| **PDF** | Client | `utils/pdfExport.js` |

---

## Environment Variables

Create a `.env` file in the frontend root. Only `VITE_*` variables are exposed to the client.

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_BASE_URL` | `http://localhost:4002` | Backend API base URL |
| `VITE_API_TIMEOUT_MS` | `900000` (15 min) | Axios request timeout |
| `VITE_DEV_PORT` | `4000` | Vite dev server port |
| `VITE_BACKEND_PORT` | `4002` | Backend port for dev proxy target |

In production (e.g. Vercel), set `VITE_API_BASE_URL` to the deployed backend URL.

---

## Build & Deployment

```bash
npm run build    # Output → dist/
npm run preview  # Serve dist/ locally
```

`vercel.json` configures SPA fallback rewrites so client-side routing works on static hosts.

Tailwind v4 is configured inline in `src/index.css` via `@import 'tailwindcss'` and `@theme` tokens — there is no separate `tailwind.config.js`.

---

## Adding a New Scrutiny Module

1. **Page** — create `src/pages/MyAuditPage.jsx` following Pattern B (standalone) or extend a shared page with config (Pattern A).
2. **Service** — add `src/services/myAudit.service.js` with validate/export functions using `apiClient`.
3. **Utils** — add filters/columns/export helpers under `src/utils/` if needed.
4. **Route** — register in `src/routes/AppRoutes.jsx` under `/scrutiny/...`.
5. **Hub** — add a card in `src/pages/ScrutinyHub.jsx`.
6. **Sidebar** — add navigation entry in `src/components/layout/Sidebar.jsx`.
7. **Session** (optional) — register in `src/config/auditSessionConfig.js` for workspace persistence.

---

## Related Documentation

- Root project README: `../README.md`
- Backend API gateway: `../backend/`
- Python audit engines: `../python-service/`
