# Frontend Development Handbook

This document describes **how the React frontend actually works today**. Copy patterns from completed audits (Cash Ledger, Negative Bank, Sales/Purchase ledger, TDS, Section 44AB). Do not invent a new UI architecture.

The frontend never talks to the Python service. All audit traffic goes:

```text
Frontend
    ↓
Backend API (Express)
    ↓
Audit Service (Node)
    ↓
Python Service (FastAPI)
    ↓
Audit Engine
    ↓
Validation Rules
    ↓
Results
    ↓
Database / API response
    ↓
Frontend
```

Related handbooks:

- [BACKEND_DEVELOPMENT.md](./BACKEND_DEVELOPMENT.md)
- [PYTHON_SERVICE_DEVELOPMENT.md](./PYTHON_SERVICE_DEVELOPMENT.md)

---

## 1. Technology and project structure

**Location:** `frontend/`

| Piece | Actual stack |
|--------|----------------|
| UI | React `^19.2.5` |
| Bundler | Vite `^8.0.10` (`frontend/vite.config.js`) |
| Routing | React Router DOM `^7.14.2` |
| HTTP | Axios (`frontend/src/services/apiClient.js`) |
| Styling | Tailwind CSS `^4` via `@tailwindcss/vite` + CSS variables |
| Tables | `@tanstack/react-table` |
| Motion / icons | Framer Motion, Lucide React |
| Toasts | `react-hot-toast` via `ThemedToaster` |
| Charts | ApexCharts (dashboard) |
| Client Excel | `xlsx` |
| Client PDF | `jspdf` + `jspdf-autotable` |

There is **no** Redux, Zustand, TanStack Query, React Hook Form, Zod, or Yup.

**Dev server:** `VITE_DEV_PORT` or **4000** (not Vite’s default 5173).  
**API proxy:** `/api` → `http://127.0.0.1:${VITE_BACKEND_PORT \|\| 4002}` with **900s** timeout for large Excel uploads (`frontend/vite.config.js`).

**Default API base:** `VITE_API_BASE_URL` or `http://localhost:4002` (`frontend/src/config/api.js`). Axios uses this absolute base, so the Vite proxy is used only if the browser hits same-origin `/api`. **Needs confirmation:** production always sets `VITE_API_BASE_URL` to the public backend origin.

### Folder layout

```text
frontend/src/
  main.jsx                 # BrowserRouter, ThemedToaster, App
  App.jsx                  # renders AppRoutes only
  routes/AppRoutes.jsx     # all routes
  pages/                   # route screens
  components/
    auth/                  # RequireAuth, GuestRoute
    layout/                # AppLayout, Sidebar, TopNavbar
    ui/                    # Button, Input, Card, Pagination, toaster
    audit/                 # summary grid, filters, session banner
    upload/                # FileUploadZone
    tables/                # AuditUploadResultsTable
    cards/                 # KpiCard, AuditSummaryWidget, ServiceCard
  services/                # one *.service.js per API domain + apiClient
  hooks/
  config/                  # api.js, ledger/gross-weight/sales-return configs
  utils/
  constants/
  context/AppUiContext.jsx
```

---

## 2. Pages and routing

Router: `frontend/src/routes/AppRoutes.jsx`. Pages are `lazy()`-loaded. `App.jsx` only renders `<AppRoutes />`. `BrowserRouter` lives in `main.jsx`.

### Guest routes (`GuestRoute`)

| Path | Page |
|------|------|
| `/login` | `pages/Login.jsx` |
| `/forgot-password` | `pages/ForgotPassword.jsx` |

### Public (neither guest nor auth wrapper)

| Path | Page |
|------|------|
| `/reset-password` | `pages/ResetPassword.jsx` |

### Authenticated (`RequireAuth` → `AppLayout`)

