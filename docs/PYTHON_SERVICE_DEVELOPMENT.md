# Python Service Development Handbook

This is the handbook for **audit engine developers**. Spreadsheet parsing, column detection, rules, issues, and Excel exports live here. The React app never calls this service; Node (`pythonClient.service.js`) is the only client.

`python-service/README.md` is **stale** (it still describes `app/processors/` and top-level `sales_engine/`). Treat **this file and the code under `app/engines/`** as the source of truth.

```text
Input file
    → Read / parse
    → Normalize
    → Validate structure
    → Apply audit rules
    → Generate issues
    → Generate clean / error rows
    → Return structured result
    → Backend consumes result (AuditRun + JSON to UI)
    → Frontend displays result
```

End-to-end:

```text
Frontend
    ↓
Backend API
    ↓
Audit Service (Node)
    ↓
Python Service (this process)
    ↓
Audit Engine
    ↓
Validation Rules
    ↓
Results
    ↓
Database / API
    ↓
Frontend
```

Related handbooks:

- [FRONTEND_DEVELOPMENT.md](./FRONTEND_DEVELOPMENT.md)
- [BACKEND_DEVELOPMENT.md](./BACKEND_DEVELOPMENT.md)

---

## 1. Technology / framework

**FastAPI** (not Flask) + Uvicorn.

Evidence: `python-service/requirements.txt` (`fastapi`, `uvicorn[standard]`, `pandas`, `openpyxl`, `xlsxwriter`, `polars`, `duckdb`, `pyarrow`, `pydantic`, `pydantic-settings`, `python-multipart`, `loguru`, `pytest`, `httpx`, `rapidfuzz`).

App: `python-service/app/main.py`

```python
app = FastAPI(title=settings.app_name, version='1.0.0', docs_url='/docs', redoc_url='/redoc')
```

Settings: `app/config/settings.py` — name **HAA — Excel Validation & Auditing Service**. Default port `APP_PORT` **8000**.

```bash
cd python-service
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- Health: `GET http://127.0.0.1:8000/api/health`
- Swagger: `http://127.0.0.1:8000/docs` (keep private in production)

---

## 2. Folder structure

```text
python-service/
  app/
    main.py                 # FastAPI app, CORS, exception handlers, router includes
    config/settings.py
    core/                   # BaseProcessor, VectorizedValidationEngine, issue_engine
    routers/                # HTTP routes (legacy /api/process + gateway /api/v1/process)
    schemas/                # Pydantic request models (exports)
    services/               # engine_factory, ProcessingService, master-rule helpers
    validators/             # upload MIME + PAN helpers only
    utils/                  # Excel, normalize, export, logging
    engines/                # one package per audit (LIVE)
    data/                   # master sales workbooks + rebuild scripts
  tests/
  requirements.txt
  sales_engine/config/      # leftover JSON copies — NOT the live engine
```

Canonical engine layout (cash_ledger, negative_bank, tds_01, section44ab):

```text
app/engines/<name>_engine/
  __init__.py
  config/          # constants.py and/or JSON
  parsers/         # workbook_loader / excel_parser
  engine/          # processor.py, audit.py, rules.py, validator.py, output.py
  validators/      # often empty; sales is the exception
```

Sales is richer: extra `validators/`, `parsers/`, `services/`, many JSON configs.

There is **no** live `app/processors/` directory. `BaseEngine` in `app/core/base_engine.py` is an alias of `BaseProcessor`.

---

## 3. Audit engine architecture

### Factory engines

`app/services/engine_factory.py`:

```python
PROCESSOR_REGISTRY = {
    'pan': PanProcessor,
    'gross_weight': GrossWeightProcessor,
    'sales': SalesAuditProcessor,
    'purchase': PurchaseAuditProcessor,
    'cash_ledger': CashLedgerProcessor,
    'negative_bank': NegativeBankProcessor,
    'tds_rate_01': Tds01Processor,
}

def get_processor(file_type: str) -> BaseProcessor:
    ...
```

`app/services/processing_service.py`:

1. `validate_upload_file(upload_file)`
2. `await upload_file.read()`
3. Reject empty bytes
4. `get_processor(file_type).process(file_bytes)`

### Engines **not** in the factory (routers call them directly)

| Engine | Why |
|--------|-----|
| `section44ab` | Multi-file; `Section44ABProcessor.process()` raises `NotImplementedError` |
| `financials` | Six named files |
| `party_wise_tds` | Dual files (`process_dual`) |
| `sales_return` / `purchase_return` | Extra JSON averages from Node |
| Rate-book / TDS-rules routers | JSON CRUD, not Excel |

---

## 4. Existing audit modules

