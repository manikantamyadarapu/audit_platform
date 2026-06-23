# Python Service README

FastAPI microservice for Excel upload validation and audit reporting. This service is the Python validation engine behind the audit platform. The Node backend proxies frontend requests to this service.

## Current Tech Task

This service currently supports these audit tasks:

- PAN verification for high-value transactions.
- Gross weight verification for manual vs auto gross weight mismatches.
- Sales ledger verification for account/product mapping and rate deviation checks.
- **Sales Return Audit** — dual-file upload: validate return rows (reuses sales engine) + product-wise average rate comparison vs sales file. See [`app/sales_return_engine/README.md`](app/sales_return_engine/README.md).
- Rate Rule Book storage for employee-entered gold/silver product rates.
- Downloadable invalid-row Excel reports for PAN, gross weight, and sales audits.

GST route stubs still exist, but GST is not registered in the active processor factory.

## Libraries

Runtime libraries:

- `fastapi` - HTTP API framework.
- `uvicorn[standard]` - ASGI server.
- `python-multipart` - file upload parsing.
- `pydantic`, `pydantic-settings` - request models and environment settings.
- `pandas` - Excel/dataframe handling for gross weight and exports.
- `openpyxl` - reading `.xlsx/.xlsm` uploads and styling generated workbooks.
- `xlsxwriter` - writing downloadable Excel reports.
- `polars` - vectorized sales and PAN data processing.
- `duckdb` - SQL validation over uploaded sheet data.
- `pyarrow` - bridge between Polars and DuckDB.
- `loguru` - request and benchmark logging.
- `rapidfuzz` - legacy fuzzy lookup helper for old master sales rules.

Development/test libraries:

- `pytest` - test runner.
- `httpx` - FastAPI test client support.

## High-Level Flow

1. FastAPI receives an uploaded Excel file.
2. `ProcessingService` validates the upload and reads file bytes.
3. `processors/factory.py` selects the processor by file type.
4. The processor detects or normalizes headers.
5. Validation logic creates invalid-row records and summary counts.
6. `response_builder.py` returns a consistent JSON response.
7. Export endpoints use `excel_exporter.py` and `audit_reporter.py` to generate multi-sheet Excel workbooks.

## Run Locally

```powershell
cd python-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Useful URLs:

- API: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

## Environment Variables

Settings are loaded from **`python-service/.env`** (see `.env.example` in this folder). Defaults are also in `app/config/settings.py`.

```env
APP_ENV=development
APP_PORT=8000
LOG_LEVEL=INFO
CHUNK_SIZE=2500
GROSS_WEIGHT_TOLERANCE=0.5
GROSS_WEIGHT_MATCH_EPSILON=0.002
SALES_DEBUG_EXPORT=false
AUDIT_DEBUG_EXPORT=false
```

`SALES_DEBUG_EXPORT=true` or `AUDIT_DEBUG_EXPORT=true` enables slow debug workbook/CSV output under `app/debug/`.

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `POST` | `/api/process/pan` | Validate PAN audit upload |
| `POST` | `/api/v1/process/pan/validate` | Gateway PAN validation route |
| `POST` | `/api/process/pan/export-invalid` | Export PAN invalid rows |
| `POST` | `/api/v1/process/pan/export-invalid` | Gateway PAN export route |
| `POST` | `/api/process/gross-weight` | Validate gross weight upload |
| `POST` | `/api/v1/process/gross-weight/validate` | Gateway gross weight route |
| `POST` | `/api/process/gross-weight/export-invalid` | Export gross weight invalid rows |
| `POST` | `/api/v1/process/gross-weight/export-invalid` | Gateway gross weight export route |
| `POST` | `/api/process/sales` | Validate sales ledger upload |
| `POST` | `/api/v1/process/sales/validate` | Gateway sales route |
| `POST` | `/api/process/sales/export-invalid` | Export sales invalid rows |
| `POST` | `/api/v1/process/sales/export-invalid` | Gateway sales export route |
| `POST` | `/api/process/sales-return/validate` | Validate sales + sales return (dual upload) |
| `POST` | `/api/v1/process/sales-return/validate` | Gateway sales return validation route |
| `POST` | `/api/process/sales-return/export-rate-comparison` | Export rate comparison rows |
| `POST` | `/api/v1/process/sales-return/export-rate-comparison` | Gateway sales return export route |
| `GET` | `/api/rate-rules` | Read saved gold/silver product rates |
| `GET` | `/api/v1/rate-rules` | Gateway rate-rule read route |
| `POST` | `/api/rate-rules` | Save gold/silver product rates |
| `POST` | `/api/v1/rate-rules` | Gateway rate-rule save route |

## Request Examples

```bash
curl http://127.0.0.1:8000/api/health
curl -X POST "http://127.0.0.1:8000/api/process/pan" -F "file=@./pan.xlsx"
curl -X POST "http://127.0.0.1:8000/api/process/gross-weight" -F "file=@./gross.xlsx"
curl -X POST "http://127.0.0.1:8000/api/process/sales" -F "file=@./sales.xlsx"
curl -X POST "http://127.0.0.1:8000/api/process/sales-return/validate" \
  -F "sales_file=@./sales.xlsx" \
  -F "sales_return_file=@./sales-return.xlsx"