| Path | Page |
|------|------|
| `/` | redirect → `/dashboard` |
| `/dashboard` | `Dashboard.jsx` |
| `/scrutiny` | `ScrutinyHub.jsx` |
| `/financials` | `FinancialsHub.jsx` |
| `/vouching` | `VouchingHub.jsx` |
| `/reports` | `Reports.jsx` |
| `/settings` | `Settings.jsx` |
| `/profile` | `Profile.jsx` |
| `/users` | `Users.jsx` |
| `/demo-videos` | `DemoVideosPage.jsx` |
| `/scrutiny/pan` | `PanVerification.jsx` |
| `/scrutiny/gross-weight` | `GrossWeight.jsx` → `GrossWeightAuditPage` |
| `/scrutiny/purchase/gross-weight` | `PurchaseGrossWeight.jsx` → same shared page |
| `/scrutiny/sales-ledger` | `SalesPage.jsx` → `LedgerAuditPage` |
| `/scrutiny/purchase/rate-ledger` | `PurchasePage.jsx` → `LedgerAuditPage` |
| `/scrutiny/purchase/return-rate` | `PurchaseReturnPage.jsx` → `SalesReturnPage` |
| `/scrutiny/cash-ledger` | `CashLedgerPage.jsx` |
| `/scrutiny/negative-bank` | `NegativeBankPage.jsx` |
| `/sales-audit/product-average-rates` | `ProductAverageRates.jsx` |
| `/scrutiny/sales-return-rate` | `SalesReturnPage.jsx` |
| `/scrutiny/rate-rule-book` (+ aliases `/scrutiny/rate-rules`, `/scrutiny/rule-book`) | `RateRuleBook.jsx` |
| `/scrutiny/diamond-gem-rates` | `DiamondGemRateBook.jsx` |
| `/scrutiny/tds/rule-book` | `TdsPage.jsx` |
| `/scrutiny/tds/party-wise-summary` | `PartyWiseTdsSummaryPage.jsx` |
| `/scrutiny/tds/rate-0.1` | `TdsRate01Page.jsx` |
| `/scrutiny/section44ab` | `Section44ABPage.jsx` |
| `/financials/closing-stock` | `FinancialsPivotPage.jsx` |
| `/financials/first-audit` | redirect → closing-stock |
| `/scrutiny/making-charges`, `/scrutiny/duplicate-invoice`, `/scrutiny/vendor-reconciliation` | `ModuleSoon.jsx` |
| `/vouching/*` | `VouchingHold.jsx` |
| `*` | redirect → `/dashboard` |

Auth-page Suspense fallback: `LoginSkeleton`. Layout pages: `PageContentSkeleton`.

---

## 3. Layout and sidebar

There is **no** `AppShell.jsx`. The shell is `components/layout/AppLayout.jsx`:

- `Sidebar` (sticky; width 280 / 80)
- `TopNavbar` — **hidden** on `/dashboard` and `/`
- `<Outlet />` inside Framer Motion + Suspense

**Sidebar groups** (`components/layout/Sidebar.jsx`):

- Dashboard
- **Scrutiny** — Sales, Purchase, Cash, Other Features (Section 44AB), Gold & Silver Rates, Rate Master
- **TDS Audit** — **ADMIN only** (`canShowAdminOnlyFeature`)
- **Negative Bank** — **ADMIN only**, badge `PENDING`
- **Financials** — Closing Stock
- **Vouching** — **ADMIN only**; children are `DisabledItem` (“Hold”)
- Users, Settings
- User menu: Profile, Settings, Log Out

`isAdminRole` is **only** `role.toUpperCase() === 'ADMIN'`. Hover/focus on nav items calls `preloadAuditRoute(to)`.

**`TopNavbar` `TITLE_MAP`:** TDS and Section 44AB paths are **not** mapped, so those pages show **"Overview"**. When adding a page, add a title entry.

---

## 4. Reusable UI components