| Package | Entry class | Purpose |
|---------|-------------|---------|
| `cash_ledger_engine` | `CashLedgerAudit` / `CashLedgerProcessor` | Negative cash; payments ≥ ₹10,000; receipts ≥ ₹2,00,000 |
| `negative_bank_engine` | `NegativeBankAudit` / `NegativeBankProcessor` | Opening/closing-style contra + Cr (“Negative Bank”). Reuses cash-ledger loader |
| `tds_01_engine` | `Tds01Audit` / `Tds01Processor` | Section 194Q-style 0.1% TDS on Purchase Voucher Listing |
| `tds_engine` | `tds_rule_store` | JSON TDS section rule book — **not** an Excel audit |
| `party_wise_tds_engine` | `PartyWiseTdsAudit` | Dual-file contra-account totals. Informational; no pass/fail |
| `section44ab_engine` | `Section44ABAudit` | Multi-file cash+bank 44AB receipt/payment totals |
| `sales_engine` | `SalesAuditProcessor` / `VectorizedSalesEngine` | Account↔product mapping, UOM, metal/diamond/gemstone rates |
| `purchase_engine` | `PurchaseAuditProcessor` | Thin wrapper: calls `SalesAuditProcessor.process` |
| `sales_return_engine` | `SalesReturnAuditProcessor` | Reuses sales engine + compares stored sales averages |
| `purchase_return_engine` | `PurchaseReturnAuditEngine` | Same vs stored purchase averages |
| `pan_engine` | `PanProcessor` | PAN format, Form 60, address proof by amount |
| `gross_weight_engine` | `GrossWeightProcessor` | Manual vs auto gross weight mismatch |
| `financials_engine` | `FinancialsClosingStockProcessor` | Sales/purchases pivots, opening stock, MR/DC, closing-stock mapping |

**Reference architecture for new exception audits:** Cash Ledger + Negative Bank.  
**Reference for ledger/rate audits:** Sales (Purchase already reuses it).  
**Reference for multi-file:** Section 44AB / Financials.  
**Reference for summary reports:** TDS 0.1% / Party-Wise TDS.

---

## 5. Common / shared utilities

| File | Role |
|------|------|
| `app/utils/normalization_engine.py` | `normalize_strict_text`, `normalize_blankable_text`, `normalize_voucher`, Polars exprs, `parse_numeric_value` |
| `app/utils/audit_row_skips.py` | Pandas skip: blank / repeated header / subtotal / missing voucher. Used by Gross Weight |
| `app/utils/sheet_validation_error.py` | `SheetValidationError` → HTTP 422 |
| `app/utils/indian_number_format.py` | Indian grouping + openpyxl number format |
| `app/utils/audit_excel_exporter.py` | Multi-sheet styled xlsx |
| `app/utils/header_cleaner.py` | `normalize_header` → lowercase snake (`Voucher No` → `voucher_no`) |
| `app/utils/excel_header_detection.py` | `find_header_row_index`, `load_excel_with_header_row` |
| `app/utils/excel_reader.py` | Pandas `read_excel` + unused `iter_chunks` |
| `app/utils/excel_exporter.py` | Per-audit invalid-row exporters |
| `app/utils/response_builder.py` | Canonical JSON envelope |
| `app/utils/logger.py` | loguru, `get_logger(request_id)` |
| `app/utils/constants.py` | PAN/GST regex, empty tokens, sales issue messages, allowed MIME |
| `app/utils/date_utils.py` | Negative bank (`days_since_transaction`, `format_till_date`) |
| `app/utils/weight_decimal.py` | Gross-weight decimals |
| `app/utils/audit_reporter.py` | Builds issue rows via `issue_engine.build_issue` |
| `app/utils/master_sales_rule_engine.py` | Polars master-rule helpers |

`app/core/base_parser.py` `BaseParser.parse()` is unused by the engines above.

---

## 6. Excel processing, data loading, column mapping

Typical path:

1. Router receives `UploadFile`
2. Bytes read **in memory** (no disk persist)
3. Header scan (`find_header_row_index` or `VectorizedValidationEngine.load_sheet`)
4. Data rows collected with `source_excel_row_number` / `__excel_row_number__`
5. Returned as `LoadedValidationSheet` (`dataframe: pl.DataFrame`, `header_row_index`, timings, `column_display_headers`)

### Parsers by family

| Parser | Path | Notes |
|--------|------|-------|
| Cash / Negative Bank / Party-wise TDS | `cash_ledger_engine/parsers/workbook_loader.py` → `load_cash_ledger_workbook` | Pandas scan first 20 rows; skip blank/footer/total; Polars out |
| Cash helpers | `cash_ledger_engine/parsers/parser.py` | `parse_amount`, `parse_balance`, footer/transaction checks |
| TDS 0.1% | `tds_01_engine/parsers/excel_parser.py` | Header aliases; reuses cash footer/amount helpers |
| Section 44AB | `section44ab_engine/parsers/workbook_loader.py` | Multi-file; exclude opening-balance rows |
| Sales / Purchase / Returns | `VectorizedValidationEngine.load_sheet` | openpyxl `read_only=True, data_only=True` → Polars |
| Financials | `financials_engine/parsers/*` | Pandas |
| PAN | `PanProcessor._load_pan_workbook` | Custom header match |
| Gross weight | `ExcelReader.read_excel` | Pandas first-row headers |