```

Rate Rule Book payload:

```json
{
  "rates": {
    "Gold Ornaments 22K": 9000,
    "Silver articles": 110
  },
  "allowed_variation_percent": 30
}
```

## Response Shape

Every validation response is built by `app/utils/response_builder.py`.

```json
{
  "success": true,
  "fileType": "sales",
  "totalRows": 100,
  "errorRows": 5,
  "summary": {},
  "records": []
}
```

## PAN Audit Logic

Main file: `app/processors/pan_processor.py`

Required normalized columns:

- `total_value`
- `pan`
- `pan1`
- at least one of `add_proof` or `add_proof_2`

Logic:

- Uses `VectorizedValidationEngine` to detect the real header row and load rows with stable Excel row numbers.
- Skips blank rows, repeated header rows, subtotal rows, and rows without voucher numbers.
- Parses `total_value` even when commas/currency text are present.
- Accepts valid Indian PAN format plus approved equivalents like `Form No-60` and `US DL`.
- If `total_value > 200000`, emits `MISSING_PAN_ABOVE_2L` or `INVALID_PAN_FORMAT`.
- If `total_value > 50000`, emits `MISSING_ADDRESS_PROOF_ABOVE_50K`.
- Returns row-level issue messages from `core/issue_engine.py`.

## Gross Weight Audit Logic

Main file: `app/processors/gross_weight_processor.py`

Required normalized columns:

- `manual_gross_weight`
- `auto_gross_weight`

Supported aliases include:

- `manual_gross_wt`
- `auto_gross_wt`
- `diff`
- `difference_in_gross_wt`
- `weight_difference`
- `gross_difference`

Logic:

- Reads Excel with pandas/openpyxl.
- Finds the header row by detecting `S.No`/`Sr No` style first-column headers.
- Supports both normal flat rows and cross-format voucher/value row pairs.
- Uses `parse_weight_decimal()` for strict Decimal-safe weight parsing.
- Computes effective difference when a difference column is missing.
- Treats absolute difference over `0.002` as invalid.
- Negative differences emit `NEGATIVE_WEIGHT_VALUES`.
- Positive differences emit `GROSS_WEIGHT_MISMATCH`.
- Returns voucher row and value row indexes so the UI can point to the right Excel row.

## Sales Ledger Audit Logic

Main files:

- `app/processors/sales_audit_processor.py`
- `app/sales_engine/engine/vectorized_sales_engine.py`
- `app/sales_engine/README.md`

Required normalized columns:

- `voucher_no`
- `sales_account`
- `product`
- `unit_rate`

For a row to be treated as a transaction, the current sales filter also requires a positive `quantity` value. An upload can pass the required-column check without `quantity`, but it will not produce transaction rows for validation.

Logic:

- Detects the real header row even when title rows exist above the table.
- Freezes original Excel row number and original uploaded account/product/unit-rate cells.
- Normalizes voucher, account, product, and rate text.
- Skips blank rows, repeated headers, totals, subtotals, repair charges, round off rows, and discount rows.
- Canonicalizes account aliases from catalog config.
- Validates sales account to product mapping using `sales_ledger_catalog.json`.
- Validates gemstone rates by extracting slab values from product names and applying +/-30%.
- Validates configured gold/silver products against employee-entered Rate Rule Book rates.
- Validates diamond rates through the diamond rate rule book where rules apply.
- Builds one invalid API record per source Excel row and preserves row numbers.
- Logs reconciliation: input transaction rows = valid + invalid + dropped.

Active sales issue codes:

- `INVALID_PRODUCT_MAPPING`
- `INVALID_PRODUCT_PATTERN`
- `INVALID_RATE_DEVIATION`

Compatibility summary fields such as `invalidSalesAccounts`, `productsNotFoundInMaster`, and `rateMasterNotFound` remain in the API but are not the main current sales engine outputs.

## Sales Rule Sources

Editable rule/config files live in `app/sales_engine/config/`.

| File | Purpose |
| --- | --- |
| `sales_ledger_catalog.json` | Source of truth for account aliases and account/product regex mapping |
| `gemstone_rules.json` | Gemstone families, slab routing, and deviation percentage |
| `gemstone_product_catalog.json` | Generated gemstone product catalog |
| `metal_rate_rule_book.json` | Saved employee-entered gold/silver product rates |
| `metal_account_rates.json` | Account-level metal rate reference data |
| `metal_market_rates.json` | Market-rate reference data |
| `diamond_rate_rule_book.json` | Diamond product rate bands |
| `mappings.json` | Legacy/compatibility mapping, slab route, and misc product patterns |
| `loader.py` | Cached JSON loaders and helpers for all rule files |

## Export Reports

Export endpoints receive invalid-row JSON from the frontend/backend and return an Excel workbook.

Each report can include:

- `Summary`
- `Issue Breakdown`
- `Issue Grouping`
- `Processing Statistics`
- `Execution Timing`
- processor-specific invalid rows sheet

Main export files:

- `app/utils/excel_exporter.py`
- `app/utils/audit_reporter.py`

## Folder and File Logic

```text
python-service/
  README.md                         Service documentation.
  requirements.txt                  Python dependencies.
  normalized_cross_to_flat.xlsx     Local gross-weight sample/debug workbook.
  pan_issue_rows_debug.xlsx         Optional PAN debug export.
  tests/                            Pytest coverage for processors, helpers, and sales rules.