| Component | Path | Use |
|-----------|------|-----|
| `Button` | `components/ui/Button.jsx` | `primary` / `secondary` / `ghost` / `danger`; sizes `sm`/`md`/`lg`; `loading` |
| `Input` | `components/ui/Input.jsx` | Text fields |
| `CustomSelect` | `components/ui/CustomSelect.jsx` | `{ value, label }` |
| `Card`, `CardHeader`, `CardBody` | `components/ui/Card.jsx` | Panels |
| `Badge` | `components/ui/Badge.jsx` | Tones: default, blue, amber, rose, emerald, violet, slate |
| `EmptyState` | `components/ui/EmptyState.jsx` | Idle / no-rows |
| `Pagination` | `components/ui/Pagination.jsx` | TanStack page sizes |
| `ThemedToaster` | `components/ui/ThemedToaster.jsx` | Top-right, **88px** from top (do not cover user chip) |
| `AuditValidationOverlay` | `components/ui/AuditValidationOverlay.jsx` | Full-screen processing |
| `FileUploadZone` | `components/upload/FileUploadZone.jsx` | Excel dropzone |
| `AuditUploadResultsTable` | `components/tables/AuditUploadResultsTable.jsx` | Results grid |
| `AuditSummaryGrid` / `AuditSummaryWidget` | `components/audit` + `components/cards` | Clickable KPI filters |
| `AuditFilterStrip` | `components/audit/AuditFilterStrip.jsx` | Active filter chips |
| `AuditSessionBanner` | `components/audit/AuditSessionBanner.jsx` | Restore / start new |
| `ServiceCard` | `components/cards/ServiceCard.jsx` | Hub cards |
| `KpiCard` | `components/cards/KpiCard.jsx` | Ledger “Product Average Rates” |

---

## 5. Forms and validation

No schema form library. Patterns:

| Surface | Validation |
|---------|------------|
| Login / forgot password | HTML `required`; Login retries 502/503/504 |
| Reset password | Min 6 characters; passwords must match |
| Users modal | HTML `required` on name/email; password required on create |
| Rate Rule Book | `parseRate()` — finite number `> 0` or `null` |
| Audit pages | Client: “choose a file first”. Layout errors come from the API (`formatProcessingErrorHuman`) |

---

## 6. Tables, pagination, filtering, sorting

Shared results table: `AuditUploadResultsTable`.

- Global text search across cell values
- `getSortedRowModel` is registered; **column headers are not click-to-sort**
- Page sizes: 10, 20, 25, 50, 100 (`Pagination`)
- Filter chips: `AuditFilterStrip` + clickable `AuditSummaryWidget`s

Issue filters live in module utils, e.g. `utils/cashLedgerRecordFilters.js` (`filterCashLedgerRecords`, `countCashLedgerRecordsByIssue`).

**Other tables:** `SalesReturnRateComparisonTable`, closing-stock preview, Section 44AB raw HTML table, `ProductAverageRates` (TanStack + server `page`/`limit=25`), dashboard recent audits (page size 5), Users card grid.

Deprecated alias: `SalesReturnExceptionTable` — keep for existing callers.

---

## 7. Dashboard / summary cards

`Dashboard.jsx` uses `dashboard.service.js`:

- `fetchDashboardWidgets`
- `fetchDashboardAuditTrend`
- `fetchDashboardIssuesCategory`
- `fetchDashboardRecentAudits`

Period: week / month / year. UI persist key `dashboard-ui` in `auditSessionStorage`.

Audit pages use `AuditSummaryGrid` + widgets (Total rows, Error rows, issue categories, Compliance). Clicking a widget sets `activeFilter`.

---

## 8. Audit module UI structure

### Shared workspace pages (config wrappers)

| Wrapper | Shared page | Config |
|---------|-------------|--------|
| `SalesPage` | `LedgerAuditPage` | `SALES_LEDGER_AUDIT_CONFIG` |
| `PurchasePage` | `LedgerAuditPage` | `PURCHASE_LEDGER_AUDIT_CONFIG` |
| `GrossWeight` | `GrossWeightAuditPage` | `SALES_GROSS_WEIGHT_AUDIT_CONFIG` |
| `PurchaseGrossWeight` | `GrossWeightAuditPage` | `PURCHASE_GROSS_WEIGHT_AUDIT_CONFIG` |
| `PurchaseReturnPage` | `SalesReturnPage` | `PURCHASE_RETURN_AUDIT_CONFIG` |

### Standalone audit pages

`PanVerification`, `CashLedgerPage`, `NegativeBankPage`, `Section44ABPage`, `TdsRate01Page`, `PartyWiseTdsSummaryPage`

### Rule-book pages (no Excel validate)

`TdsPage`, `RateRuleBook`, `DiamondGemRateBook`

### Canonical page stack (Cash / Negative Bank / ledger / TDS 0.1%)