### Column detection

Shared: `normalize_header()` — lowercase, non-alnum → `_`. Duplicate headers become `label_2`, etc.

Engine-specific required sets (examples):

- Cash / Negative Bank: `{date, voucher_no, branch, contra_account, debit, credit, balance}`
- Sales: `{voucher_no, sales_account, product, unit_rate}` **or** purchase header `{voucher_no, purchase_account, product, unit_rate}` (internally remapped to `sales_account`)
- Sales/purchase return: `{voucher_no, product, unit_rate}` plus a return-account column
- TDS 0.1%: `{date, party, gross_amount}` + a voucher alias (`HEADER_ALIASES`)
- PAN: amount in `{total_value, net_amount}` plus `{pan, pan1}`

Sales also remaps `unitrate`/`rate` → `unit_rate`, `qty` → `quantity`.

---

## 7. Data normalization

`normalization_engine.py`:

- Unicode dashes / hidden chars stripped
- Text uppercased (Python + Polars)
- Voucher: `[A-Z0-9]` only
- Empty-like tokens: `pending`, `na`, `n/a`, `none`, `null`, `nan`, `-`, `----` (`SPREADSHEET_EMPTY_TOKENS`)

Cash rules use `parse_amount` / `parse_balance` (comma strip, Dr/Cr).

---

## 8. Validation pipeline and rule engines

Two approved patterns:

### A. Cash-family (row Python) — copy for most new “exception list” audits

Load → required columns → `to_dicts()` → `apply_all_rules(row)` → keep **only failed rows** → `build_*_response`.

Used by: Cash Ledger, Negative Bank.

### B. Sales-family (Polars vectorized)

`load_sheet` → canonicalize → `_enrich_sales_dataframe` → `_adjudicate` (validators as column exprs) → filter invalid transaction rows → exception records + product averages.

Used by: Sales, Purchase, Sales Return, Purchase Return.

Upload gate (all factory engines): `app/validators/common_validator.py` — `.xlsx/.xlsm/.xls` and MIME allow-list.

### `issue_engine.py` vs local constants

`app/core/issue_engine.py` registers PAN / sales / gross-weight style codes (`IssueSeverity`, `IssueCategory`, `build_issue`).

Cash Ledger / Negative Bank / TDS 0.1% **do not use it**. They keep `ISSUE_*` in `config/constants.py`.

**Do not** force cash-family codes into `_ISSUE_REGISTRY` unless you also switch that engine to `build_issue`.

### `VectorizedValidationEngine`

Excel → Polars loader + DuckDB helper SQL (`blank_row_sql`, `shared_skip_sql`, `amount_sql`).

**`duckdb_connection()` is never called** by any engine. Cash/negative bank instantiate the class mainly for `user_columns()`. Do not assume DuckDB is part of the cash pipeline.

---

## 9. Vectorized processing / Polars vs Pandas / large files

### Real Polars vectorization

`VectorizedSalesEngine`, sales/purchase return, `normalization_engine` exprs, sales validators (`mapping_validator`, `uom_validator`, `metal_rate_validator`, `diamond_rate_validator`, `gemstone_rate_validator`, `unit_rate_range_validator`).

### Mixed / row-wise

| Engine | Load | Rules | Export |
|--------|------|-------|--------|
| cash_ledger | pandas → polars | Python dicts | pandas |
| negative_bank | same as cash | Python dicts | pandas |
| party_wise_tds | cash loader | Python summary | pandas |
| tds_01 | pandas → polars | **pandas** | xlsxwriter/pandas |
| section44ab | pandas → polars | pandas totals | n/a (JSON) |
| sales / purchase | polars (openpyxl) | **polars** | pandas |
| pan | polars | polars + `map_elements` | pandas |
| gross_weight | pandas | pandas | pandas |
| financials | pandas | pandas | pandas |

### 10,000+ rows — what the code actually does

Exists:

- `CHUNK_SIZE` default **2500** in settings
- `ExcelReader.iter_chunks` — **never called**
- Sales loader: openpyxl `read_only` (better for large xlsx)
- Cash loader: full `pd.read_excel` into memory, then a Python loop
- Node timeout: `PYTHON_SERVICE_TIMEOUT_MS` default **600_000**

Does **not** exist:

- Streaming results / pagination of audit records
- A documented 10,000-row SLA
- Chunked rule application for cash-family

**How 10,000+ rows should be processed (approved pattern):**