```

### `app/`

| File | Logic |
| --- | --- |
| `__init__.py` | Marks `app` as a Python package. |
| `main.py` | Creates FastAPI app, adds CORS, registers routers, and maps errors to JSON responses. |

### `app/config/`

| File | Logic |
| --- | --- |
| `__init__.py` | Package marker. |
| `settings.py` | Pydantic settings, `python-service/.env` loading, app metadata, ports, logging level, tolerances, and debug export flags. |

### `app/core/`

| File | Logic |
| --- | --- |
| `issue_engine.py` | Central issue registry with severity, category, default messages, and helpers for building issue records/messages. |

### `app/data/`

| File | Logic |
| --- | --- |
| `master_sales_rules.xlsx` | Legacy master sales workbook reference. |
| `master_sales_rules.csv` | Legacy flattened sales rule data for helper lookups. |
| `master_sales_rate_rules.xlsx` | Legacy/generated sales rate workbook. |
| `build_master_sales_rate_rules.py` | Builds legacy rate workbook data from product/account rules. |
| `build_gemstone_product_catalog.py` | Generates gemstone product catalog JSON. |
| `rebuild_master_emerald_rows.py` | Utility script to rebuild emerald rows in legacy workbook. |
| `rebuild_master_pearls_rubies_rows.py` | Utility script to rebuild pearl/ruby rows in legacy workbook. |

### `app/engines/`

| File | Logic |
| --- | --- |
| `vectorized_validation_engine.py` | Shared OpenPyXL loader with header detection, normalized columns, source row numbers, DuckDB registration, SQL helpers, skip-row SQL, and benchmark logging. |
| `vectorized_sales_engine.py` | Compatibility re-export/import path for the official sales engine. |

### `app/processors/`

| File | Logic |
| --- | --- |
| `__init__.py` | Package marker. |
| `base.py` | Abstract `BaseProcessor` contract with `process(file_bytes)`. |
| `factory.py` | Active processor registry: `pan`, `gross_weight`, and `sales`. |
| `pan_processor.py` | PAN validation using shared vectorized loader plus DuckDB SQL issue detection. |
| `gross_weight_processor.py` | Gross weight audit, cross-format flattening, Decimal parsing, mismatch detection, and invalid-row shaping. |
| `sales_audit_processor.py` | Sales upload validation wrapper, required-column checks, structured 422 errors, and response building. |

### `app/routers/`

| File | Logic |
| --- | --- |
| `__init__.py` | Package marker. |
| `health_router.py` | `/api/health` response. |
| `process_router.py` | Upload validation and invalid-row export routes for PAN, gross weight, sales, plus legacy GST route. |
| `rate_rules_router.py` | GET/POST APIs for saved gold/silver product rates. |

### `app/schemas/`

| File | Logic |
| --- | --- |
| `__init__.py` | Package marker. |
| `base.py` | Pydantic response schemas for health and errors. |

### `app/services/`

| File | Logic |
| --- | --- |
| `__init__.py` | Package marker. |
| `processing_service.py` | Upload validation, byte reading, processor lookup, and process dispatch. |
| `master_rule_service.py` | Legacy Excel master-rule flattening and integrity checks. Not used by the current sales engine runtime. |
| `master_sales_rate_rule_service.py` | Legacy sales-rate workbook flattening. Not the current Rate Rule Book API. |

### `app/utils/`

| File | Logic |
| --- | --- |
| `__init__.py` | Package marker. |
| `audit_reporter.py` | Builds multi-sheet Excel audit reports and styles/autosizes workbooks. |
| `audit_row_skips.py` | Shared pandas row-skip checks for blanks, repeated headers, subtotals, and missing vouchers. |
| `constants.py` | PAN/GST regexes, empty tokens, messages, allowed file extensions, MIME types, and sales issue messages. |
| `excel_exporter.py` | Processor-specific export column mapping and calls into audit report builder. |
| `excel_header_detection.py` | Generic pandas header-row detection utilities. |
| `excel_reader.py` | Basic Excel reader that normalizes headers. |
| `header_cleaner.py` | Header normalization to lowercase snake_case. |
| `logger.py` | Loguru logger binding with request IDs. |
| `master_sales_rule_engine.py` | Legacy CSV-backed sales rule lookup and fuzzy matching helpers. |
| `normalization_engine.py` | Strict text, blankable text, voucher, and numeric normalization for Python and Polars expressions. |
| `response_builder.py` | Shared success response envelope. |
| `sheet_validation_error.py` | Structured exception used for sales 422 sheet-shape errors. |
| `weight_decimal.py` | Decimal-safe gross weight parsing and quantization. |

### `app/validators/`

| File | Logic |
| --- | --- |
| `__init__.py` | Package marker. |
| `common_validator.py` | Upload extension/MIME validation. |
| `gst_validator.py` | GST missing/format helper functions. Currently not active through processor registry. |
| `pan_validator.py` | PAN missing/format helper functions. |

### `app/sales_engine/`

| File | Logic |
| --- | --- |
| `README.md` | Detailed sales-engine documentation. |
| `__init__.py` | Package marker. |

### `app/sales_engine/config/`

| File | Logic |
| --- | --- |
| `__init__.py` | Package marker. |
| `loader.py` | Cached loaders for mapping, catalog, gemstone, metal, and diamond configs. Also clears metal-rate caches after saves. |
| `sales_ledger_catalog.json` | Account aliases and account/product regex catalog. |
| `mappings.json` | Legacy aliases, slab routing, and misc product patterns. |
| `gemstone_rules.json` | Gemstone rate families and +/- variation config. |
| `gemstone_product_catalog.json` | Generated gemstone product list/catalog. |
| `metal_rate_rule_book.json` | Saved product rates used for gold/silver validation. |
| `metal_account_rates.json` | Metal account rate reference config. |
| `metal_market_rates.json` | Metal market rate reference config. |
| `diamond_rate_rule_book.json` | Diamond product/rate band config. |

### `app/sales_engine/parsers/`

| File | Logic |
| --- | --- |
| `__init__.py` | Package marker. |
| `product_category.py` | Polars expressions for account category, detected product category, slab family, slab extraction, and gem slab shape detection. |
| `metal_rate.py` | Polars expressions for matching product rule-book rates and deciding if metal rate validation applies. |
| `diamond_rate.py` | Polars expressions for diamond applicability and diamond band lookup. |

### `app/sales_engine/validators/`

| File | Logic |
| --- | --- |
| `__init__.py` | Package marker. |
| `mapping_validator.py` | Account canonicalization and account/product catalog validation. |
| `gemstone_rate_validator.py` | Gemstone slab extraction, +/- band calculation, rate validation result columns. |
| `metal_rate_validator.py` | Gold/silver rule-book rate validation and combined rate status columns. |
| `diamond_rate_validator.py` | Diamond rule-book band validation columns. |
| `audit_trace.py` | Row-level audit flags, final issue classification, status, and reason columns. |
| `sales_audit_messages.py` | Human-readable row messages for mapping and rate issues. |

### `app/sales_engine/engine/`

| File | Logic |
| --- | --- |
| `__init__.py` | Package marker. |
| `vectorized_sales_engine.py` | Main sales validation pipeline: load, normalize, enrich, adjudicate, reconcile, debug, and shape invalid records. |
| `reconciliation.py` | Counts transaction, valid, invalid, and dropped rows and logs reconciliation. |
| `debug_trace.py` | Adds stable debug identity columns and writes debug workbook output. |
| `audit_workbook.py` | Writes detailed sales audit trace workbooks. |
| `record_dedup.py` | Merges duplicate pipeline records by source row number for API output. |

### `app/sales_engine/services/`

| File | Logic |
| --- | --- |
| `__init__.py` | Package marker. |
| `metal_rate_store.py` | Loads/saves Rate Rule Book product rates, timestamps updates, and invalidates cached config. |

## Required Columns

| Processor | Required normalized columns |
| --- | --- |
| PAN | `total_value`, `pan`, `pan1`, and one of `add_proof`/`add_proof_2` |
| Gross weight | `manual_gross_weight`, `auto_gross_weight` |
| Sales | `voucher_no`, `sales_account`, `product`, `unit_rate` |

Header normalization examples:

- `Voucher No` -> `voucher_no`
- `Sales Account` -> `sales_account`
- `Manual Gross Wt.` -> `manual_gross_wt`
- `Unit Rate` -> `unit_rate`

## Error Handling

| Status | Typical cause |
| --- | --- |
| `400` | Bad upload, unreadable Excel, empty file, or unsupported processor type |
| `422` | Missing required columns or structured sales sheet-shape errors |
| `500` | Unexpected processing failure |

## Tests

From `python-service`:

```powershell
$env:PYTHONPATH="."
pytest
```

Or:

```bash
PYTHONPATH=. pytest
```

Focused sales tests:

```bash
python -m pytest tests/test_sales_audit_processor.py tests/test_sales_ledger_catalog.py tests/test_sales_reconciliation.py -q
```

## Development Notes

- Register new processors in `app/processors/factory.py`.
- Keep outward response shape changes in `app/utils/response_builder.py`.
- Use `SheetValidationError` when a bad sheet shape should return a structured `422`.
- Change sales mapping/rate rules in `app/sales_engine/config/` when possible instead of changing code.
- Update both this README and `app/sales_engine/README.md` when sales audit behavior changes.