1. `AuditValidationOverlay`
2. Upload `Card` + `FileUploadZone` + Start/Run + optional `WatchDemoButton`
3. `AuditSessionBanner`
4. Rose `Card` for sheet-layout errors
5. `AuditSummaryGrid`
6. Results `Card` + `AuditFilterStrip` + `AuditUploadResultsTable` + Excel/CSV/PDF
7. `EmptyState` when idle or no issues

**Section 44AB is different:** two multi-file dropzones, no `useAuditSessionPersistence`, no `AuditUploadResultsTable`, custom HTML table, CSV-only export in-page.

**Party-Wise TDS:** two named files (`purchaseGoodsFile`, `tdsPayableFile`), merged summaries with a `source` field.

---

## 9. File upload UI

`FileUploadZone`:

- Accept: `.xlsx,.xls,.xlsm` (+ spreadsheet MIME types)
- Single: `file` / `onFileChange`
- Multi: `multiple` + `files` / `onFilesChange`
- Drag-and-drop, browse, remove chip
- Disabled while `loading`

Section 44AB uses `multiple` (cash files + bank files). Party-Wise TDS uses two zones.

---

## 10. Upload → API → processing → results

Canonical flow (Cash Ledger, Negative Bank, Sales, TDS 0.1%):

1. User picks a file → `setFile`
2. Click Start/Run
3. Guard: no file → `auditToastError('Choose an Excel file first.')`
4. `setLoading(true)` → overlay
5. Service builds `FormData`, field **`file`**, `POST` via `apiClient`
6. Success (`success !== false`): `setResult(data)`, clear `sheetError`, persist snapshot, `auditToastSuccess`
7. Soft fail (`data.success === false`): toast + `setSheetError`
8. Thrown error: `e.details` → sheet error card; toast `e.message`
9. Result drives widgets, filters, table, exports

Ledger audits also require gold/silver rates (`fetchRateRules` + `hasConfiguredRateRules`) before the Run button is enabled.

---

## 11. API client and how the frontend calls the backend

### Axios client

`frontend/src/services/apiClient.js`:

- `baseURL = API_BASE_URL`
- `timeout` = `VITE_API_TIMEOUT_MS` or **900000**
- `withCredentials: true` (refresh cookie)
- Request interceptor: `Authorization: Bearer ${getAuthToken()}`
- Response interceptor: on **401**, `tryRefreshAccessToken()` once, retry; else `redirectToLogin()`
- Skip refresh for `/api/auth/refresh`, `/api/auth/login`, `/api/auth/logout`

`getApiErrorMessage(error)` reads `detail`, `message`, and missing-columns suffix.

### Three HTTP styles

1. **`apiClient`** — most audit, dashboard, notification, demo services
2. **`fetch` + `API_BASE_URL`** — auth (`auth.service.js` / `authUser.js`), Login retries, Users `apiRequest`
3. **Vite `/api` proxy** — same-origin `/api` only

Typical validate call (`frontend/src/services/cashLedger.service.js`):

```js
export async function validateCashLedgerExcel(file, signal) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post('/api/v1/process/cash-ledger/validate', form, {
    headers: { 'Content-Type': 'multipart/form-data', ...authHeaders() },
    signal,
  });
  return data;
}
```

On failure, services attach `e.details = getProcessingErrorPayload(err)` (axios `response.data`) so the page can render the sheet-layout card.

### Audit pages ↔ services ↔ Node paths