- Prefer **Sales-family Polars** if the audit is column-expression based (mapping, rates, UOM).
- If the audit is cash-book style (running balance, Dr/Cr text, contra exceptions), follow Cash Ledger: load once, skip junk rows, loop auditable rows only. Do **not** invent a second chunked API unless you also change Node/frontend timeouts and contracts.
- Never load the same workbook twice.
- Keep `records` as **exception rows only** (cash pattern) so the JSON stays small. Sales returns `exceptionRecords` similarly.
- **Needs confirmation:** production memory limits at 10k+ cash-ledger rows. The current path will load the whole sheet.

---

## 10. Audit-specific validators, issue types, messages

| Location | What it does |
|----------|----------------|
| `app/validators/common_validator.py` | Upload extension/MIME |
| `app/validators/pan_validator.py` | `is_pan_missing`, `is_pan_valid` |
| `cash_ledger_engine/engine/validator.py` + `rules.py` | Required cols + row rules |
| `negative_bank_engine/engine/validator.py` | Same + `tillDate` |
| `tds_01_engine/validators/threshold_validator.py` | `filter_eligible_parties` (> ₹50,00,000) |
| `sales_engine/validators/*.py` | Mapping, UOM, metal/diamond/gem, unit-rate range, messages |
| `financials_engine/engine/opening_stock.py` | Opening-stock validation |

Many `engines/*/validators/__init__.py` files are empty.

### Cash Ledger issue codes (`cash_ledger_engine/config/constants.py`)

| Code | Message (exact report wording) |
|------|--------------------------------|
| `NEGATIVE_CASH_BALANCE` | `Negative Cash` |
| `CASH_PAYMENT_GT_10000` | `Cash Payments>=Rs. 10,000/-` |
| `CASH_RECEIPT_GT_200000` | `Cash Receipts>=Rs. 2,00,000/-` |

Negative bank: `NEGATIVE_BANK` → `"Negative Bank"`.

Sales / `issue_engine` examples: `INVALID_PRODUCT_MAPPING`, `INVALID_PRODUCT_PATTERN`, `INVALID_UOM`, `INVALID_RATE_DEVIATION`, `INVALID_UNIT_RATE_RANGE`, `MISSING_UNIT_RATE`, `MISSING_RATE_RULE`.

Sales return extras: `HIGHER_SALES_RETURN_RATE`, `INVALID_FREE_QUANTITY`, `INVALID_LEDGER_MAPPING`, `PRODUCT_NOT_FOUND_IN_SALES`.

Purchase return extras: `HIGHER_PURCHASE_RETURN_RATE`, `PRODUCT_NOT_FOUND_IN_PURCHASE`.

TDS 0.1% and party-wise TDS are **summary reports** (`errorRows: 0`), not issue-code engines.

Cash/negative bank: `ISSUE_MESSAGES[code]` joined with `'; '` into `record['Message']`.  
Sales: `build_row_messages` / `primary_audit_message` (one short string).  
Frontend filter widgets depend on these **exact** codes and messages.

---

## 11. Result structure

Canonical envelope (`app/utils/response_builder.py`):

```json
{
  "success": true,
  "fileType": "<engine key>",
  "totalRows": 0,
  "errorRows": 0,
  "summary": {},
  "records": []
}
```

Optional extras: `productAverages`, `exportColumns`, `columnDisplayHeaders`, `exceptionRecords`, `sourceColumns`, `detailedRecords`, `summaryRecords`, `purchaseSummary`, `payableSummary`, `requestId`, timing/metrics fields Node copies onto `AuditRun`.

**Section 44AB** (custom): `{success, reportRows, summary, fileErrors, processingStatistics, executionTiming, requestId}` — **not** `build_processing_response`.

**Financials** (custom): `{success, salesPivot, purchasesPivot, openingPivot, ...}`.

There is **no** single Pydantic response model for audits (routers return `dict`). Errors: `ErrorResponse`-like `{success, detail}` plus `SheetValidationError.to_response()`.

---

## 12. Backend ↔ Python communication

Node client: `backend/src/services/pythonClient.service.js`  
Base URL: `PYTHON_SERVICE_URL` default `http://127.0.0.1:8000`  
Timeout: 600s.

Most process routers register:

- **Legacy** (what Node actually calls): `/api/process/<name>`
- **Gateway twin:** `/api/v1/process/<name>/validate`

Exception: Node calls Section 44AB at **`/api/v1/process/section44ab`**.

### Request schemas

Multipart Excel, field **`file`:** pan, gross-weight, sales, purchase, cash-ledger, negative-bank, tds-rate-0.1

Special fields:

| Audit | Fields |
|-------|--------|
| sales-return | `sales_return_file` + form `sales_averages` (JSON array string from Node/Postgres) |
| purchase-return | `purchase_return_file` + `purchase_averages` |
| party-wise-tds | `purchase_goods_file` + `tds_payable_file` |
| section44ab | `cash_files` (list) + `bank_files` (list) |
| financials | `sales_file`, `purchases_file`, `opening_qty_file`, `previous_year_file`, `mr_file`, `dc_file` |

JSON export bodies (`app/schemas/process_schemas.py`):

