# Backend Development Handbook

This document describes the **Node.js Express API as implemented**. The backend is a gateway: authentication, uploads, persistence, notifications, and proxying to FastAPI. Spreadsheet rules live in Python.

```text
Frontend
    ↓
Backend API (this service)
    ↓
Validation (multer / hand-written validators)
    ↓
Service
    ↓
Python Audit Service
    ↓
Result
    ↓
Database / session (best-effort AuditRun + notifications)
    ↓
Backend Response
    ↓
Frontend
```

Related handbooks:

- [FRONTEND_DEVELOPMENT.md](./FRONTEND_DEVELOPMENT.md)
- [PYTHON_SERVICE_DEVELOPMENT.md](./PYTHON_SERVICE_DEVELOPMENT.md)

---

## 1. Technology

**Location:** `backend/`  
**Package:** `audit-platform-node-backend`  
**Node:** `>=18`  
**Entry:** `src/server.js`

| Dependency | Role |
|------------|------|
| Express `^4.21.2` | HTTP |
| Prisma `^5.22.0` | PostgreSQL |
| Axios + form-data | Python client |
| jsonwebtoken, bcryptjs, cookie-parser | Auth |
| multer | Multipart uploads (memory) |
| helmet, cors, morgan | Security / access logs |
| nodemailer | Password-reset email |
| swagger-ui-express | Non-production OpenAPI UI |

Scripts (`package.json`): `dev` = `NODE_ENV=development node --watch src/server.js`; `start` = production node. **There is no `test` script.**

---

## 2. Folder structure

```text
backend/
  prisma/schema.prisma
  prisma/migrations/
  prisma.config.js
  src/
    server.js                 # listen, DB warm, session cleanup job
    app.js                    # middleware, /api/v1, legacy remounts
    config/index.js           # env
    config/env-validation.js  # required vars
    routes/index.js           # versioned mounts
    routes/*.routes.js
    controllers/
    services/                 # pythonClient, per-audit, auth, persist
    repositories/
    validators/
    middleware/               # auth, role, upload, requestId, errorHandler
    jobs/auditSessionCleanup.job.js
    lib/prisma.js             # SINGLE PrismaClient
    utils/                    # jwt, logger, success/error responses
    constants/notifications.js
    types/auditResult.types.js  # JSDoc only
    openapi/openapi.json
```

Convention in repositories: **one file per audit per layer**, even if it only re-exports `auditRun.repository.js`.

---

## 3. Application startup

`src/server.js`:

1. `config.validateConfigOrThrow()`
2. `http.createServer(app)` → `listen(config.PORT)`
3. `warmDatabaseConnection()` — `prisma.$queryRaw\`SELECT 1\`` (failure is logged; process still runs)
4. `startAuditSessionCleanupJob()`
5. `SIGTERM` / `SIGINT` → `server.close`, forced exit after 10s

`src/app.js` middleware order:

1. `trust proxy` if production
2. disable `x-powered-by`
3. `requestIdMiddleware`
4. `cookieParser`
5. `express.json` / `urlencoded` **10mb**
6. `helmet` (`crossOriginResourcePolicy: 'cross-origin'`)
7. `cors` (credentials; methods GET/POST/PUT/PATCH/DELETE/OPTIONS; headers `Content-Type`, `Authorization`, `x-request-id`)
8. `morgan('dev')` or `morgan('combined')`
9. Optional Swagger
10. `GET /api/health`
11. `app.use('/api/v1', apiV1)`
12. Legacy remounts
13. `notFoundHandler` then `errorHandler`

---

## 4. Configuration / environment

**No `.env.example` exists in the repo** (SETUP.md still says `cp .env.example .env`). **Needs confirmation** how new developers obtain a template.

**Env path mismatch:**

- `src/config/index.js` and `src/lib/prisma.js` load **repo-root** `audit_platform/.env`
- `prisma.config.js` loads `backend/.env`
- SETUP.md tells developers to use `backend/.env`

**Needs confirmation** which file each environment actually uses.