| UI route | Page | Service | Primary Node API |
|----------|------|---------|------------------|
| `/scrutiny/pan` | `PanVerification.jsx` | `pan.service.js` | `POST /api/v1/process/pan/validate` |
| `/scrutiny/gross-weight` | `GrossWeight.jsx` | `grossWeight.service.js` | `POST /api/v1/process/gross-weight/validate` |
| `/scrutiny/purchase/gross-weight` | `PurchaseGrossWeight.jsx` | same | same |
| `/scrutiny/sales-ledger` | `SalesPage.jsx` | `sales.service.js` + `rateRule.service.js` | `POST /api/v1/process/sales/validate` |
| `/scrutiny/purchase/rate-ledger` | `PurchasePage.jsx` | `purchase.service.js` + `rateRule.service.js` | `POST /api/v1/process/purchase/validate` |
| `/scrutiny/sales-return-rate` | `SalesReturnPage.jsx` | `salesReturn.service.js` | `POST /api/sales-return/run-audit` (legacy mount) |
| `/scrutiny/purchase/return-rate` | `PurchaseReturnPage.jsx` | `purchaseReturn.service.js` | `POST /api/purchase-return/run-audit` |
| `/scrutiny/cash-ledger` | `CashLedgerPage.jsx` | `cashLedger.service.js` | `POST /api/v1/process/cash-ledger/validate` |
| `/scrutiny/negative-bank` | `NegativeBankPage.jsx` | `negativeBank.service.js` | `POST /api/v1/process/negative-bank/validate` |
| `/scrutiny/section44ab` | `Section44ABPage.jsx` | `section44ab.service.js` | `POST /api/v1/process/section44ab/validate` |
| `/scrutiny/tds/rate-0.1` | `TdsRate01Page.jsx` | `tds01.service.js` | `POST /api/v1/process/tds-rate-0.1/validate` |
| `/scrutiny/tds/party-wise-summary` | `PartyWiseTdsSummaryPage.jsx` | `partyWiseTds.service.js` | `POST /api/v1/process/party-wise-tds/validate` |
| `/scrutiny/tds/rule-book` | `TdsPage.jsx` | `tds.service.js` | `GET/POST /api/v1/tds-rules` |
| `/scrutiny/rate-rule-book` | `RateRuleBook.jsx` | `rateRule.service.js` | `GET/POST /api/v1/rate-rules` |
| `/scrutiny/diamond-gem-rates` | `DiamondGemRateBook.jsx` | `rateBook.service.js` | `GET/POST /api/v1/rate-book/diamonds` |
| `/sales-audit/product-average-rates` | `ProductAverageRates.jsx` | `sales.service.js` | `GET /api/sales-audit/product-average-rates` |
| `/financials/closing-stock` | `FinancialsPivotPage.jsx` | `financials.service.js` | `POST /api/v1/process/financials/validate` |

`auditSession.service.js` (`/api/audit-sessions/*`) exists but **no audit page imports it**. Pages persist locally (see §14).

---

## 12. Authentication

**Login** (`Login.jsx`): `POST ${API_BASE_URL}/api/auth/login` with `credentials: 'include'`. On `data.success`, `persistAuthSession({ accessToken, user, rememberMe, email })`, then navigate to `location.state.from`, `?redirect=`, or `/dashboard`.

**Storage** (`utils/authUser.js`):

- Keys: `accessToken` (legacy `token`), `user`, `isAuthenticated`, `rememberMe`, `rememberedEmail`
- Remember me → `localStorage`; else → `sessionStorage`

**Bootstrap:** if no token, refresh cookie; then `GET /api/auth/me` with Bearer; persist `data.user`.

**Refresh:** `POST /api/auth/refresh` (cookie path on the backend is `/api/auth` — use this path, not `/api/v1/auth/refresh`).

**Logout:** `POST /api/auth/logout` then `clearAuthSession()` → `/login`.

Password reset: `auth.service.js` → `/api/v1/auth/forgot-password` and `/api/v1/auth/reset-password*`.

`SessionBootstrap.jsx` is a **deprecated alias** of `RequireAuth`. Do not add new imports of it.

---

## 13. Authorization / RBAC / Admin vs Auditor vs Viewer

Prisma roles: **`ADMIN`**, **`AUDITOR`**, **`VIEWER`**.

| Surface | Behavior |
|---------|----------|
| Sidebar | TDS, Negative Bank, Vouching only if `ADMIN` |
| Users API (backend) | `authorize(['ADMIN', 'SUPER_ADMIN'])` |
| Users form | Role dropdown: ADMIN / AUDITOR / VIEWER; default create role `AUDITOR` |
| Profile / Demo Videos | Treat `ADMIN` **or** `SUPER_ADMIN` as admin UI |
| Audit routes | **Any authenticated user** can open the URL |

There is **no** `RequireRole` component. Hiding a sidebar item is **not** a route guard.