- `InvalidRowsExportRequest`: `records`, optional `summary`, `processingStatistics`, `executionTiming`
- `Tds01ExportRequest`: `detailedRecords`, `summaryRecords`
- `PartyWiseTdsExportRequest`: `purchaseSummary`, `payableSummary`
- Financials: `ExportPivotsRequest`, `ExportClosingStockRequest`

### Python HTTP surface (routers + `main.py`)

**Health:** `GET /api/health` → `{status, service}`

| Method | Legacy | Gateway |
|--------|--------|---------|
| POST | `/api/process/pan` | `/api/v1/process/pan/validate` |
| POST | `/api/process/pan/export-invalid` | both |
| POST | `/api/process/gross-weight` | `/api/v1/process/gross-weight/validate` |
| POST | `/api/process/sales` | `/api/v1/process/sales/validate` |
| POST | `/api/process/purchase` | `/api/v1/process/purchase/validate` |
| POST | `/api/process/cash-ledger` | `/api/v1/process/cash-ledger/validate` |
| POST | `/api/process/cash-ledger/export-invalid` | both |
| POST | `/api/process/negative-bank` | `/api/v1/process/negative-bank/validate` |
| POST | `/api/process/negative-bank/export-invalid` | both |
| POST | `/api/process/tds-rate-0.1` | `/api/v1/process/tds-rate-0.1/validate` |
| POST | `/api/process/tds-rate-0.1/export` | both |
| POST | `/api/process/party-wise-tds` | `/api/v1/process/party-wise-tds/validate` |
| POST | `/api/process/party-wise-tds/export` | both |
| POST | `/api/process/sales-return/validate` | same |
| POST | `/api/process/sales-return/export-exceptions` | both |
| POST | `/api/process/purchase-return/validate` | same |
| POST | `/api/process/financials` | `/api/v1/process/financials/validate` |
| POST | *(none on `router`)* | `/api/v1/process/section44ab` only |

Rules (not file audits): `GET/POST /api/v1/rate-rules`, `/api/v1/diamond-rate-rules`, `/api/v1/rate-book/diamonds`, `/api/v1/tds-rules` (plus unversioned twins).

When Node adds a new `pythonClient` function, the **legacy path must exist** unless you also change Node (as 44AB did).

---

## 13. Audit creation flow inside Python

Factory engines:

```text
HTTP router
  → ProcessingService.process(file_type, file)
    → validate_upload_file
    → get_processor(file_type)
    → Processor.process(bytes)
        → Audit.process(bytes)
            → loader
            → required-column check (SheetValidationError or KeyError)
            → rules
            → output builder
```

Multi-file engines skip `ProcessingService`.

---

## 14. How to create a new audit (do not invent a third pipeline)

### Ledger-rule / cash-book audit (copy Cash Ledger + Negative Bank)

1. Package `app/engines/<name>_engine/` with `config/constants.py`, reuse `load_cash_ledger_workbook` if the sheet is a cash/bank book, `engine/{processor,audit,rules,validator,output}.py`
2. `XProcessor(BaseProcessor)` with `process(self, file_bytes) -> dict`
3. Router: dual `APIRouter` prefixes `/api/process` and `/api/v1/process` (see `cash_ledger_router.py`)
4. Register in `PROCESSOR_REGISTRY` **and** pass the same `file_type` string to `ProcessingService`
5. Wire Node `pythonClient.service.js` + backend route + frontend (see the other two handbooks)
6. Tests under `tests/`

### Reuse sales (copy Purchase)

`PurchaseAuditProcessor` only wraps `SalesAuditProcessor`. Header can be `purchase_account`. Do not fork `VectorizedSalesEngine` for a second ledger.

### TDS-style report

Copy `tds_01_engine` (parser + calculator + `error_rows=0` + extra record lists).

### Multi-file

Copy `section44ab_router` / `financials_router`. Do **not** implement `BaseProcessor.process(single bytes)` as the real API (`Section44ABProcessor.process` is intentionally unimplemented).

**Do not** start from stale README `processors/` paths or `python-service/sales_engine/config/` leftovers. Live JSON is under `app/engines/sales_engine/config/`.

---

## 15. How to create a new validator / add a new rule

### Sales Polars

Add a module under `app/engines/sales_engine/validators/`, expose exprs, call from `VectorizedSalesEngine._adjudicate`. Map flags to issue codes in `_records_from_invalid_frame`. Add wording in `sales_audit_messages.py`. Rate bands often go in JSON (`metal_rate_rule_book.json`, `diamond_rate_book.json`, `gemstone_rate_book.json`, `uom_rules.json`).

### Cash-family

1. `ISSUE_*` + `MESSAGE_*` + `ISSUE_MESSAGES` in `config/constants.py`
2. `check_new_rule(row) -> bool` in `engine/rules.py`
3. `apply_all_rules` appends the code
4. Thresholds/exceptions stay in `constants.py` (see `CASH_PAYMENT_EXCEPTIONS`, `BANK_ACCOUNT_PHRASES`)
5. Mirror codes in frontend `*RecordFilters.js`

