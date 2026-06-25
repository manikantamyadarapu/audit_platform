# Production Cleanup & Dead Code Audit Report

**Date:** 2026-06-15  
**Scope:** Frontend, Backend (Node), Python Service, Database (Prisma)  
**Method:** Static import graph, route registration trace, API caller grep, package import analysis  
**Policy:** No blind deletes — every removal verified against imports, routes, tests, and dynamic references.

---

## Executive Summary

| Area | Used (runtime) | Unused (safe remove) | Potentially unused (keep / review) |
|------|----------------|----------------------|-------------------------------------|
| Frontend pages | 17 routed | 1 (`LoginNew.jsx`) | 0 |
| Frontend components | 32 active | 6 legacy tables + `HaaLogoMark` | 0 |
| Frontend utils | 20 active | 5 dead modules | 3 dead exports in live files |
| Backend `src/` | All wired | 0 orphaned files | 2 API trees, duplicate mounts |
| Python `app/` | Core pipeline live | 6 dead modules (not removed) | Offline scripts, GST stub |
| npm (frontend) | 14 deps used | `bootstrap` | `postcss`, `autoprefixer` (dev tooling) |
| npm (backend) | 11 deps used | `bcrypt` (duplicate of `bcryptjs`) | 0 |
| pip (python) | 12 runtime used | `rapidfuzz` (dead import chain) | `pytest`, `httpx` in prod requirements |
| Prisma models | 8 models queried | 8 models schema-only | Migrations kept (historical) |

**Safe cleanup performed in this pass:** 12 frontend files removed, 2 npm packages removed. Python/backend route consolidation **not** performed (breaking-change risk).

---

## STEP 1 — Dependency Graph (High Level)

```
Browser
  └─ frontend (Vite/React)
       └─ axios → backend /api/*
            └─ pythonClient → python-service :8000

python-service (FastAPI)
  └─ process_router → ProcessingService → factory (pan|gross_weight|sales)
  └─ process_router → SalesReturnAuditProcessor (bypass factory)
  └─ rate_rules_router | diamond_rate_rules_router | rate_book_router
```

---

## STEP 2 — File Classification

### Frontend — USED FILES

| Path | Reason |
|------|--------|
| `src/main.jsx`, `src/App.jsx`, `src/routes/AppRoutes.jsx` | App entry + routing |
| All 17 routed pages in `AppRoutes.jsx` | Lazy-loaded routes |
| `components/ui/AuditValidationOverlay.jsx` | All audit pages |
| `components/tables/AuditUploadResultsTable.jsx` | PAN, gross, sales, sales-return tables |
| `hooks/useAuditSessionPersistence.js` | Audit session restore |
| `context/AppUiContext.jsx` | Theme, sidebar, activities |
| `services/*.js` | All service files imported by pages |
| `config/auditSessionConfig.js` | Session persistence registry |

### Frontend — UNUSED FILES (removed)

| Path | Reason |
|------|--------|
| `src/pages/LoginNew.jsx` | No route, no imports |
| `src/components/tables/PanResultsTable.jsx` | Superseded by `AuditUploadResultsTable`; zero imports |
| `src/components/tables/SalesResultsTable.jsx` | Same |
| `src/components/tables/GrossWeightResultsTable.jsx` | Same |
| `src/components/tables/SalesRateDebugPanel.jsx` | Only used by dead `SalesResultsTable` |
| `src/components/tables/SalesReturnExceptionTable.jsx` | Barrel re-export; export kept on `AuditUploadResultsTable` |
| `src/components/ui/HaaLogoMark.jsx` | Never imported |
| `src/utils/appleFormat.js` | Zero imports |
| `src/utils/dedupeSalesRecords.js` | Zero imports |
| `src/utils/salesXlsxExport.js` | Zero imports (sales uses `salesReturnXlsxExport`) |
| `src/utils/useFullscreen.js` | Zero imports |
| `src/utils/auditIssueTone.js` | Only used by dead legacy tables |

### Frontend — POTENTIALLY UNUSED (kept)

| Path | Reason |
|------|--------|
| `config/auditSessionConfig.js` → `getAuditSessionConfigByRoute()` | Exported, not called yet — useful for route-based session |
| `services/processExcelService.js` | Some export functions unused (`exportInvalidGrossWeightRows`, etc.) |
| `services/panService.js` → `exportInvalidPanRows` | Exported, unused |
| `context/AppUiContext.jsx` → `seedActivities` | Demo feed on load — product decision, not dead code |

---

## STEP 3 — Routes

### Used Routes (all `AppRoutes.jsx` lazy pages)

| Route | Component |
|-------|-----------|
| `/login` | Login |
| `/dashboard` | Dashboard |
| `/scrutiny/*` | ScrutinyHub + audit pages |
| `/vouching/*` | VouchingHub + VouchingHold |
| `/reports`, `/settings`, `/profile`, `/users` | Respective pages |
| `/sales-audit/product-average-rates` | ProductAverageRates (linked from Sales Ledger) |