**Auditor vs Viewer:** no frontend capability split (same buttons, same APIs). **Needs confirmation:** whether Viewer is intended to be read-only (backend currently allows all authenticated roles to POST validate).

**SUPER_ADMIN:** not a Prisma enum; cannot be created via Users UI. Sidebar ignores it; Profile/Demo Videos honor it. **Needs confirmation** which is intended.

---

## 14. Protected routes

- `RequireAuth`: `bootstrapAuthSession()` → `AppShellSkeleton` while loading → guests `Navigate` to `/login` with `state.from` → else `<Outlet />`
- `GuestRoute`: opposite for login/forgot-password
- `/reset-password` is **not** behind either wrapper
- Wildcard `*` inside auth layout → `/dashboard`

---

## 15. Loading, error, empty states

| State | Implementation |
|-------|----------------|
| Route lazy load | `LoginSkeleton` / `PageContentSkeleton` |
| Auth bootstrap | `AppShellSkeleton` |
| Audit processing | `AuditValidationOverlay` (cycling status messages) |
| Dashboard charts | `Skeleton`, `SummaryStripSkeleton`, `TableRowSkeleton` |
| Profile / Users / rule books | `Loader2` spinner |
| Sheet layout fail | Rose card + `formatProcessingErrorHuman` + optional JSON `<details>` |
| No results | `EmptyState` (“Awaiting validation”, “No issues detected”, “No rows for this filter”) |

---

## 16. Toast / notification patterns

Primary API: `utils/auditToast.jsx` (also exported as `auditToast.js`):

- `showAuditToast(message, type)`
- `auditToastSuccess` / `auditToastError` / `auditToastInfo`

`ThemedToaster` is mounted in `main.jsx` (top-right, z-index 9999).

**Do not** introduce a second toast library. Exceptions already in the code:

- `Users.jsx` — local `Toast` component
- `Dashboard.jsx` and `ProductAverageRates.jsx` — raw `react-hot-toast`
- `NotificationBell` — in-app notifications via `notification.service.js` (`/api/notifications`)

---

## 17. State management

- **React local state** on every page (`useState` / `useMemo` / `useCallback`)
- **`AppUiContext`:** sidebar collapse, theme (`audit-platform-theme`), `division`, session stats (`recordPanValidation`, `recordExport`)
- **Browser audit sessions:** `useAuditSessionPersistence` → **localStorage only**, 7-day TTL. Comment in code: latest completed validation always wins — **no server/DB sync**.
- Slim helpers in `utils/auditSessionStorage.js` (e.g. `slimCashLedgerSnapshot`) for large results
- `AUDIT_SESSION_REGISTRY` in `auditSessionConfig.js` — **Party-Wise TDS and Section 44AB are not registered**; 44AB has no session hook

---

## 18. API response / error handling

- Success: use Python fields as returned (`success`, `totalRows`, `errorRows`, `summary`, `records` / `exceptionRecords`, plus `auditRunId` from Node)
- Soft fail: `if (data && data.success === false)`
- Thrown axios errors: `getApiErrorMessage` + `getProcessingErrorPayload`
- Blob exports: if `content-type` is JSON, parse and throw `detail`
- Dashboard services throw if `!data.success`

---

## 19. Excel / CSV / PDF export

| Util | Path | Role |
|------|------|------|
| `exportRowsToCsv` | `utils/csvExport.js` | Client CSV |
| `exportRowsToPdf` | `utils/pdfExport.js` | jsPDF landscape A4 |
| `downloadRowsXlsx` / `downloadAuditExceptionXlsx` | `utils/salesReturnXlsxExport.js` | Client xlsx |
| `downloadGrossWeightRecordsXlsx` | `utils/grossXlsxExport.js` | Gross weight |
| `downloadPanRecordsXlsx` | `utils/panXlsxExport.js` | PAN |
| `exportInvalidRecordsXlsx` | `services/scrutinyExport.js` | `POST { records }` → blob from Node/Python |

Server exports (examples):

- Cash / Negative Bank / Sales / Purchase / PAN / Gross: `POST .../export-invalid`
- TDS 0.1%: `POST /api/v1/process/tds-rate-0.1/export`
- Party-Wise: `POST /api/v1/process/party-wise-tds/export`
- Sales Return: `/api/sales-return/export-*`