### Upload-level

`app/validators/` only if **all** uploads need it.

TDS **section text** rules: edit/save `tds_rule_book.json` via `/api/v1/tds-rules` — that is **not** the 0.1% calculator.

---

## 16. How to reuse utilities and avoid duplicate logic

| Need | Reuse |
|------|--------|
| Cash-book Excel | `load_cash_ledger_workbook` (negative_bank + party_wise_tds already do) |
| Header scan | `find_header_row_index` + `normalize_header` |
| Amount / DrCr | `parse_amount`, `parse_balance` |
| Skip junk rows | `should_skip_audit_row` or cash loader skips |
| Text / voucher | `normalization_engine` |
| API envelope | `build_processing_response` |
| 422 shape | `SheetValidationError` |
| Export workbook | `audit_excel_exporter` or `excel_exporter` |
| Sales rules | `VectorizedSalesEngine` (purchase + returns already do) |

Already shared — do not copy:

- Negative bank and party-wise TDS reuse cash loader + `REQUIRED_COLUMNS`
- Purchase reuses sales processor
- Returns reuse `VectorizedSalesEngine`
- TDS 0.1% parser reuses cash footer/amount helpers

Avoid: a second `normalize_header`, a second Excel-skip heuristic, a parallel JSON envelope, writing into leftover `python-service/sales_engine/config/`.

---

## 17. Missing/invalid columns, blank rows, Excel row identity

**Missing columns:** `SheetValidationError(code='MISSING_REQUIRED_COLUMNS', missingColumns, foundColumns, headerRowExcel, expectedColumns, hints)` → HTTP 422.

**Header not found:** `code='HEADER_NOT_FOUND'` (cash ledger).

**PAN:** `KeyError` → global handler 422 `{success:false, detail:"Missing column: ...", error:{code:KEY_ERROR}}`.

**Blank rows:**

- Cash loader: `_is_blank_data_row` skipped; also footer/total/non-transaction
- `audit_row_skips.is_blank_row` / `should_skip_audit_row` (gross weight)
- Sales: `__is_blank_row`; blanks are not transaction rows

**Preserve Excel row numbers:** loaders attach `source_excel_row_number` and `__excel_row_number__` as **1-based Excel physical rows**.

- Cash/negative bank: `rowNumber` from those fields; `<= 0` skipped
- Sales: frozen as `__source_excel_row_number`; records expose `rowNumber`, `rowId`, `sourceExcelRowNumber`

Never re-index to “nth data row”. Auditors match Excel by physical row.

---

## 18. Logging, debugging, exceptions

- loguru via `get_logger(request_id)`; format includes `{extra[request_id]}`
- Routers mint `uuid4` request ids (financials also reads `x-request-id`)
- Header detection logs original + normalized headers
- Sales: `log_benchmark`, reconciliation logs
- Debug workbooks only if `AUDIT_DEBUG_EXPORT` or `SALES_DEBUG_EXPORT` is true (`get_settings().debug_exports_enabled()`)
- Sales debug dir: `python-service/debug/`
- Startup prints all registered routes to stdout (`main.py`)

### Exception handlers (`app/main.py`)

| Exception | Status | Body |
|-----------|--------|------|
| `ValueError` | 400 | `{success:false, detail}` |
| `SheetValidationError` | 422 | `exc.to_response()` |
| `KeyError` | 422 | missing-column payload + logged traceback |
| `Exception` | 500 | `{success:false, message:"Internal server error"}` (no stack to client) |

Section 44AB and financials routers also catch locally (400/422/500 with `requestId`). Node maps these to the browser via `err.apiBody`.

CORS on Python is `allow_origins=['*']` because **browsers should not call it**; Node is the client.

---

## 19. Configuration / rule files

**Env** (`app/config/settings.py`, optional `.env`): `APP_ENV`, `APP_PORT`, `LOG_LEVEL`, `CHUNK_SIZE`, `GROSS_WEIGHT_TOLERANCE`, `GROSS_WEIGHT_MATCH_EPSILON`, `SALES_DEBUG_EXPORT`, `AUDIT_DEBUG_EXPORT`.

**Live JSON under `app/engines/`:**

- `sales_engine/config/`: `mappings.json`, `sales_ledger_catalog.json`, `purchase_ledger_catalog.json`, `uom_rules.json`, `gemstone_rate_book.json`, `gemstone_rules.json`, `gemstone_product_catalog.json`, `diamond_rate_book.json`, `diamond_hardcoded_rates.json`, `metal_rate_rule_book.json`, `metal_market_rates.json`, `metal_account_rates.json`
- `tds_engine/config/tds_rule_book.json`
- `financials_engine/config/closing_stock_product_rule_book.json`, `receipts_issues_classification.json`