### Duplicate Routes (intentional aliases — kept)

| Component | Paths |
|-----------|-------|
| `RateRuleBook` | `/scrutiny/rate-rule-book`, `/scrutiny/rate-rules`, `/scrutiny/rule-book` |
| `VouchingHold` | 3 vouching sub-paths |
| `ModuleSoon` | 4 coming-soon scrutiny paths |

### Orphan Routes

| Item | Status |
|------|--------|
| `LoginNew.jsx` | **Not routed** — removed |

### Unlinked but valid routes

| Route | Notes |
|-------|-------|
| `/scrutiny/sales-return-rate` | Routed; not on ScrutinyHub cards (Sidebar only) |
| `/scrutiny/diamond-gem-rates` | Routed; Sidebar only |

---

## STEP 4 — React Components / Hooks / Context

### Unused (removed)

- Legacy result tables (see Step 2)
- `HaaLogoMark.jsx`
- `useFullscreen.js` hook file

### All other hooks/contexts — USED

- `useAuditSessionPersistence` — audit pages
- `useAnimatedNumber` — `AuditSummaryWidget`
- `AppUiContext` — layout + theme

---

## STEP 5 — Backend

### All `src/**/*.js` — USED (reachable from `server.js`)

No fully orphaned source files.

### Potentially unused APIs (kept — breaking change if removed)

| API | Reason kept |
|-----|-------------|
| `/api/v1/process/sales-return/*` | Registered; superseded by `/api/sales-return/*` but may have external callers |
| `/api/v1/diamond-rate-rules` | Registered; frontend uses Python `/api/rate-book/diamonds` directly |
| Duplicate `/api/v1/dashboard` vs `/api/dashboard` | Frontend uses non-v1 paths; v1 kept for compatibility |

### Dead exports (not removed in this pass)

| Location | Item |
|----------|------|
| `middleware/upload.middleware.js` | `dualSalesReturnFiles` exported, never imported |
| `middleware/auth.middleware.js` | Unused `express` import |
| `middleware/optionalAuth.middleware.js` | Unused `express` import |

### Missing file

| Path | Issue |
|------|-------|
| `prisma/seed.js` | Referenced in `package.json` but **file missing** — `npm run db:seed` fails |

---

## STEP 6 — Python Service

### USED (runtime)

- Processors: `pan`, `gross_weight`, `sales`, `sales_return` (direct)
- Routers: all registered in `main.py`
- Sales engine validators, parsers, config JSON via `loader.py`
- Rate book JSON read/write via `rate_book_router`

### UNUSED modules (report only — NOT deleted)

| Path | Reason |
|------|--------|
| `app/validators/gst_validator.py` | Zero imports; GST route broken (no factory entry) |
| `app/validators/pan_validator.py` | Zero imports; logic in `pan_processor` |
| `app/utils/master_sales_rule_engine.py` | Zero runtime imports |
| `app/services/master_sales_rate_rule_service.py` | Never imported |
| `app/utils/excel_header_detection.py` | Zero imports |
| `python-service/sales_engine/config/*.json` | Orphan duplicates outside `app/sales_engine/config/` |

### Potentially unused (kept — offline/tooling)

| Path | Used by |
|------|---------|
| `app/services/master_rule_service.py` | Build scripts + `test_master_sales_rule_engine.py` |
| `app/data/build_*.py` | CLI maintenance scripts |
| `scripts/sales_return_product_summary.py` | CLI + tests |

### Broken / production issues (not auto-fixed)

| Issue | Location |
|-------|----------|
| GST endpoint 400 | `file_type=gst` not in factory |
| `print()` on import | `rate_book_router.py` |
| Traceback in API response | `main.py` KeyError handler |
| `rapidfuzz` in requirements | Only dead `master_sales_rule_engine.py` |

---

## STEP 7 — NPM Packages (Frontend)

### Removed

| Package | Reason |
|---------|--------|
| `bootstrap` | Zero imports; Tailwind used exclusively |

### Kept (used)

`react`, `react-dom`, `react-router-dom`, `axios`, `@tanstack/react-table`, `apexcharts`, `framer-motion`, `lucide-react`, `react-hot-toast`, `jspdf`, `jspdf-autotable`, `xlsx`, `clsx`, `tailwind-merge`

### Review later (dev tooling)

`postcss`, `autoprefixer` — no PostCSS config; may be transitive-only

---

## STEP 8 — NPM Packages (Backend)

### Removed

| Package | Reason |
|---------|--------|
| `bcrypt` | Zero imports; `bcryptjs` used in `password.util.js` |

---

## STEP 9 — Python Packages (`requirements.txt`)

### Report only

| Package | Status |
|---------|--------|
| `rapidfuzz` | Unused at runtime — remove in dedicated pass after deleting `master_sales_rule_engine.py` |
| `pytest`, `httpx` | Dev/test deps in production file — move to `requirements-dev.txt` in future |

All other listed packages — **USED**.

---

## STEP 10 — Database (Prisma) — Report Only

### Models actively queried