**Required at startup** (`env-validation.js`): `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `DATABASE_URL`, `DIRECT_URL`.

| Variable | Default / rule |
|----------|----------------|
| `PORT` | **4001** in code; README/SETUP say **4002**. Set `PORT=4002` to match frontend Vite proxy. |
| `NODE_ENV` | `development` |
| `JWT_EXPIRES_IN` | `15m` |
| `REFRESH_TOKEN_EXPIRES_IN` | `7d` |
| `PYTHON_SERVICE_URL` | `http://127.0.0.1:8000` (trailing slash stripped; http/https only) |
| `PYTHON_SERVICE_TIMEOUT_MS` | `600000` (10 min) |
| `CORS_ORIGIN` | unset/`*` → reflect request in non-prod; **throws in production** if missing or `*` |
| `REQUEST_BODY_JSON_LIMIT` | `50mb` on **export** routes only (global parser is 10mb) |
| `UPLOAD_MAX_BYTES` | `50 * 1024 * 1024` |
| `ENABLE_SWAGGER` | off in production; otherwise on unless `=== 'false'` |

Used but **not** in `validateEnvOrThrow`: `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `FRONTEND_URL`.

Production: no placeholder JWT secrets; JWT and refresh secrets must be ≥32 characters.

---

## 5. API architecture

### Versioned (`src/routes/index.js` under `/api/v1`)

| Mount | Router file |
|-------|-------------|
| `/process/pan` | `pan.routes.js` |
| `/process/gross-weight` | `grossWeight.routes.js` |
| `/process/sales` | `sales.routes.js` |
| `/process/sales-return` | `salesReturn.routes.js` |
| `/process/purchase-return` | `purchaseReturn.routes.js` |
| `/process/purchase` | `purchase.routes.js` |
| `/process/cash-ledger` | `cashLedger.routes.js` |
| `/process/negative-bank` | `negativeBank.routes.js` |
| `/process/party-wise-tds` | `partyWiseTds.routes.js` |
| `/process/tds-rate-0.1` | `tds01.routes.js` |
| `/process/section44ab` | `section44ab.routes.js` |
| `/process/financials` | `financials.routes.js` |
| `/rate-rules` | `rateRules.routes.js` |
| `/diamond-rate-rules` | `diamondRateRules.routes.js` |
| `/tds-rules` | `tds.routes.js` |
| `/auth` | `auth.routes.js` |
| `/users` | `user.routes.js` |
| `/dashboard` | `dashboard.routes.js` |
| `/audit-sessions` | `auditSession.routes.js` |
| `/rate-book` | `rateBook.routes.js` |
| `/notifications` | `notification.routes.js` |
| `/demo-videos` | `demoVideo.routes.js` |

### Legacy remounts (`app.js`) — same routers, **no** `/v1`

The frontend still calls these paths:

| Path | Why |
|------|-----|
| `/api/auth` | login / refresh / logout / `/me` |
| `/api/notifications` | notification bell |
| `/api/dashboard` | dashboard widgets |
| `/api/audit-sessions` | session API (unused by pages today) |
| `/api/sales-audit` | product-average-rates |
| `/api/sales-return` | run-audit / exports |
| `/api/purchase-return` | same pattern |

**Users exist only at `/api/v1/users`.** Controller comments saying `POST /api/users` are stale.

**Public:** `GET /api/health`, login/refresh/logout/forgot-password/reset-password. Swagger: `/openapi.json`, `/api-docs` when enabled.

---

## 6. Routes, controllers, services (completed audits)

All process routers except Section 44AB use `router.use(authenticate)`. Section 44AB applies `authenticate` on the POST.

### Cash Ledger (smallest complete stack — copy this)

| Layer | File |
|-------|------|
| Routes | `src/routes/cashLedger.routes.js` |
| Controller | `src/controllers/cashLedger.controller.js` — `validateCashLedger`, `exportInvalidCashLedger` |
| Service | `src/services/cashLedger.service.js` |
| Validator | `src/validators/cashLedger.validator.js` |
| Repository | `src/repositories/cashLedger.repository.js` (re-exports audit-run helpers) |

| Method | Path | Middleware |
|--------|------|------------|
| POST | `/api/v1/process/cash-ledger/validate` | `authenticate`, `singleCashLedgerFile` |
| POST | `/api/v1/process/cash-ledger/export-invalid` | extra `express.json({ limit: REQUEST_BODY_JSON_LIMIT })` |

Python: `postCashLedgerValidate` → `POST {PYTHON}/api/process/cash-ledger` (multipart `file`).

### Negative Bank

Same shape as cash. Reuses `singleCashLedgerFile` (identical workbook schema). Python: `/api/process/negative-bank`.

### Sales (Rate & Ledger)

| Method | Paths | Handler |
|--------|-------|---------|
| POST | `/api/v1/process/sales/validate` | `validate` + `singlePanFile` |
| POST | `/api/v1/process/sales/export-invalid` | `exportInvalid` |
| GET | `/api/v1/process/sales/product-average-rates` **and** `/api/sales-audit/product-average-rates` | `getProductAverageRates` |
| GET | `.../product-average-rates/export` | CSV built **in Node** |

Python: `POST /api/process/sales`. Persist: `salesProductAverage.repository` stores `productAverages` in `AuditRun.resultSummary.productRates`.

### Purchase

`POST /api/v1/process/purchase/validate` + `/export-invalid`. Python: `/api/process/purchase`.

**Needs confirmation:** Node `postPurchaseExportInvalid` targets `/api/process/purchase/export-invalid`; the Python `purchase_router` may not define that export. Verify before relying on it.

### TDS

| Surface | Node | Python |
|---------|------|--------|
| Rule book | `GET/POST /api/v1/tds-rules` | `/api/v1/tds-rules` |
| 0.1% | `POST /api/v1/process/tds-rate-0.1/validate` + `/export` | `/api/process/tds-rate-0.1` |
| Party-wise | Dual files `purchaseGoodsFile`, `tdsPayableFile` | `/api/process/party-wise-tds` |

### Section 44AB

| Method | Path | Middleware |
|--------|------|------------|
| POST | `/api/v1/process/section44ab/validate` | `authenticate`, `section44abFiles`, `handleMulterError` |

Python: **`POST /api/v1/process/section44ab`** with `cash_files[]` and `bank_files[]` — this is the **only** process call Node makes under `/api/v1/process/...` on Python. All other process calls use `/api/process/...`.

No Node export route. `section44ab.validator.js` exists but is **not** used by the controller.

### Other process modules

- PAN: `/api/v1/process/pan/validate`, `/export-invalid`
- Gross weight: `/api/v1/process/gross-weight/validate`, `/export-invalid`
- Sales/purchase return: validate, run-audit, GET rate-comparison, export-exceptions, export-rate-comparison (also `/api/sales-return/*`)
- Financials: validate, export-pivots, export-closing-stock, GET closing-stock-rule-book, remap-closing-stock

---

## 7. Services layer

| File | Role |
|------|------|
| `pythonClient.service.js` | Axios client to FastAPI |
| `auditRunPersistence.service.js` | Persist `AuditRun` + extract metrics |
| `auditNotification.service.js` | In-app notifications |
| `auditSession.service.js` | Save/restore/clear UI session |
| `auth.service.js` | Login, refresh, logout, password reset |
| `refreshTokenStore.js` | In-memory refresh `jti` map |
| `email.service.js` | SMTP password reset |
| Per-audit `*.service.js` | Validate → Python → persist → notify |

Rate-rule controllers call `pythonClient` **directly** (no dedicated service).

---

## 8. Schemas / database

`backend/prisma/schema.prisma`

**Models:** `User`, `AuthToken`, `AuditType`, `MasterRule`, `AuditRun`, `DashboardSnapshot`, `AuditSession`, `Notification`, `DemoVideo`.

**Enums:**

- `UserRole`: `ADMIN`, `AUDITOR`, `VIEWER` (**no** `SUPER_ADMIN`)
- `AuditStatus`: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`
- `TokenType`: `PASSWORD_RESET`, `REFRESH`
- `NotificationType`: `AUDIT_COMPLETED`, `AUDIT_FAILED`, `HIGH_EXCEPTION_COUNT`, `SESSION_EXPIRING_SOON`, `MISSING_PREREQUISITE`

`MasterRule` has **no** `prisma.masterRule` calls in `src`. Product averages live in `AuditRun.resultSummary.productRates` JSON, not a dedicated table.

### Repositories

`lib/prisma.js`: **one shared `PrismaClient`**. Extra clients break Supabase PgBouncer (comment in file).

`auditRun.repository.js` auto-creates types only for:

`SALES`, `PURCHASE`, `SALES_RETURN`, `PURCHASE_RETURN`, `PAN`, `GROSS`, `FINANCIALS_PIVOT`

Aliases: `GROSS_WEIGHT` → `GROSS`, `PAN_AUDIT` → `PAN`.

**`CASH_LEDGER`, `NEGATIVE_BANK`, `PARTY_WISE_TDS`, `TDS_01`, `SECTION44AB` are not in `DEFAULT_AUDIT_TYPES`.** If those rows are missing in `audit_types`, `tryPersistAuditRun` logs and returns `null` — the Python result is still returned to the client.

`tds.repository.js` is an empty stub (`module.exports = {}`).

---

## 9. Authentication

- Access JWT: HS256, `JWT_SECRET`, payload `{ id, email, role }`
- Refresh JWT: `type: 'refresh'`, `REFRESH_TOKEN_SECRET`, includes `jti`
- Cookie: name `refreshToken`, **HttpOnly**, `sameSite: 'strict'`, `secure` in production, **`path: '/api/auth'`**, maxAge hardcoded **7 days**
- Server store: in-memory `Map` in `refreshTokenStore.js`. Logout / password reset revokes `jti`. Hourly sweep.
- Prisma `AuthToken.REFRESH` is **not** used for refresh tokens
- `authenticate` requires `Authorization: Bearer <token>`. Sets `req.user = { id, userId, email, role }`
- `optionalAuth` exists and is **never mounted**
- Password reset: SHA-256 hash in `auth_tokens`, 1 hour TTL. Dev may return `devResetUrl` if SMTP unset

Frontend refresh must hit **`/api/auth/refresh`** so the cookie is sent.

---

## 10. Authorization / RBAC

**No permission table.** Role is `User.role`.

`authorize(allowedRoles)` (`middleware/role.middleware.js`): case-insensitive include; 403 `{ success: false, message: 'Access denied. Insufficient permissions.' }`.

Used only on:

- `user.routes.js`: `authorize(['ADMIN', 'SUPER_ADMIN'])` for all user CRUD
- `demoVideo.routes.js`: same for admin write/list-all

`SUPER_ADMIN` cannot be created (`validRoles = ['ADMIN', 'AUDITOR', 'VIEWER']`). Dead branch unless a JWT is minted outside this API.

**Audit routes have no `authorize`.** Any authenticated ADMIN / AUDITOR / VIEWER can run audits.

To add a persisted role: Prisma enum + migrate + `validRoles` in `user.controller.js` / `user.service.js` + `authorize([...])` on the routers that need it.

To gate a new audit: add `authorize(['ADMIN'])` (or the intended list) on that router. Do not rely on the sidebar hide.

---

## 11. Middleware

| Name | File | Fact |
|------|------|------|
| `requestIdMiddleware` | `requestId.middleware.js` | `x-request-id` or UUID; echoes header |
| `authenticate` / `authMiddleware` | `auth.middleware.js` | Same function, two exports |
| `authorize` | `role.middleware.js` | Role allow-list |
| `singlePanFile` | `upload.middleware.js` | field `file` |
| `singleCashLedgerFile` | same | field `file` (cash + negative bank) |
| `singleTds01File`, `singleSalesReturnFile` | same | field `file` |
| `dualPartyWiseTdsFiles` | `purchaseGoodsFile`, `tdsPayableFile` |
| `section44abFiles` | `cashFiles` max 10, `bankFiles` max 50 |
| `financialsPivotFiles` | 6 named fields; `.xlsx`/`.xlsm` only |
| `dualSalesReturnFiles` | Defined, **not used** by routes |
| `handleMulterError` | Used on Section 44AB and Financials |
| `errorHandler`, `notFoundHandler` | `errorHandler.middleware.js` |

Upload: `memoryStorage`, size `UPLOAD_MAX_BYTES`. Default filter: `.xlsx`, `.xlsm`, `.xls`. Financials rejects `.xls`. Section 44AB multer `files: 60`.

---

## 12. Error handling and logging

`ErrorResponse(res, statusCode, message)` → `{ success: false, message }`.

`errorHandler`:

- Multer `LIMIT_FILE_SIZE` → 400 `{ success: false, detail: 'File too large', requestId }`
- `LIMIT_UNEXPECTED_FILE` → 400 unexpected field `"file"`
- Status from `err.status` / `err.statusCode`, else 500
- 500 `detail` is always `'Internal server error'`
- If `err.apiBody` (Python JSON) exists, that object is spread back
- Else `{ success: false, detail, requestId }`

`notFoundHandler`: `{ success: false, detail: 'Not found: METHOD path', requestId }`.

Auth middleware uses `{ success: false, message }` (not `detail`). **Two error shapes coexist** — frontend `getApiErrorMessage` reads both.

`handleMulterError` returns `{ error: err.message }` (third shape).

**Logging:** `utils/logger.js` — console `info`/`warn`/`error` with ISO timestamp. Morgan is the HTTP access log. No Winston/Pino/file transport.

---

## 13. Validation

Hand-written validators (no Joi/Zod). Shared export guard: `validateExportInvalidBody` in `panExport.validator.js` — body must have non-empty `records` object array. Reused by sales, purchase, cash, negative bank, PAN, gross weight.

TDS 0.1% export: `detailedRecords`, `summaryRecords`.  
Party-wise export: `purchaseSummary`, `payableSummary`.  
Dashboard: period/status/page/limit.  
Financials: pivot arrays + location trees.

---

## 14. File upload and Excel

**Node does not parse workbooks.** Multer keeps buffers in memory; services forward them to Python.

Node-side file work:

- CSV for product-average-rates export (`sales.controller.exportProductAverageRates`)
- Streaming Python `arraybuffer` Excel back to the client for `export-*` routes

---

## 15. How the backend calls the Python service

`src/services/pythonClient.service.js`:

```js
axios.create({
  baseURL: PYTHON_SERVICE_URL,          // default http://127.0.0.1:8000
  timeout: PYTHON_SERVICE_TIMEOUT_MS,   // default 600_000
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
  headers: { 'User-Agent': 'audit-platform-node-backend/1.0' },
});
```

Optional header `x-request-id`. Errors: no response → 502; Python 422→422, 400→400, ≥500→502; `data.detail` as message; object body stored on `err.apiBody`.

### Paths Node actually calls

| Function | Python path | Payload |
|----------|-------------|---------|
| `postPanValidate` | `/api/process/pan` | `file` |
| `postGrossWeightValidate` | `/api/process/gross-weight` | `file` |
| `postSalesValidate` | `/api/process/sales` | `file` |
| `postPurchaseValidate` | `/api/process/purchase` | `file` |
| `postCashLedgerValidate` | `/api/process/cash-ledger` | `file` |
| `postNegativeBankValidate` | `/api/process/negative-bank` | `file` |
| `postTds01Validate` | `/api/process/tds-rate-0.1` | `file` |
| `postPartyWiseTdsValidate` | `/api/process/party-wise-tds` | `purchase_goods_file`, `tds_payable_file` |
| `postSalesReturnValidate` | `/api/process/sales-return/validate` | `sales_return_file` + `sales_averages` JSON string |
| `postPurchaseReturnValidate` | `/api/process/purchase-return/validate` | `purchase_return_file` + `purchase_averages` |
| `postSection44ABValidate` | **`/api/v1/process/section44ab`** | `cash_files[]`, `bank_files[]` |
| `postFinancialsPivot` | `/api/process/financials` | 6 named files |
| `postExportInvalidRows` | per-module `/export-invalid` | JSON `{ records }` → arraybuffer |
| Rate / TDS rules | `/api/v1/rate-rules`, `/api/v1/diamond-rate-rules`, `/api/v1/rate-book/diamonds`, `/api/v1/tds-rules` | JSON |

### Request/response contract (as Node uses it)

**Upload:** multipart, filename, spreadsheet MIME.

**Validate JSON Node reads:** `totalRows`, `errorRows`, `summary`, `processingTimeMs`, `memoryUsageMb`, `rowsPerSecond`, `cpuUsagePercent`, `executionTiming.loadMs`, `productAverages[]` (sales/purchase), `exceptionRecords` / `records`, sales-return `rateComparisonRecords` / `returnValidationRecords`.

**Export request:** `{ records: object[] }` (or module-specific keys). **Export response:** binary Excel; errors may be JSON `{ detail }` inside the buffer.

Node does **not** validate the full Python schema. Full field lists: [PYTHON_SERVICE_DEVELOPMENT.md](./PYTHON_SERVICE_DEVELOPMENT.md).

---

## 16. Audit creation, sessions, jobs, results

Processing is **synchronous**. No Bull/Redis/worker.

1. Frontend `POST` multipart + Bearer
2. `authenticate`
3. Multer → `req.file` / `req.files`
4. Controller checks file present
5. Service → `pythonClient.*Validate`
6. `tryPersistAuditRun` (best-effort; persist failure is logged, Python result still returned)
7. `notifyAuditCompleted` (fire-and-forget)
8. Response: `{ ...pythonJson, auditRunId }`

On throw: `notify*Failure` then `next(err)`.

**Runs:** created at validate time as `COMPLETED`. No PROCESSING polling API. No `GET /audit-runs/:id`. `storagePath` / `fileHash` are set `null` by current persist callers.

**Sessions** (`auditSession.service.js`):

- Key: `USER_{userId}_{auditCode}`
- TTL 7 days
- Body: `auditTypeId` or `auditCode`, `pageRoute` (required on save), `sessionData` or `results`, `fileName`, `status`, `auditRunId`
- Cleanup job on startup + daily: expired or inactive > 1 day

The **frontend does not call** these session endpoints today; it uses localStorage.

**Sales-return `getRateComparison`:** in-memory `lastAuditResult` on that Node process (lost on restart / not shared across instances).

---

## 17. Pagination / filtering / export APIs

| API | Query | Defaults |
|-----|-------|----------|
| Users | `search`, `page`, `limit` | 1 / 10 |
| Product averages | `page`, `limit` (max 100), `search`, `salesAccount`, `auditRunId`, `sortBy`, `sortOrder` | 1 / 25, `createdAt` desc |
| Recent audits | `page`, `limit` (max 100), `status`, `auditType`, `search`, `period` | 1 / 10 |
| Notifications | `limit` (max 100), `unreadOnly` | 30 |
| Dashboard widgets/trend | `period` `week\|month\|year` | week |

Paginated success is usually `{ success, message, data, pagination: { page, limit, total, totalPages } }`. Users list uses `{ success, users, pagination }`.

Export endpoints: see §6. Section 44AB has **no** export API.

---

## 18. API response and error formats

**A. Success helper** (`successResponse.js`): `{ success: true, message, data }`

**B. Audit validate:** Python body **spread** + `auditRunId`

**C. Auth login:** `{ success: true, accessToken, user }` — no `data` wrapper

**D. Users:** `{ success, message, user }` or `{ success, users, pagination }`

**E. Rate-rules / TDS rules:** raw Python JSON (`res.json(data)`)

**F. File download:** binary + `Content-Type` / `Content-Disposition`

Missing file: `{ success: false, detail, requestId }`

Health: `{ status: 'ok', service: 'audit-platform-node-backend' }`

---

## 19. How the frontend integrates

The frontend uses `apiClient` (`withCredentials` + Bearer) against `/api/v1/process/.../validate` for most audits, and legacy `/api/auth`, `/api/dashboard`, `/api/sales-return`, `/api/sales-audit` as listed in [FRONTEND_DEVELOPMENT.md](./FRONTEND_DEVELOPMENT.md).

When adding a Node route the UI already expects:

- Keep the **exact** path and multipart field names
- Return Python JSON plus `auditRunId`
- Forward 422 `apiBody` so the sheet-error card can render `missingColumns` / `foundColumns`

---

## 20. How to create a new API endpoint

1. Handler in `src/controllers/<module>.controller.js` (try/catch, `next(err)`)
2. Logic in `src/services/<module>.service.js`
3. Persist via repository / `auditRunPersistence` if it is an audit
4. JSON body → `src/validators/<module>.validator.js`
5. Register in `src/routes/<module>.routes.js` with `authenticate` (and upload if needed)
6. Mount in `src/routes/index.js` under `/api/v1/...`
7. Remount in `app.js` **only** if the frontend already calls an unversioned path

Thin controller example: `cashLedger.controller.validateCashLedger` → service → `res.json({ ...data, auditRunId })`.

---

## 21. How to add a new audit module

**Best templates:** Cash Ledger or Negative Bank. Sales if you need product averages. Section 44AB if multi-file.

Copy this set (names from cash):

1. `routes/cashLedger.routes.js`
2. `controllers/cashLedger.controller.js`
3. `services/cashLedger.service.js`
4. `validators/cashLedger.validator.js`
5. `repositories/cashLedger.repository.js`
6. `postXValidate` / `postXExportInvalid` in `pythonClient.service.js` — path must match FastAPI
7. Keys in `constants/notifications.js` (`AUDIT_KEYS`, `AUDIT_LABELS`, `AUDIT_ROUTES`)
8. **Add the code to `DEFAULT_AUDIT_TYPES`** in `auditRun.repository.js` (cash/negative/TDS/44AB currently omit this)
9. Mount in `routes/index.js`
10. Matching FastAPI router + engine ([PYTHON_SERVICE_DEVELOPMENT.md](./PYTHON_SERVICE_DEVELOPMENT.md))
11. Frontend page + service

Do **not** point the browser at Python.

---

## 22. Security

Implemented:

- Helmet, `x-powered-by` off, CORS credentials, production CORS required
- JWT access + HttpOnly refresh cookie (`sameSite: strict`, `secure` in prod)
- bcrypt 10 rounds; passwords ≥6 chars
- 500s hide `err.message`
- Swagger forced off in production
- File type/size limits
- Python URL protocol check
- Soft-delete users (`isActive`); login only active users
- Password reset tokens hashed; generic email response

Visible gaps (do not “fix” in an unrelated PR unless asked):

- In-memory refresh store (not multi-instance)
- VIEWER can POST all audits
- `SUPER_ADMIN` unused in Prisma
- Cookie maxAge not tied to `REFRESH_TOKEN_EXPIRES_IN`

---

## 23. Testing

No `test` script. Present files:

- `src/middleware/financials.upload.test.js` — `node:test` for `financialsFileFilter`
- `src/utils/__tests__/youtube.util.test.js` — Jest-style; runner **Needs confirmation**
- `scripts/test-db-connection.js` — manual Prisma connectivity

CI: `.github/workflows/backend-deploy.yml` is named **Backend & Python Deploy**. On PRs/pushes to `main` that touch `backend/**` or `python-service/**`:

- `backend-check`: `npm ci`, `prisma generate`, `prisma validate`
- `python-check`: `pip install -r requirements.txt`, **`pytest tests/test_health.py -q` only** (not the full Python suite)
- Deploy job runs only on **push to `main`**, not on pull requests (rsync backend + python-service)

---

## 24. Local development

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy   # or migrate dev against DIRECT_URL
npm run dev
```

Start Python first (`PYTHON_SERVICE_URL`, default port 8000). Set `PORT=4002` to match the frontend proxy.

Health: `GET /api/health`  
Swagger (non-prod): `http://localhost:<PORT>/api-docs`

Supabase: `DATABASE_URL` should include `?pgbouncer=true&connection_limit=1` (SETUP.md).

---

## 25. What backend developers must NOT change

| Do not | Why |
|--------|-----|
| Create extra `PrismaClient` instances | PgBouncer prepared-statement failures |
| Duplicate routers for legacy paths | `app.js` remounts the same modules |
| Use `CORS_ORIGIN=*` in production | `getCorsOrigin()` throws |
| Enable Swagger in production | Forced off |
| Point frontend at Python | FE → Node only |
| Skip `authenticate` on process routes | Current pattern |
| Change refresh cookie `path` (`/api/auth`) without frontend | Cookie will not be sent |
| Change Python paths in `pythonClient.service.js` without updating FastAPI | Breaks every audit |
| Parse Excel in Node “because it is easier” | Engines live in Python |

---

## 26. Cross-cutting flows

**Auth:** login → access JWT + refresh cookie on `/api/auth` → `authenticate` on process routes → 401 if missing/expired.

**RBAC:** `authorize` only on users/demo-videos. Audit POSTs are authenticated, not role-gated.

**API contracts:** prefer `/api/v1/process/<kebab-name>/validate`; keep legacy mounts for existing frontend callers.

**Errors:** Python 422 `SheetValidationError` body forwarded via `err.apiBody`; Node 400 missing file uses `detail`; auth uses `message`.

**Logging:** `requestId` on Node logs + Python `get_logger(request_id)` when forwarded.

**Git:** no CONTRIBUTING.md. PRs to `main` run Prisma validate + Python health smoke test. Production deploy is from `main` only. **Needs confirmation:** required reviewers / branch naming.

**Safely adding an audit:** copy cash-ledger end-to-end; add `DEFAULT_AUDIT_TYPES`; do not edit sales/cash engines “in passing”; keep multipart field names identical across FE, Node, and Python.

---

## 27. Needs confirmation

1. Whether `audit_types` rows exist for `CASH_LEDGER`, `NEGATIVE_BANK`, `TDS_01`, `PARTY_WISE_TDS`, `SECTION44AB`
2. Which `.env` file is used in each environment (repo root vs `backend/.env`)
3. Intended listen port (docs 4002 vs code default 4001)
4. Whether anything should call `/api/v1/auth/refresh`
5. Why `SUPER_ADMIN` appears in `authorize` lists
6. Whether `MasterRule` / `DashboardSnapshot` are written outside this backend
7. Purchase `export-invalid` Python route existence