Section 44AB builds CSV **in the page** (`section44ab-report-*.csv`). There is **no** Node export route for 44AB.

---

## 20. Audit results and issue display

After `result` is set:

- Rows: `result.records` or `result.exceptionRecords` (ledger)
- Optional: `result.summary`, `totalRows`, `errorRows`, `exportColumns`, `columnDisplayHeaders`
- TDS 0.1%: `summaryRecords` + `detailedRecords`
- Party-Wise: `purchaseSummary` + `payableSummary`
- Section 44AB: `result.reportRows` + `result.summary`

Column order: `resolveAuditColumnOrder` or module resolvers (`resolveCashLedgerColumnOrder`, etc.). Message column via `auditCellValue(..., 'Message')`.

Row issues: `issues[]` / `issueCode` mapped in filter utils (`CASH_LEDGER_MESSAGES`, `SALES_ISSUE_MESSAGES`, …). **Issue codes and Message strings must stay aligned with Python** (see comments in `utils/salesRecordFilters.js`).

---

## 21. Naming and component conventions

- Pages: `*Page.jsx` for newer audits; older names (`GrossWeight`, `PanVerification`, `RateRuleBook`) remain
- Services: `*.service.js`; functions `validate*Excel` / `fetch*` / `export*` / `save*`
- Shared workspaces: `*AuditPage.jsx` + `*AuditConfig.js`
- Utils: `*RecordFilters.js`, `*TableColumns.js`, `*XlsxExport.js`
- Session keys: kebab-case (`cash-ledger`, `sales-ledger`, `tds-rate-0.1`)
- CSS: `cn()` + CSS variables (`--color-surface-elevated`, `--color-text-primary`)
- Components: PascalCase named exports

**UI/UX conventions observed in completed audits:**

- One upload card, then summary widgets, then one results table
- Overlay while processing; never leave the user with a spinner in the button only
- Sheet-layout errors in a rose card, not only a toast
- Restore/start-new banner when a local snapshot exists
- Export Excel (all errors via server when available) + CSV + PDF

---

## 22. What frontend developers must NOT change

| Do not | Why |
|--------|-----|
| Call Python (`:8000`) from the browser | Architecture: FE → Node only |
| Change metal product keys in `constants/metalRateRuleBook.js` without Python | Must match `metal_rate_rule_book.json` |
| Change sales issue codes in `utils/salesRecordFilters.js` without Python | Codes come from the sales processor |
| Round closing-stock quantities (`utils/closingStockProductMapping.js`) | Quantity is never rounded; never re-sum rounded cells |
| Persist filename-only audit snapshots (`useAuditSessionPersistence`) | Incomplete snapshots break restore |
| Move `ThemedToaster` off 88px top offset | Covers the user chip |
| Remove deprecated aliases (`SalesReturnExceptionTable`, `SessionBootstrap`) without updating callers | Existing imports |
| Shorten Vite `/api` proxy timeout | Large Excel uploads |
| Add Redux/global stores for audit results | Pages own local state + localStorage |
| Hide developer docs by changing Settings copy without product intent | Settings currently says keep developer documentation hidden in production |

---

## 23. How to add a new audit page (and connect an existing backend API)

Copy **Cash Ledger** for a single-file exception audit, **Negative Bank** if the workbook schema matches cash, **LedgerAuditPage** if it is another sales/purchase ledger, **Section 44AB** only if it is multi-file with a custom report.

### Checklist

1. **Service** `src/services/<name>.service.js` — `validate*Excel` POST FormData; optional `exportInvalid*`
2. **Filters / columns** in `src/utils/`
3. **Page** — copy `CashLedgerPage.jsx` or wrap a shared page + config
4. **Route** in `AppRoutes.jsx` (lazy import + `<Route>`)
5. **Sidebar** item in the correct group; use `canShowAdminOnlyFeature` only if product wants ADMIN-only
6. **`TopNavbar` `TITLE_MAP`**
7. **`auditRoutePreload.js`** loader
8. **`AUDIT_SESSION_REGISTRY`** in `auditSessionConfig.js` (unless the module is like 44AB)
9. Optional `WatchDemoButton` + `DEMO_VIDEO_MODULES` key
10. Slim snapshot helper if results are large
11. Point the service at the **existing** Node path (`/api/v1/process/<module>/validate`). Do not invent a second URL style unless the backend already has a legacy mount (`/api/sales-return`, `/api/purchase-return`, `/api/sales-audit`).

