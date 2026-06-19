# Production Hardening Report

**Date:** 2026-06-15  
**Scope:** Production-only cleanup — no audit business logic changes

---

## Summary

| Task | Status |
|------|--------|
| Remove `db:seed` script | **Done** |
| Remove GST routes & UI | **Done** |
| Replace `print()` with logger | **Done** (runtime `app/`) |
| Remove debug prints | **Done** |
| Verify builds | **PASS** |
| Verify routes | **PASS** — no GST endpoints |
| Verify logging | **PASS** — no `print()` in runtime `app/` |

---

## 1. Removed DB Seed Script

**Problem:** `backend/package.json` referenced `prisma/seed.js` which does not exist.

**Changes:**
- Removed `"db:seed": "node prisma/seed.js"` from `scripts`
- Removed `"seed": "node prisma/seed.js"` from `prisma` block

**Verification:** Grep confirms no remaining `db:seed` or `seed.js` references in project code (only historical `cleanup-report.md`).

---

## 2. Removed GST Route Completely

GST audit module was not implemented (no processor in factory). Removed all GST **routing/UI** surfaces.

### Python Service
- Removed `POST /api/process/gst` and `POST /api/v1/process/gst/validate` from `process_router.py`
- Deleted unused `app/validators/gst_validator.py`

**Not changed (intentional — not GST audit module):**
- PAN `gst50kAddressMissing` address checks (PAN business logic)
- Sales ledger column passthrough (`cgst`, `sgst`, `igst` in export output)
- Prisma `invalid_gst_count` column (schema untouched)
- Decorative login background labels (`GST_CHECK`, `GSTIN_MATCH` in `AuditIntelligenceBackground.jsx`)

### Frontend
- Removed route `/scrutiny/gst` from `AppRoutes.jsx`
- Removed GST card from `ScrutinyHub.jsx` "Coming soon" section
- Removed GST breadcrumb from `TopNavbar.jsx`
- Removed GST copy from `ModuleSoon.jsx`

### Backend Node
- No GST routes existed in Node gateway (none removed)

### Swagger / OpenAPI
- No GST entries found in `backend/src/openapi/openapi.json`

---

## 3. Replaced Python `print()` With Logging

Uses existing `loguru` framework via `app.utils.logger.get_logger()`.

| File | Change |
|------|--------|
| `app/routers/rate_book_router.py` | 11× `print()` → `log.info()` |
| `app/main.py` | KeyError handler `print()` → `get_logger('key-error').error()` |
| `app/processors/pan_processor.py` | Debug preview `print()` loop → `self._log.debug()` / `self._log.warning()` |

---

## 4. Debug Code Removed

- PAN processor debug row-by-row `print()` loop replaced with structured `debug` logging (only when `debug_exports_enabled()`)
- No commented debug blocks removed elsewhere (none found in changed files)

**CLI / build scripts (unchanged — not runtime):**
- `app/data/build_gemstone_product_catalog.py` — CLI `print()` on write
- `scripts/sales_return_product_summary.py` — CLI report output

---

## 5. Build & Startup Results

| Check | Result |
|-------|--------|
| Frontend `npm run build` | **PASS** |
| Backend app load | **PASS** |
| Prisma validate | **PASS** |
| Python service import/startup | **PASS** |
| Core Python tests (health, gross weight, sales return) | **PASS** (12/12) |

---

## 6. Route Verification

### Python — Active Audit Endpoints (no GST)

```
GET  /api/health
POST /api/process/pan
POST /api/process/pan/export-invalid
POST /api/process/gross-weight
POST /api/process/gross-weight/export-invalid
POST /api/process/sales
POST /api/process/sales/export-invalid
POST /api/process/sales-return/validate
POST /api/process/sales-return/export-exceptions
POST /api/process/sales-return/export-rate-comparison
(+ gateway aliases under /api/v1/process/*)
```

**GST routes:** `NONE`

### Frontend — Active Audit Routes

| Route | Page |
|-------|------|
| `/scrutiny/pan` | PAN Audit |
| `/scrutiny/gross-weight` | Gross Audit |
| `/scrutiny/sales-ledger` | Sales Audit |
| `/scrutiny/sales-return-rate` | Sales Return Audit |
| `/sales-audit/product-average-rates` | Product Average Rates |
| `/dashboard` | Dashboard |

**Removed:** `/scrutiny/gst`

### Backend Node — Audit Proxies (unchanged)

- `/api/v1/process/pan/*`
- `/api/v1/process/gross-weight/*`
- `/api/v1/process/sales/*`
- `/api/sales-return/*`
- `/api/sales-audit/*`
- `/api/dashboard/*`

---

## 7. Logging Verification

**Runtime `python-service/app/`:** No `print()` statements remain.

**Remaining `print()` (non-runtime, acceptable):**
- `app/data/build_gemstone_product_catalog.py` (CLI)
- `scripts/sales_return_product_summary.py` (CLI)

**Frontend:** No `console.log` in `src/` (only `console.error` on error paths in Login/DiamondGemRateBook).

---

## Files Changed

| File | Action |
|------|--------|
| `backend/package.json` | Removed seed scripts |
| `python-service/app/routers/process_router.py` | Removed GST endpoints |
| `python-service/app/validators/gst_validator.py` | **Deleted** |
| `python-service/app/routers/rate_book_router.py` | Logger migration |
| `python-service/app/main.py` | Logger migration |
| `python-service/app/processors/pan_processor.py` | Debug print → logger |
| `frontend/src/routes/AppRoutes.jsx` | Removed GST route |
| `frontend/src/pages/ScrutinyHub.jsx` | Removed GST card |
| `frontend/src/components/layout/TopNavbar.jsx` | Removed GST title |
| `frontend/src/pages/ModuleSoon.jsx` | Removed GST copy |

---

## Remaining Production Risks

| Risk | Notes |
|------|-------|
| KeyError responses include Python traceback in JSON | `main.py` — info disclosure in production |
| `DiamondGemRateBook.jsx` localhost fallback | Bypasses Node proxy if env unset |
| In-memory sales-return comparison state | Backend multi-instance issue |
| Duplicate API mounts (`/api` vs `/api/v1`) | Not addressed in this pass |
| Pre-existing Python test failures (86) | Unrelated to this hardening pass |
| `python-service/README.md` still mentions GST stub | Documentation drift — update separately |
| Decorative `GST_CHECK` strings on login page | Not a route; cosmetic only |

---

## Business Logic — Not Modified

Confirmed no changes to:
- Rate validation
- Ledger validation
- UOM validation
- Free quantity validation
- Diamond logic
- Gold logic
- Sales return logic
- Product average logic
- Database schema