| Model | Repository |
|-------|------------|
| `User`, `Role` | `user.repository.js` |
| `AuditType`, `AuditSession` | `auditSession.repository.js` |
| `AuditRun`, `AuditIssueCount` | `dashboard.repository.js` |
| `SalesProductAverageRate` | `salesProductAverage.repository.js` |
| `Notification` | `notification.repository.js` |

### Models in schema — NOT queried in backend (future / incomplete wiring)

| Model | Notes |
|-------|-------|
| `MasterRule` | No repository usage |
| `UploadedFile` | No repository usage |
| `GrossAuditSummary` | No repository usage |
| `RateAuditSummary` | No repository usage |
| `IdProofAuditSummary` | No repository usage |
| `AuditPerformance` | No repository usage |
| `DashboardSummary` | No repository usage |
| `DashboardAuditMetric` | No repository usage |

**Do not drop tables/migrations** without a planned schema migration — data model is ahead of application wiring.

---

## STEP 11 — Production Readiness Scan

| Check | Result |
|-------|--------|
| `console.log` in frontend `src/` | **None** |
| `console.error` | `Login.jsx`, `DiamondGemRateBook.jsx` (error paths) |
| `print()` in python `app/` | `rate_book_router.py` (import-time), `main.py`, debug-gated `pan_processor` |
| TODO/FIXME in source | **None** in frontend/backend/python app code |
| Hardcoded localhost in frontend | `DiamondGemRateBook.jsx` uses `VITE_API_URL \|\| 'http://localhost:8000'` — **risk** |
| Mock/seed data | `AppUiContext.seedActivities` (4 demo activities) |
| Backend in-memory state | `salesReturnRateComparison.service.js` `lastAuditResult` |

---

## STEP 12 — Safe Removal Log

### Files Removed

1. `frontend/src/pages/LoginNew.jsx`
2. `frontend/src/components/tables/PanResultsTable.jsx`
3. `frontend/src/components/tables/SalesResultsTable.jsx`
4. `frontend/src/components/tables/GrossWeightResultsTable.jsx`
5. `frontend/src/components/tables/SalesRateDebugPanel.jsx`
6. `frontend/src/components/tables/SalesReturnExceptionTable.jsx`
7. `frontend/src/components/ui/HaaLogoMark.jsx`
8. `frontend/src/utils/appleFormat.js`
9. `frontend/src/utils/dedupeSalesRecords.js`
10. `frontend/src/utils/salesXlsxExport.js`
11. `frontend/src/utils/useFullscreen.js`
12. `frontend/src/utils/auditIssueTone.js`

### Packages Removed

- `frontend/package.json` → `bootstrap`
- `backend/package.json` → `bcrypt`

### Files Kept (requires follow-up PR)

- Python dead modules (6 files)
- Backend duplicate route mounts
- Prisma schema-only models
- `getAuditSessionConfigByRoute` export
- Unused service export functions

---

## STEP 13 — Validation Results

| Check | Status | Notes |
|-------|--------|-------|
| Frontend `npm run build` | **PASS** | Built in ~13s, no errors |
| Backend app load | **PASS** | `require('./src/app.js')` OK |
| Prisma validate | **PASS** | Schema valid |
| Python full `pytest tests/` | **PRE-EXISTING FAILURES** | 508 passed, **86 failed** — not caused by this cleanup (no Python files changed) |
| Python core audit tests | **PASS** | `test_health`, `test_gross_weight_processor`, `test_sales_return_audit_engine` — 12/12 |

### Pre-existing Python test failure clusters (document only)

- `test_gemstone_product_catalog.py` — catalog/rate mapping drift
- `test_pan_processor.py` — PAN rule changes
- `test_sales_audit_processor.py` — sales ledger/rate rules
- `test_gross_sales_export.py` — export endpoints
- `test_uom_validation.py` — UOM rule assertions

These align with in-progress work on `gross_weight_processor.py` (modified in git before this audit).

---

## Potential Risks

1. **Removing v1 API duplicates** without auditing external clients could break integrations.
2. **Deleting Python `master_rule_service.py`** would break build scripts and tests despite no API usage.
3. **Dropping Prisma models** would require coordinated migration + feature removal.
4. **`DiamondGemRateBook` localhost fallback** may fail in production if env unset.
5. **In-memory sales-return comparison state** breaks multi-instance Node deployments.

---

## Recommended Follow-Up (Next PRs)

1. Fix `DiamondGemRateBook` to use shared `api.js` + `VITE_API_BASE_URL`
2. Add or remove `prisma/seed.js` from `package.json`
3. Consolidate API prefixes (`/api/v1` vs `/api`)
4. Wire diamond rates through Node OR remove `diamondRateRules` backend route
5. Move `pytest`/`httpx` to `requirements-dev.txt`; remove `rapidfuzz` after dead module cleanup
6. Replace `rate_book_router` `print()` with `loguru` logger
7. Register GST processor or remove GST routes
8. Wire summary tables (`GrossAuditSummary`, etc.) or document as Phase 2 schema