### Connecting to an existing backend API

The frontend only needs:

- The Node path and HTTP method
- Multipart field names (`file`, or `cashFiles`/`bankFiles`, or `purchaseGoodsFile`/`tdsPayableFile`)
- The JSON keys the page will read (`records`, `summary`, `exportColumns`, …)

Node already forwards to Python. Do not add a second client.

---

## 24. Complete example: Cash Ledger (create UI → connect API)

**Route:** `/scrutiny/cash-ledger`  
**Page:** `frontend/src/pages/CashLedgerPage.jsx`  
**Service:** `frontend/src/services/cashLedger.service.js`  
**Session key:** `cash-ledger`

1. Sidebar `NavItem` “Cash” → page title “Cash Ledger Audit”.
2. Hydrate via `bootstrapAuditSessionState('cash-ledger')`.
3. `FileUploadZone` → `setFile`. Choosing a file clears prior result/error/filter.
4. **Start Audit** → `validateCashLedgerExcel(file)` → `POST /api/v1/process/cash-ledger/validate`.
5. Overlay while `loading`.
6. Success toast `"Cash Ledger validation complete"`; snapshot saved (7 days).
7. Widgets: Total rows, Error rows, Negative Cash, Cash Payments ≥ ₹10,000, Cash Receipts ≥ ₹2,00,000, Compliance.
8. Table: `AuditUploadResultsTable` + `resolveCashLedgerColumnOrder` + `CASH_LEDGER_DISPLAY_HEADERS`.
9. Export:
   - All errors → `exportInvalidCashLedgerRows` → `POST /api/v1/process/cash-ledger/export-invalid`
   - Filtered → client `downloadRowsXlsx`
   - CSV / PDF → `exportRowsToCsv` / `exportRowsToPdf`

Issue codes (`cashLedgerRecordFilters.js`): `NEGATIVE_CASH_BALANCE`, `CASH_PAYMENT_GT_10000`, `CASH_RECEIPT_GT_200000` — must match `python-service/app/engines/cash_ledger_engine/config/constants.py`.

---

## 25. Cross-cutting: auth, errors, logging, testing, git

**Auth flow:** login → access token in storage + HttpOnly refresh cookie → Bearer on `apiClient` → 401 → `/api/auth/refresh` → retry or `/login`.

**RBAC flow:** JWT `role` on `user` → sidebar hide → **no** extra frontend check on audit POSTs.

**Logging/debugging:** browser Network tab + `x-request-id` on backend; Python request ids are in JSON (`requestId` on some engines). Frontend has no structured logger.

**Testing:** frontend CI (`.github/workflows/frontend-deploy.yml`) runs `npm run lint` and `npm run build` on PRs/pushes to `main` that touch `frontend/**`. There is no frontend unit-test suite in `package.json`.

**Git:** no `CONTRIBUTING.md` and no documented branch-name scheme. Observed CI:

- PRs targeting `main` that touch `frontend/**` → lint + build
- Push to `main` (not PRs) → deploy to production after a successful build

**Needs confirmation:** required reviewers, whether feature branches must be named a certain way.

**Safely adding a new audit without breaking old ones:**

- Reuse `FileUploadZone`, `AuditUploadResultsTable`, `auditToast*`, `apiClient`
- Do not change shared filter/message maps for other modules
- Do not change `apiClient` timeout or interceptors unless every audit needs it
- Keep issue codes identical to Python
- Add a dedicated service file; do not overload `sales.service.js` for unrelated modules

---

## 26. Needs confirmation

- Production `VITE_API_BASE_URL` (same-origin vs dedicated API host)
- Whether Viewer should be blocked from running audits
- Whether `SUPER_ADMIN` should appear in the sidebar
- Whether pages should start calling `auditSession.service.js` (backend exists; UI does not)
- Whether Party-Wise TDS / Section 44AB should join `AUDIT_SESSION_REGISTRY`