Rate books are writable via HTTP (`metal_rate_store`, `diamond_rate_store`, `rate_book_router`, `tds_rule_store`). Frontend Rate Rule Book / Diamond pages persist through Node → these files.

**Not JSON:** cash / negative / tds_01 / section44ab thresholds live in `config/constants.py`.

---

## 20. Database interaction

**None in Python.** No SQLAlchemy/psycopg/sqlite. DuckDB is in-memory only and unused by engines.

Persistence:

- JSON files on disk (rate books, TDS rules, closing-stock rule book)
- Node/PostgreSQL stores product averages **after** Python returns them. Sales-return consumes averages Node sends back. Python does not query Postgres.

Do not add a Python database “to make audits simpler.”

---

## 21. Testing strategy

`python-service/tests/` — pytest, **no `conftest.py`**.

```bash
cd python-service
PYTHONPATH=. pytest tests/ -q
```

Present coverage includes: `test_health.py`, cash ledger parser/header/bank-account tests, `test_negative_bank.py`, `test_section44ab.py`, `test_tds_01_audit.py`, `test_party_wise_tds_summary.py`, sales processor/exception/reconciliation tests, `test_issue_engine.py`, PAN, gross weight, sales-return, purchase-return, financials, metal/diamond/UOM tests.

**Unit tests:** parsers, `check_*` rule functions, `normalize_header`, issue message maps.  
**Integration tests:** FastAPI router + engine with a small fixture xlsx (see cash/negative/44AB tests).  
**Large-file / performance:** **not** a dedicated suite. Sales logs `log_benchmark`. **Needs confirmation** of a required 10k-row fixture before claiming a SLA.

When adding an audit, add at least:

1. Header-missing → 422 `MISSING_REQUIRED_COLUMNS`
2. One passing row + one failing row for each new rule
3. Excel `rowNumber` matches the physical row in the fixture

---

## 22. What Python developers must NOT change

There is no locked-files list. These contracts other layers depend on:

1. `build_processing_response` keys (`success`, `fileType`, `totalRows`, `errorRows`, `summary`, `records`)
2. Dual router prefixes **and** the exact Node paths in `pythonClient.service.js`
3. `PROCESSOR_REGISTRY` keys used by existing routers
4. `normalize_header` semantics
5. `source_excel_row_number` / `__excel_row_number__` meaning (1-based Excel row)
6. `SheetValidationError.to_response()` / 422 shape
7. Cash issue **wording** (exported/reported as-is; frontend widgets match)
8. Sales required columns and Purchase’s reuse of the sales engine
9. Do not add a Python database
10. Do not treat `README.md` or `python-service/sales_engine/` as live architecture
11. Do not implement `Section44ABProcessor.process(single file)` as the real API
12. Keep `AUDIT_DEBUG_EXPORT` / `SALES_DEBUG_EXPORT` default **false** in production
13. Do not change metal product keys without updating `frontend/src/constants/metalRateRuleBook.js`

---

## 23. Complete example: Cash Ledger (approved pattern)

**Classes:** `CashLedgerProcessor` → `CashLedgerAudit`  
**Files:**

- `app/engines/cash_ledger_engine/engine/processor.py`
- `app/engines/cash_ledger_engine/engine/audit.py`
- `app/engines/cash_ledger_engine/parsers/workbook_loader.py`
- `app/engines/cash_ledger_engine/engine/validator.py`
- `app/engines/cash_ledger_engine/engine/rules.py`
- `app/engines/cash_ledger_engine/engine/output.py`
- `app/routers/cash_ledger_router.py`

### Flow

1. **Input** — Node `postCashLedgerValidate` → `POST /api/process/cash-ledger`, multipart field `file`.
2. **Read/parse** — `load_cash_ledger_workbook`: scan 20 rows for header markers; `pd.read_excel`; skip blank, footer (`Date :`, `User Name`, …), grand-total, non-transaction rows; attach Excel row numbers; return Polars `LoadedValidationSheet`.
3. **Normalize** — headers via `normalize_header`; amounts via `parse_amount` / `parse_balance`.
4. **Validate structure** — `REQUIRED_COLUMNS`. Missing → `SheetValidationError`.
5. **Apply rules** (`apply_all_rules`):
   - Balance contains `Cr` or numeric &lt; 0 → `NEGATIVE_CASH_BALANCE`
   - Credit ≥ 10000 unless contra is closing/c-f **or** `is_bank_account` → `CASH_PAYMENT_GT_10000`
   - Debit ≥ 200000 unless opening/b-f → `CASH_RECEIPT_GT_200000`
6. **Issues** — only rows with issues kept; `Message` joined from `ISSUE_MESSAGES`.
7. **Clean vs error rows** — clean rows counted in `passedRows`, not returned in `records`.
8. **Result** (shape):

```json
{
  "success": true,
  "fileType": "cash_ledger",
  "totalRows": 123,
  "errorRows": 10,
  "summary": {
    "totalRows": 123,
    "passedRows": 113,
    "failedRows": 10,
    "totalIssues": 12,
    "issuesByType": {
      "NEGATIVE_CASH_BALANCE": 5,
      "CASH_PAYMENT_GT_10000": 7
    }
  },
  "records": [
    {
      "rowNumber": 17,
      "date": "...",
      "voucher_no": "...",
      "branch": "...",
      "contra_account": "...",
      "debit": "...",
      "credit": "...",
      "balance": "...",
      "issues": ["CASH_PAYMENT_GT_10000"],
      "Message": "Cash Payments>=Rs. 10,000/-"
    }
  ],
  "exportColumns": ["rowNumber", "date", "voucher_no", "branch", "contra_account", "debit", "credit", "balance", "Message"],
  "columnDisplayHeaders": { "rowNumber": "Row No" }
}
```

Export: `POST /api/process/cash-ledger/export-invalid` with `InvalidRowsExportRequest`.

Node then persists `AuditRun` (best-effort) and returns `{ ...payload, auditRunId }` to `CashLedgerPage`.

---

## 24. Second example: Sales (vectorized reference)

**Classes:** `SalesAuditProcessor` → `VectorizedSalesEngine`  
**Files:** `app/engines/sales_engine/engine/processor.py`, `vectorized_sales_engine.py`

1. **Input** — `POST /api/process/sales`, field `file`.
2. **Read** — `loader.load_sheet(..., row_matches=_ledger_header_row_matches, scan_limit=100)`.
3. **Normalize** — canonicalize purchase/rate/qty aliases; freeze original columns as `__original_*`.
4. **Structure** — required `{voucher_no, sales_account, product, unit_rate}`; else 422.
5. **Enrich** — blank/repeated-header/business-skip (`REPAIR CHARGES`, `ROUND OFF`, `DISCOUNT`, `TOTAL`); transaction = voucher + account + product + qty &gt; 0.
6. **Rules** — mapping, UOM, gem/metal/diamond rates, 0–1 unit-rate range (Polars).
7. **Issues** — invalid txn rows only; `issues` + `messages` / `rateMessage`.
8. **Result extras** — `exceptionRecords`, `exportColumns`, `columnDisplayHeaders`, `sourceColumns`, `productAverages`, `productAverageVerification`.  
   `totalRows` = **transaction-row count**, not raw Excel rows.

Purchase is the same engine. **Needs confirmation** whether Node remaps `fileType` for the purchase UI (`SalesAuditProcessor` still builds `fileType='sales'` internally).

---

## 25. Negative Bank and Section 44AB (short)

**Negative bank:** same loader/columns as cash; only `check_negative_bank` (opening/closing contra + Cr). Adds `tillDate`. `fileType`: `negative_bank`. Frontend is ADMIN-sidebar-only; the Python engine does not know about roles.

**Section 44AB:** `POST /api/v1/process/section44ab` with `cash_files` + `bank_files`. Sums debit/credit per file, excludes opening-balance rows, returns `reportRows` + percentages. Not factory-registered.

---

## 26. Cross-cutting: auth, RBAC, errors, logging, tests, git, safe changes

**Auth:** Python does **not** authenticate. Node already did. Do not add JWT middleware here unless product explicitly requires it.

**RBAC:** not enforced in Python.

**API contracts:** keep field names (`file`, `cash_files`, `records`) identical to Node. Changing a field name without a Node + frontend PR will break production.

**Error handling:** 422 sheet errors must stay JSON (not HTML). Node forwards `apiBody` to the rose error card.

**Logging:** include `request_id`; never log full workbooks.

**Testing:** run `PYTHONPATH=. pytest tests/ -q` locally before merging engine changes. CI (`.github/workflows/backend-deploy.yml` job `python-check`) runs **only** `pytest tests/test_health.py -q` on PRs/pushes to `main` that touch `python-service/**`. Full engine tests are **not** gated in CI today.

**Git:** no CONTRIBUTING.md. Do not commit `debug/` xlsx or enabled debug-export env.

**Safely adding a new audit without breaking existing ones:**

- New package under `app/engines/` — do not edit cash `rules.py` to add an unrelated audit
- New router file — do not overload `sales_router.py`
- Register factory key only for single-file `BaseProcessor` audits
- Add tests that would fail if cash/sales required columns changed accidentally
- Keep `normalize_header` and `SheetValidationError` untouched unless every engine is updated

---

## 27. Needs confirmation

1. Production memory / time limits for 10k+ cash-ledger rows
2. Whether purchase `fileType` should be `purchase` in the JSON
3. Whether Node’s purchase `export-invalid` Python path exists
4. Whether the full pytest suite should be added to CI (today only `test_health.py` runs)
5. Intended owner of leftover `python-service/sales_engine/config/` copies (delete vs ignore)
